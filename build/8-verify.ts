/**
 * Step 8 — the checks that gate the build.
 *
 * These are the invariants that, if they break, make the app wrong rather than ugly. Most of them
 * encode something the feasibility research got wrong on the first pass, so they are written to
 * fail loudly rather than degrade quietly.
 */
import * as path from 'node:path'
import Database from 'better-sqlite3'
import { ASSETS, OUT, readJson } from './lib/paths.ts'
import { log } from './lib/log.ts'

interface Row { [k: string]: unknown }

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) log.ok(name)
  else { log.fail(`${name}${detail ? ` — ${detail}` : ''}`); failures++ }
}

function main() {
  const db = new Database(path.join(ASSETS, 'medisense.db'), { readonly: true })
  const one = <T,>(sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as T
  const all = <T,>(sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as T[]
  const count = (sql: string, ...p: unknown[]) => (one<{ n: number }>(`SELECT count(*) n FROM (${sql})`, ...p)).n

  log.step('ADR-004 — equivalence is ingredient ∩ route ∩ form ∩ non-prescription')

  // A group must never span more than one route or dosage form. This is the constraint that keeps
  // the app from offering a suppository as a swap for a caplet.
  const spanning = all<Row>(`
    SELECT equivalence_key, count(DISTINCT form) f, count(DISTINCT route) r
    FROM product WHERE equivalence_key IS NOT NULL
    GROUP BY equivalence_key HAVING f > 1 OR r > 1`)
  check('no equivalence group spans a route or dosage form', spanning.length === 0,
    spanning.slice(0, 3).map((s) => String(s.equivalence_key)).join(', '))

  // Every product in the catalogue is marketed and non-prescription — no group should be able to
  // recommend a prescription drug as an OTC alternative.
  check('every product has a DIN', count('SELECT 1 FROM product WHERE din IS NULL OR din = \'\'') === 0)
  log.step('ADR-017 — every price in the app is real, or absent')

  // The inverse of the old gate. There used to be a check that EVERY product had a price, which
  // was satisfiable only by generating one. The gate now asserts the opposite property: that no
  // price exists unless a government published it, and that each carries the basis that makes it
  // readable.
  const priced = count('SELECT 1 FROM product WHERE benefit_price IS NOT NULL')
  log.info(`${priced} of ${count('SELECT 1 FROM product')} products carry a real government price`)
  check('at least one real price survived the join', priced > 0)

  const bad = db.prepare(
    'SELECT din, benefit_price FROM product WHERE benefit_price IS NOT NULL',
  ).all() as { din: string; benefit_price: string }[]
  const parsed = bad.map((r) => ({ din: r.din, p: JSON.parse(r.benefit_price) }))
  check('every price is tied to its own DIN',
    parsed.every((r) => r.p.din === r.din))
  check('every price is a positive amount',
    parsed.every((r) => Number.isFinite(r.p.amountPerUnit) && r.p.amountPerUnit > 0))
  check('every price names a jurisdiction we actually licensed',
    parsed.every((r) => r.p.jurisdiction === 'ON' || r.p.jurisdiction === 'NS'))
  // The basis is what stops a payer price being read as a shelf price. It is not optional and it
  // is not a tooltip — if it is ever empty, the number must not ship.
  check('every price carries a non-empty basis and source',
    parsed.every((r) => String(r.p.basis || '').length > 40 && String(r.p.source || '').length > 10))
  // Government prices must disclaim being shelf prices. Observed ones ARE shelf prices, so the
  // rule is per-source: a payer price without the disclaimer is dangerous; an observed price with
  // it would be a lie in the other direction.
  check('every payer price says it is not a shelf price',
    parsed.filter((r) => r.p.jurisdiction !== 'OBS').every((r) => /[Nn]ot a shelf price/.test(r.p.basis)))

  /*
   * Hand-observed prices (ADR-018). These are the only retail prices in the project and the only
   * ones a person entered by hand, so they get the strictest gate: a price with no pack size is
   * not comparable to anything, and a price with no store, date or observer cannot be checked by
   * a reader — which is the entire reason this route is acceptable where scraping was not.
   */
  const obs = parsed.filter((r) => r.p.jurisdiction === 'OBS')
  if (obs.length) {
    check('every observed price names a pack size and unit',
      obs.every((r) => r.p.pack && Number.isInteger(r.p.pack.size) && r.p.pack.size > 0 && !!r.p.pack.unit))
    check('every observed price names a store, city, date and observer',
      obs.every((r) => r.p.observed && r.p.observed.store && r.p.observed.city
        && /^\d{4}-\d{2}-\d{2}$/.test(r.p.observed.on) && r.p.observed.by))
    check('every observed price is a plausible retail amount',
      obs.every((r) => r.p.amountPerUnit > 0 && r.p.amountPerUnit < 200))
  }
  log.info(`${obs.length} hand-observed shelf prices`)

  check('no product claims a saving without a ratio',
    count('SELECT 1 FROM product WHERE odb_citation IS NOT NULL AND odb_ratio_pct IS NULL') === 0)

  log.step('Golden searches — the flows a demo will actually walk through')
  // Mirrors buildResultSet() in src/lib/repo.ts: the branded card is the best-known BRAND among
  // the matches, not simply the top-ranked row. Ranking on relevance alone puts "Infants' Tylenol"
  // above "Tylenol Regular Strength" for the query "tylenol", which is not the product a shopper
  // meant and would show them a 2-member group instead of a 15-member one.
  // Mirrors buildResultSet() in src/lib/repo.ts: take the matches in RELEVANCE order, then pick
  // the first recognisable brand among them. Relevance alone puts "Infants' Tylenol" on top for
  // "tylenol"; brand-rank alone puts "Advil Flu" on top for "advil". The app does both, in order.
  const search = db.prepare(`
    SELECT p.display_name, p.equivalence_key, p.brand_rank FROM product_fts f
    JOIN product p ON p.drug_code = f.drug_code
    WHERE product_fts MATCH ? ORDER BY rank LIMIT 40`)
  const members = db.prepare('SELECT display_name, is_branded FROM product WHERE equivalence_key = ?')

  for (const [query, minAlternatives] of [
    ['advil', 8], ['tylenol', 10], ['claritin', 3], ['benadryl', 3], ['ibuprofen', 8],
  ] as [string, number][]) {
    const rows = search.all(query) as { display_name: string; equivalence_key: string; brand_rank: number }[]
    const sizeOf = (k: string) =>
      k ? (one<{ n: number }>('SELECT member_count n FROM eq_group WHERE key = ?', k)?.n ?? 1) : 1
    const isVariant = (n: string) => /\b(INFANTS?|CHILDRENS?|KIDS?|JUNIOR|BABY)\b/i.test(n)
    const score = (r: { display_name: string; equivalence_key: string }) =>
      (isVariant(r.display_name) ? 0 : 1000) + sizeOf(r.equivalence_key)
    const brands = rows.filter((r) => r.brand_rank === 3)
    const hit = (brands.length ? [...brands].sort((a, b) => score(b) - score(a))[0] : undefined) ?? rows[0]
    if (!hit) { check(`"${query}" returns a product`, false); continue }
    const m = hit.equivalence_key ? (members.all(hit.equivalence_key) as Row[]) : []
    check(`"${query}" -> ${hit.display_name} with ${m.length - 1} alternatives`,
      m.length - 1 >= minAlternatives, `expected at least ${minAlternatives}`)
  }

  // Singletons are real and the UI must handle them — Reactine and Pepcid AC genuinely have none.
  const singles = count(`
    SELECT 1 FROM eq_group WHERE has_alternatives = 0`)
  log.info(`${singles} groups have no alternatives — the "no alternatives listed" state is load-bearing`)

  // ---- Regression guards for what the audit found. Each of these shipped once. ----
  log.step('Audit regressions')
  const shipped = readJson<{
    products: { drug_code: number; din: string; brand_name: string; ingredient_label: string; odb_citation: string | null; odb_ratio_pct: number | null; bases: string[] }[]
    groups: { key: string; members: number[] }[]
    symptoms: { id: string; classes: { className: string; products: number[] }[] }[]
    redFlags: { id: string; pattern: string }[]
    facts: Record<string, { single_ingredient: number }>
  }>(path.join(ASSETS, 'medisense.json'))

  // Products must render their OWN ingredients, never the group anchor's.
  const cat = readJson<{ drugCode: number; ingredientLabel: string }[]>(
    path.join(OUT, 'catalogue.json'))
  const ownLabel = new Map(cat.map((p) => [p.drugCode, p.ingredientLabel]))
  const leaked = shipped.products.filter((p) => ownLabel.get(p.drug_code) !== p.ingredient_label)
  check('every product shows its own ingredient label, not its group\'s', leaked.length === 0,
    leaked.slice(0, 3).map((p) => `${p.brand_name}: ${p.ingredient_label} vs ${ownLabel.get(p.drug_code)}`).join(' | '))

  // Members of one group must DISPLAY the same ingredients, not merely normalise to the same key.
  // Order and trailing zeros differed, so Robaxacet and Tylenol Back Pain — the same formulation —
  // read as different things sitting next to each other in an Alternatives list.
  const byCode = new Map(shipped.products.map((p) => [p.drug_code, p]))
  const inconsistent = shipped.groups.filter((g) =>
    g.members.length > 1 &&
    new Set(g.members.map((m) => byCode.get(m)?.ingredient_label)).size > 1)
  check('every group displays one consistent ingredient label', inconsistent.length === 0,
    inconsistent.slice(0, 2).map((g) => g.key).join(' | '))

  // Withdrawn ingredients must never ship, whatever DPD's status column says.
  const withdrawn = shipped.products.filter((p) => p.bases.some((b) => /RANITIDINE|PHENOLPHTHALEIN|ATTAPULGITE/.test(b)))
  check('no withdrawn ingredient ships', withdrawn.length === 0,
    withdrawn.map((p) => p.brand_name).join(', '))

  /*
   * A 100% ratio is now ALLOWED to ship, and this gate changed direction accordingly.
   *
   * It used to forbid any citation at or above 95%, because those ratios had been computed
   * generic-vs-generic and so said nothing about brand savings. Step 4 now only marks a ratio
   * citable when the expensive side is genuinely a brand (`brandSideIsBranded`), so a 100% here is
   * a real finding — Ontario lists the generic at the same price as the brand — and SavingNote
   * renders it as "No saving here" rather than dressing it up.
   *
   * What must still never happen is a citation with no ratio behind it, or a ratio that implies a
   * saving the formulary does not support.
   */
  const badCite = shipped.products.filter(
    (p) => p.odb_citation && (p.odb_ratio_pct == null || p.odb_ratio_pct <= 0 || p.odb_ratio_pct > 100),
  )
  check('every ODB citation has a ratio in range', badCite.length === 0, `${badCite.length} products`)
  const nonSaving = shipped.products.filter((p) => p.odb_citation && (p.odb_ratio_pct ?? 0) >= 99)
  log.info(`${nonSaving.length} products cite a formulary ratio showing NO saving — shown as such`)

  // Red-flag patterns must compile, catch the phrasings people type, and not fire on innocents.
  let flagOk = true
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const res = shipped.redFlags.map((f) => ({ id: f.id, re: new RegExp(f.pattern, 'i') }))
  const fires = (q: string) => res.some((r) => r.re.test(norm(q)))
  for (const q of [
    'chest pain', 'crushing pain in my chest', 'cant breathe', "can't breathe", 'short of breath',
    'coughing up blood', 'bloody diarrhea', 'blood in my stools', 'black tarry stools',
    'worst headache of my life', 'face is drooping', 'i fainted', 'took 20 tylenol',
  ]) if (!fires(q)) { flagOk = false; log.fail(`red flag MISSED: "${q}"`) }
  for (const q of ['heat stroke', 'food poisoning', 'headache', 'chest congestion', 'stool softener'])
    if (fires(q)) { flagOk = false; log.fail(`red flag FALSE POSITIVE: "${q}"`) }
  check('red-flag matcher catches the dangerous phrasings and no innocent ones', flagOk)

  // Warnings may only come from a label whose single active substance is that ingredient.
  const multiFact = Object.entries(shipped.facts).filter(([, f]) => !f.single_ingredient).length
  log.info(`${multiFact} ingredients matched only a combination label — their warnings are withheld in the app`)

  log.step('Runtime dataset matches the database')
  const json = readJson<{ products: unknown[]; pharmacies: unknown[]; groups: unknown[] }>(
    path.join(ASSETS, 'medisense.json'))
  check('product count matches', json.products.length === count('SELECT 1 FROM product'),
    `json ${json.products.length} vs db ${count('SELECT 1 FROM product')}`)
  check('pharmacy count matches', json.pharmacies.length === count('SELECT 1 FROM pharmacy'))
  check('group count matches', json.groups.length === count('SELECT 1 FROM eq_group'))

  db.close()

  if (failures) { log.fail(`${failures} check(s) failed`); process.exit(1) }
  log.done('all checks passed')
}

main()
