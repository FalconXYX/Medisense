/**
 * Every query the app makes, over the in-memory catalogue (see dataset.ts).
 * All synchronous — 838 products with a prebuilt index means no loading states anywhere.
 */
import {
  products, productByCode, groupByKey, membersByKey, pharmacies, facts,
  index, tokenize, tokensWithPrefix,
} from './dataset'
import type { Product, EqGroup, DrugFactsRow, PharmacyRow, SearchFilters, ResultSet } from './types'

/**
 * Scored search. Replaces FTS5: every query token contributes its field weight, and the LAST token
 * also prefix-matches so results appear while typing. Requiring every token to hit at least one
 * field keeps "advil cold" from returning every ibuprofen product.
 */
export function searchProducts(query: string, limit = 60): Product[] {
  const tokens = tokenize(query)
  if (!tokens.length) return []

  const scores = new Map<number, number>()
  const hitCounts = new Map<number, number>()

  tokens.forEach((token, i) => {
    const isLast = i === tokens.length - 1
    const buckets: Map<number, number>[] = []
    const exact = index.get(token)
    if (exact) buckets.push(exact)
    if (isLast) {
      for (const t of tokensWithPrefix(token)) {
        if (t === token) continue
        const b = index.get(t)
        // Prefix hits count, but a shorter completion is a better signal than a longer one.
        if (b) buckets.push(new Map([...b].map(([c, w]) => [c, w * (token.length / t.length)])))
      }
    }
    const seen = new Set<number>()
    for (const bucket of buckets) {
      for (const [code, weight] of bucket) {
        scores.set(code, (scores.get(code) ?? 0) + weight)
        if (!seen.has(code)) { seen.add(code); hitCounts.set(code, (hitCounts.get(code) ?? 0) + 1) }
      }
    }
  })

  return [...scores.entries()]
    .filter(([code]) => (hitCounts.get(code) ?? 0) === tokens.length)
    .sort((a, b) =>
      b[1] - a[1] ||
      (productByCode.get(b[0])!.brand_rank - productByCode.get(a[0])!.brand_rank))
    .slice(0, limit)
    .map(([code]) => productByCode.get(code)!)
}

export function getProduct(drugCode: number): Product | null {
  return productByCode.get(drugCode) ?? null
}

export function getGroup(key: string): EqGroup | null {
  return groupByKey.get(key) ?? null
}

/**
 * Everything Health Canada puts in the same active-ingredient group AS WELL AS the same route and
 * dosage form. ADR-004 — the intersection is the whole point; ai_group_no alone would return
 * suppositories as alternatives to caplets.
 */
export function getGroupMembers(key: string): Product[] {
  const members = membersByKey.get(key) ?? []
  // Brand first (the design's anchor), then products that have a published price ahead of those
  // that do not, then alphabetically. Sorting by price is no longer possible or meaningful: 91% of
  // products have no published price at all, so a price sort would order the majority arbitrarily
  // while implying the order meant something.
  return [...members].sort(
    (a, b) =>
      b.is_branded - a.is_branded ||
      Number(!!b.benefit_price) - Number(!!a.benefit_price) ||
      a.display_name.localeCompare(b.display_name),
  )
}

export function getDrugFacts(bases: string[]): DrugFactsRow[] {
  return bases.map((b) => facts[b]).filter(Boolean)
}

export function getIngredientBases(drugCode: number): string[] {
  return (productByCode.get(drugCode) as (Product & { bases?: string[] }) | undefined)?.bases ?? []
}

export function getPharmacies(): PharmacyRow[] {
  return pharmacies
}

/**
 * Suggestions for the landing screen — the brands a shopper is most likely to recognise.
 * Sorted by recognition (brand_index), and restricted to groups that actually HAVE alternatives,
 * so tapping a suggestion always demonstrates the point of the app.
 */
export function topBrands(limit = 8): Product[] {
  const seen = new Set<string>()
  return products
    .filter((p) => {
      if (p.brand_rank !== 3 || !p.equivalence_key) return false
      const g = groupByKey.get(p.equivalence_key)
      if (!g?.has_alternatives) return false
      // One suggestion per brand family — not Advil Caplets AND Advil Tablets.
      const family = p.display_name.split(' ')[0].toLowerCase()
      if (seen.has(family)) return false
      seen.add(family)
      return true
    })
    .sort((a, b) => (a.brand_index ?? 9999) - (b.brand_index ?? 9999))
    .slice(0, limit)
}

export function applyFilters(items: Product[], f: SearchFilters): Product[] {
  let out = items
  // "Health Canada listed only" — every product here has a DIN and is Marketed, so this is a real
  // filter over real data rather than the un-implementable "pharmacist verified only" (ADR-005).
  if (f.healthCanadaListedOnly) out = out.filter((p) => !!p.din)
  if (f.nameBrandOnly) out = out.filter((p) => p.is_branded === 1)
  // The only price question the data can answer: did anyone publish a real number for this?
  if (f.publishedPriceOnly) out = out.filter((p) => p.benefit_price != null)
  return out
}

/**
 * Turn a raw query into the Branded / Alternatives shape the design calls for.
 *
 * The branded card is the best match the user actually searched for — so searching "Advil" puts
 * Advil on top, not whichever product the group's default anchor happens to be.
 */
export function buildResultSet(query: string, filters: SearchFilters): ResultSet {
  const matches = searchProducts(query)
  if (!matches.length) return { query, branded: null, alternatives: [], group: null, otherMatches: [] }

  // Prefer a recognisable brand among the top matches, and among equally-relevant brands prefer
  // the mainstream product over a paediatric or specialty variant. Relevance alone answers
  // "tylenol" with Infants' Tylenol — same score, arbitrary tie-break — which is not what a
  // shopper meant and lands them in a 3-member group instead of a 15-member one.
  // Group size is the signal: the more products Health Canada lists as equivalent, the more
  // mainstream the formulation. Explicit variant words in the query override this.
  const wantsVariant = /\b(infant|children|child|kid|junior|baby)/i.test(query)
  const brandMatches = matches.filter((m) => m.brand_rank === 3)
  const rank = (p: Product) => {
    const isVariant = /\b(INFANTS?|CHILDRENS?|KIDS?|JUNIOR|BABY)\b/i.test(p.brand_name)
    const members = p.equivalence_key ? (getGroup(p.equivalence_key)?.member_count ?? 1) : 1
    return (isVariant === wantsVariant ? 1000 : 0) + members
  }
  const anchor =
    (brandMatches.length
      ? [...brandMatches].sort((a, b) => rank(b) - rank(a))[0]
      : undefined) ??
    matches.find((m) => m.is_branded === 1) ??
    matches[0]
  const group = anchor.equivalence_key ? getGroup(anchor.equivalence_key) : null

  const members = anchor.equivalence_key ? getGroupMembers(anchor.equivalence_key) : []
  const alternatives = applyFilters(members.filter((m) => m.drug_code !== anchor.drug_code), filters)

  // Filters apply here too. They used to be applied only to the alternatives, so setting
  // "Under $10" emptied the Alternatives section and then listed an $11.18 and a $12.60 product
  // directly underneath it — the filter visibly working in one half of the page and not the other.
  // Filter BEFORE the cap, or a 20-item slice is taken from the unfiltered list and most of what
  // survives is thrown away.
  const inGroup = new Set(members.map((m) => m.drug_code))
  const otherMatches = applyFilters(
    matches.filter((m) => !inGroup.has(m.drug_code)),
    filters,
  ).slice(0, 20)

  return { query, branded: anchor, alternatives, group, otherMatches }
}
