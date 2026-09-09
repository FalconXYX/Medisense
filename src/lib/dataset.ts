/**
 * The catalogue, loaded from the bundled JSON emitted by build step 7.
 *
 * ADR-003 AMENDMENT — this replaces expo-sqlite. Its web support is alpha: the wa-sqlite worker
 * needs SharedArrayBuffer, which needs cross-origin isolation the dev server does not set, and the
 * failure is silent — the app just hangs on its loading state with a clean console.
 *
 * At 838 products a bundled JSON index is instant, identical on every platform, needs no native
 * module and no async boot. Metro inlines it, so there is no fetch and no loading state at all.
 */
import raw from '../../assets/medisense.json'
import type { Product, EqGroup, DrugFactsRow, PharmacyRow } from './types'

interface Dataset {
  meta: Record<string, string>
  products: (Product & { bases: string[] })[]
  groups: (EqGroup & { members: number[] })[]
  facts: Record<string, DrugFactsRow>
  pharmacies: PharmacyRow[]
}

const data = raw as unknown as Dataset

export const meta = data.meta
export const products = data.products
export const pharmacies = data.pharmacies
export const facts = data.facts

export const productByCode = new Map(products.map((p) => [p.drug_code, p]))
export const groupByKey = new Map(data.groups.map((g) => [g.key, g]))

/** equivalence_key -> members, resolved once. */
export const membersByKey = new Map(
  data.groups.map((g) => [
    g.key,
    g.members.map((c) => productByCode.get(c)).filter(Boolean) as Product[],
  ]),
)

/**
 * A tiny inverted index over the fields worth searching, built once at import.
 * This replaces FTS5. Each token maps to the products it appears in, with a weight per field so
 * a brand-name hit outranks a company-name hit.
 */
const WEIGHTS = { brand: 10, ingredient: 6, atc: 3, purpose: 2, company: 1 } as const

export const index = new Map<string, Map<number, number>>()

function addToken(token: string, drugCode: number, weight: number) {
  if (token.length < 2) return
  let bucket = index.get(token)
  if (!bucket) { bucket = new Map(); index.set(token, bucket) }
  bucket.set(drugCode, (bucket.get(drugCode) ?? 0) + weight)
}

export function tokenize(s: string): string[] {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
}

for (const p of products) {
  for (const t of tokenize(p.brand_name)) addToken(t, p.drug_code, WEIGHTS.brand)
  for (const t of tokenize(p.ingredient_label ?? '')) addToken(t, p.drug_code, WEIGHTS.ingredient)
  for (const b of p.bases) for (const t of tokenize(b)) addToken(t, p.drug_code, WEIGHTS.ingredient)
  for (const t of tokenize(p.atc_name ?? '')) addToken(t, p.drug_code, WEIGHTS.atc)
  for (const t of tokenize(p.company)) addToken(t, p.drug_code, WEIGHTS.company)
  // Symptom words live in the label's purpose/uses text — this is what makes "headache" work.
  for (const b of p.bases) {
    const f = facts[b]
    if (!f) continue
    for (const t of tokenize(`${f.purpose ?? ''} ${f.indications_and_usage ?? ''}`)) {
      addToken(t, p.drug_code, WEIGHTS.purpose)
    }
  }
}

/** Prefix lookup so results appear while the user is still typing. */
const allTokens = [...index.keys()].sort()

export function tokensWithPrefix(prefix: string): string[] {
  if (prefix.length < 2) return []
  const out: string[] = []
  for (const t of allTokens) {
    if (t.startsWith(prefix)) out.push(t)
    else if (out.length && t > prefix) break
  }
  return out.slice(0, 40)
}
