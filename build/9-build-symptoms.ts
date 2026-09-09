/**
 * Step 9 — resolve the curated symptom taxonomy against the real catalogue.
 *
 * ADR-008. The table in build/data/symptoms.ts is hand-written; this step proves every row of it
 * actually resolves to marketed Canadian non-prescription products, and FAILS THE BUILD if not.
 * That is the guard against the failure mode the research found: six plausible-looking ingredients
 * (docosanol, meclizine, attapulgite, dyclonine, terbinafine, adapalene) have zero Canadian OTC
 * products, and a symptom row built on them ships an empty results screen.
 *
 * It also cross-checks each row's declared ATC prefix against the catalogue's own ATC code, which
 * catches a curation mistake automatically rather than at demo time.
 */
import * as path from 'node:path'
import { OUT, writeJson, readJson } from './lib/paths.ts'
import { log, assert } from './lib/log.ts'
import { SYMPTOMS, RED_FLAGS, CAUTIONS } from './data/symptoms.ts'
import type { CatalogueProduct, EquivalenceGroup } from './2-build-catalogue.ts'

/**
 * Paediatric and specialty variants must not lead a symptom's results. Someone tapping "Headache"
 * wants Tylenol Extra Strength, not Children's Tylenol Chewables — same rule the search anchor
 * uses in src/lib/repo.ts.
 */
const VARIANT = /\b(INFANTS?|CHILDRENS?|KIDS?|JUNIOR|BABY|NIGHT|NIGHTTIME|PM)\b/i

export interface ResolvedSymptom {
  id: string
  label: string
  synonyms: string[]
  bodyArea: string
  seeSomeoneAfter: string
  source: { title: string; kind: string }
  classes: {
    className: string
    rank: number
    ingredients: string[]
    /**
     * drug_codes, SINGLE-INGREDIENT FIRST, then branded, then cheapest.
     * Someone searching "headache" wants plain acetaminophen, not a seven-ingredient cold and flu
     * capsule that happens to contain some. Ranking never mixes classes — see ADR-008.
     */
    products: number[]
    /** How many of those are single-active-ingredient products. */
    singleIngredientCount: number
  }[]
  productCount: number
}

function main() {
  const catalogue = readJson<CatalogueProduct[]>(path.join(OUT, 'catalogue.json'))
  const groups = readJson<EquivalenceGroup[]>(path.join(OUT, 'groups.json'))
  const groupSize = new Map(groups.map((g) => [g.key, g.members.length]))
  const byBase = new Map<string, CatalogueProduct[]>()
  for (const p of catalogue) {
    for (const b of new Set(p.ingredients.map((i) => i.base))) {
      const a = byBase.get(b)
      if (a) a.push(p); else byBase.set(b, [p])
    }
  }

  log.step(`Resolving ${SYMPTOMS.length} symptoms against ${catalogue.length} products`)
  const resolved: ResolvedSymptom[] = []
  const problems: string[] = []
  const atcMismatches: string[] = []

  for (const s of SYMPTOMS) {
    // Group the symptom's ingredients by their medicine class, preserving rank.
    const classes = new Map<string, { className: string; rank: number; ingredients: string[]; products: Set<number> }>()

    for (const si of s.ingredients) {
      const hits = byBase.get(si.ingredient) ?? []
      if (!hits.length) {
        problems.push(`${s.id}: "${si.ingredient}" resolves to NO marketed Canadian OTC product`)
        continue
      }
      // THE ATC GATE IS ENFORCED, not merely reported. Containing an ingredient is not the same
      // as being a product for this symptom: mouthwash lists cetylpyridinium, so it was appearing
      // under "sore throat"; oral cough syrups list menthol, so 16 of the 18 products under
      // "topical counterirritant" for muscle pain were syrups; a rectal suppository led
      // "anti-itch anaesthetic". Health Canada's own ATC classification already encodes what a
      // product IS FOR, so we trust it over ingredient containment.
      const agreeing = hits.filter((p) => p.atcNumber.startsWith(si.atcPrefix))
      if (!agreeing.length) {
        atcMismatches.push(
          `${s.id}/${si.ingredient}: declared ATC ${si.atcPrefix}, catalogue has ${[...new Set(hits.map((h) => h.atcNumber.slice(0, 3)))].join('/')} — DROPPED`,
        )
        continue
      }
      const key = si.className
      const entry = classes.get(key) ?? { className: si.className, rank: si.rank, ingredients: [], products: new Set<number>() }
      entry.ingredients.push(si.ingredient)
      entry.rank = Math.min(entry.rank, si.rank)
      for (const p of agreeing) entry.products.add(p.drugCode)
      classes.set(key, entry)
    }

    const byCode = new Map(catalogue.map((p) => [p.drugCode, p]))
    const out = [...classes.values()]
      .map((c) => {
        const size = (p: CatalogueProduct) => (p.equivalenceKey ? groupSize.get(p.equivalenceKey) ?? 1 : 1)
        const products = [...c.products].sort((x, y) => {
          const a = byCode.get(x)!, b = byCode.get(y)!
          // 1. plain single-ingredient products before combinations
          if ((a.numberOfAis === 1) !== (b.numberOfAis === 1)) return a.numberOfAis === 1 ? -1 : 1
          // 2. adult/standard formulations before paediatric and night-time variants
          const va = VARIANT.test(a.brandName), vb = VARIANT.test(b.brandName)
          if (va !== vb) return va ? 1 : -1
          // 3. a recognisable brand as the anchor of each class
          if (a.isBranded !== b.isBranded) return a.isBranded ? -1 : 1
          // 4. the more widely genericised product is the more mainstream one
          return size(b) - size(a) || a.numberOfAis - b.numberOfAis || a.brandName.localeCompare(b.brandName)
        })
        return {
          className: c.className,
          rank: c.rank,
          ingredients: c.ingredients,
          products,
          singleIngredientCount: products.filter((d) => byCode.get(d)!.numberOfAis === 1).length,
        }
      })
      .sort((a, b) => a.rank - b.rank)

    const productCount = out.reduce((n, c) => n + c.products.length, 0)
    if (productCount === 0) problems.push(`${s.id}: resolves to ZERO products overall`)

    resolved.push({
      id: s.id, label: s.label, synonyms: s.synonyms, bodyArea: s.bodyArea,
      seeSomeoneAfter: s.seeSomeoneAfter, source: s.source,
      classes: out, productCount,
    })
  }

  for (const r of resolved) {
    const single = r.classes.reduce((n, c) => n + c.singleIngredientCount, 0)
    log.info(`${r.label.padEnd(34)} ${String(r.productCount).padStart(4)} products (${String(single).padStart(3)} single-ingredient) in ${r.classes.length} class${r.classes.length === 1 ? '' : 'es'}`)
    // A first-line class with no plain product means the user is only ever offered combinations.
    for (const c of r.classes.filter((c) => c.rank === 1 && c.singleIngredientCount === 0)) {
      log.warn(`  ${r.id}: first-line class "${c.className}" has no single-ingredient product`)
    }
  }

  if (atcMismatches.length) {
    log.step('Ingredients dropped because the catalogue disagrees with their declared class')
    for (const m of atcMismatches) log.warn(m)
  }

  if (problems.length) {
    log.step('FAILURES')
    for (const p of problems) log.fail(p)
  }
  assert(problems.length === 0, `${problems.length} symptom row(s) resolve to nothing — fix build/data/symptoms.ts`)

  writeJson(path.join(OUT, 'symptoms.json'), { symptoms: resolved, redFlags: RED_FLAGS, cautions: CAUTIONS })
  log.done(`${resolved.length} symptoms, ${resolved.reduce((n, r) => n + r.productCount, 0)} product links`)
}

main()
