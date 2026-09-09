/**
 * Step 3 — OTC Drug Facts prose from openFDA.
 *
 * DPD carries no indication, usage or warning text at all, so the product-detail accordions
 * ("About this product", "Ingredients", "Use") have nothing to show without this.
 *
 * THREE TRAPS, all silent:
 *  0. limit=1 on a phrase match returns an arbitrary label, and a COMBINATION product matches a
 *     single-moiety query. Asking for "dextromethorphan" returned a label whose active ingredients
 *     are acetaminophen + dextromethorphan + phenylephrine, so every plain DM syrup in the app
 *     displayed an acetaminophen liver warning and two ingredients it does not contain. Asking for
 *     "pramoxine" returned a triple-antibiotic ointment naming NEOMYCIN — a leading contact
 *     allergen — on a haemorrhoid product. We now scan a page of results and keep only labels whose
 *     openfda.substance_name is exactly our one ingredient.
 *  1. Vocabulary mismatch. DPD says ACETYLSALICYLIC ACID; openFDA has ZERO OTC labels under that
 *     name and 701 under "aspirin". A pass-through lookup returns nothing and reads as missing
 *     coverage rather than a bug. See INN_TO_USAN in lib/normalize.ts.
 *  2. This is US labelling. It is shown in the app under an explicit "US product labelling, shown
 *     for reference" heading — it is NOT the Canadian monograph.
 *
 * Licence: openFDA is CC0 public domain. Free tier is 1,000 req/day without a key (240/min).
 * We issue one request per distinct ingredient, not per product — ~150 requests.
 */
import * as path from 'node:path'
import { OPENFDA_DIR, OUT, ensure, writeJson, readJson, exists } from './lib/paths.ts'
import { log } from './lib/log.ts'
import { getJson, sleep } from './lib/net.ts'
import { toUsan } from './lib/normalize.ts'
import type { CatalogueProduct } from './2-build-catalogue.ts'

const API = 'https://api.fda.gov/drug/label.json'

/**
 * The Drug Facts sections we surface. Rendered verbatim — never paraphrased, never summarised.
 *
 * DELIBERATELY ABSENT: `active_ingredient` and `dosage_and_administration`. Both are specific to
 * the US product the label came from, not to the ingredient, so rendering them beside a Canadian
 * product told users the wrong strength and the wrong dose — Infants' Tylenol (80 mg drops) showed
 * "in each gelcap, Acetaminophen 500 mg" and "adults take 2 gelcaps every 6 hours". There is no
 * safe way to show another product's dose, so we do not store it.
 */
const FIELDS = [
  'purpose', 'indications_and_usage', 'warnings', 'do_not_use',
  'ask_doctor', 'ask_doctor_or_pharmacist', 'when_using', 'stop_use',
  'pregnancy_or_breast_feeding', 'keep_out_of_reach_of_children',
] as const

export interface DrugFacts {
  [k: string]: unknown
  ingredient: string
  usanQuery: string
  labelCount: number
  /**
   * True only when the chosen US label has exactly ONE active substance and it is this ingredient.
   * The app renders warning text only in that case — a combination label's warnings cover
   * ingredients the Canadian product may not contain, and omit ones it does.
   */
  singleIngredient: boolean
  /** What the chosen label's substances actually are, so a reviewer can check the match. */
  labelSubstances?: string[]
  purpose?: string
  indications_and_usage?: string
  warnings?: string
  do_not_use?: string
  ask_doctor?: string
  ask_doctor_or_pharmacist?: string
  when_using?: string
  stop_use?: string
  pregnancy_or_breast_feeding?: string
  keep_out_of_reach_of_children?: string
  dosage_and_administration?: string
}

/** Drug Facts text arrives with its own section heading glued on ("Purpose Pain reliever"). */
function clean(v: unknown, heading: string): string | undefined {
  if (!Array.isArray(v) || !v.length) return undefined
  let s = String(v[0]).replace(/\s+/g, ' ').trim()
  const re = new RegExp(`^${heading}s?\\b[:\\s]*`, 'i')
  s = s.replace(re, '').trim()
  return s || undefined
}

async function main() {
  ensure(OPENFDA_DIR, OUT)
  const catalogue = readJson<CatalogueProduct[]>(path.join(OUT, 'catalogue.json'))

  const ingredients = [...new Set(catalogue.flatMap((p) => p.ingredients.map((i) => i.base)))]
    .filter((i) => i.length > 2)
    .sort()
  log.step(`Drug Facts for ${ingredients.length} distinct ingredients`)

  const cache = path.join(OPENFDA_DIR, 'drugfacts.json')
  const facts: Record<string, DrugFacts> = exists(cache) ? readJson(cache) : {}
  let fetched = 0, hits = 0, misses = 0

  for (const ing of ingredients) {
    if (facts[ing]) { if (facts[ing].labelCount > 0) hits++; else misses++; continue }
    const q = toUsan(ing)
    // Scan a page rather than taking the first hit, so we can pick a SINGLE-ingredient label.
    const url =
      `${API}?search=openfda.generic_name:"${encodeURIComponent(q)}"` +
      `+AND+openfda.product_type:"HUMAN+OTC+DRUG"&limit=50`
    try {
      const json = await getJson<{ meta?: { results?: { total?: number } }; results?: any[] }>(url)
      const results = json.results ?? []

      // Exactly one substance, and it is ours. openFDA's substance_name is the authoritative list;
      // generic_name is a free-text string that happily contains three ingredients.
      const wanted = q.toUpperCase()
      const isSingle = (r: any): boolean => {
        const subs: string[] = r?.openfda?.substance_name ?? []
        return subs.length === 1 && subs[0].toUpperCase().includes(wanted.split(' ')[0])
      }
      const chosen = results.find(isSingle)
      const r = chosen ?? results[0]

      const rec: DrugFacts = {
        ingredient: ing,
        usanQuery: q,
        labelCount: json.meta?.results?.total ?? 0,
        singleIngredient: Boolean(chosen),
        labelSubstances: r?.openfda?.substance_name ?? [],
      }
      if (r) {
        for (const f of FIELDS) {
          const heading = f.replace(/_/g, ' ').replace('indications and usage', 'use')
          const v = clean(r[f], heading)
          if (v) rec[f] = v
        }
      }
      facts[ing] = rec
      rec.labelCount > 0 ? hits++ : misses++
    } catch {
      facts[ing] = { ingredient: ing, usanQuery: q, labelCount: 0, singleIngredient: false }
      misses++
    }
    fetched++
    if (fetched % 25 === 0) { log.info(`${fetched}/${ingredients.length}…`); writeJson(cache, facts) }
    await sleep(280) // stay well inside 240 req/min
  }

  writeJson(cache, facts)
  writeJson(path.join(OUT, 'drugfacts.json'), facts)

  const single = Object.values(facts).filter((f) => f.singleIngredient).length
  log.info(`${hits} ingredients with label text, ${misses} without`)
  log.info(`${single} matched a SINGLE-ingredient US label — only these carry warning text into the app`)
  const combo = Object.values(facts).filter((f) => f.labelCount > 0 && !f.singleIngredient)
  if (combo.length) {
    log.warn(`${combo.length} only matched combination labels; their warnings are withheld: ${combo.slice(0, 6).map((f) => f.ingredient).join(', ')}${combo.length > 6 ? '…' : ''}`)
  }
  const noText = ingredients.filter((i) => !facts[i]?.purpose && !facts[i]?.indications_and_usage)
  if (noText.length) log.warn(`no usable prose for ${noText.length}: ${noText.slice(0, 8).join(', ')}${noText.length > 8 ? '…' : ''}`)
  log.done(`${Object.keys(facts).length} ingredients cached`)
}

if (import.meta.filename === process.argv[1]) await main()
