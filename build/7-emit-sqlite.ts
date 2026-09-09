/**
 * Step 7 — emit assets/medisense.db, the bundled SQLite index the app ships with.
 *
 * ADR-003. Every search the app performs is a local FTS5 query: no network, no cold start, works
 * offline, and immune to any upstream going down mid-demo. The study measured 42.51 s for search
 * tasks; this makes the data side of that number effectively zero.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import Database from 'better-sqlite3'
import { OUT, ASSETS, ensure, readJson } from './lib/paths.ts'
import { log, assert } from './lib/log.ts'
import { baseIngredient } from './lib/normalize.ts'
import type { CatalogueProduct, EquivalenceGroup } from './2-build-catalogue.ts'
import type { Pharmacy } from './5-fetch-pharmacies.ts'
import type { DrugFacts } from './3-fetch-openfda.ts'
import type { BenefitPrice } from './6-build-prices.ts'
import { ODB_EDITION } from './4-fetch-odb.ts'

const SCHEMA = `
PRAGMA journal_mode = DELETE;

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE product (
  drug_code       INTEGER PRIMARY KEY,
  din             TEXT NOT NULL UNIQUE,
  brand_name      TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  company         TEXT NOT NULL,
  ai_group_no     TEXT,
  equivalence_key TEXT,
  atc_number      TEXT,
  atc_name        TEXT,
  form            TEXT,
  route           TEXT,
  ingredient_label TEXT,
  is_branded      INTEGER NOT NULL,
  brand_rank      INTEGER NOT NULL,
  benefit_price   TEXT,
  odb_ratio_pct   REAL,
  odb_citation    TEXT
);
CREATE INDEX idx_product_eq   ON product(equivalence_key);
CREATE INDEX idx_product_din  ON product(din);
CREATE INDEX idx_product_atc  ON product(atc_number);

CREATE TABLE ingredient (
  drug_code  INTEGER NOT NULL REFERENCES product(drug_code),
  name       TEXT NOT NULL,
  base       TEXT NOT NULL,
  strength   TEXT,
  unit       TEXT
);
CREATE INDEX idx_ingredient_base ON ingredient(base);
CREATE INDEX idx_ingredient_drug ON ingredient(drug_code);

CREATE TABLE eq_group (
  key              TEXT PRIMARY KEY,
  ai_group_no      TEXT NOT NULL,
  route            TEXT NOT NULL,
  form             TEXT NOT NULL,
  ingredient_label TEXT NOT NULL,
  brand_anchor     INTEGER,
  member_count     INTEGER NOT NULL,
  has_alternatives INTEGER NOT NULL
);

CREATE TABLE drug_facts (
  base                        TEXT PRIMARY KEY,
  label_count                 INTEGER NOT NULL,
  single_ingredient           INTEGER NOT NULL,
  label_substances            TEXT,
  purpose                     TEXT,
  indications_and_usage       TEXT,
  warnings                    TEXT,
  do_not_use                  TEXT,
  ask_doctor                  TEXT,
  ask_doctor_or_pharmacist    TEXT,
  when_using                  TEXT,
  stop_use                    TEXT,
  pregnancy_or_breast_feeding TEXT,
  keep_out_of_reach_of_children TEXT
);

CREATE TABLE pharmacy (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  brand    TEXT,
  lat      REAL NOT NULL,
  lng      REAL NOT NULL,
  address  TEXT,
  phone    TEXT,
  hours    TEXT,
  postcode TEXT
);

-- Search index. Unindexed drug_code so we can join straight back to product.
CREATE VIRTUAL TABLE product_fts USING fts5(
  brand_name, ingredients, company, atc_name, purpose,
  drug_code UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
`

function main() {
  ensure(ASSETS)
  const catalogue = readJson<CatalogueProduct[]>(path.join(OUT, 'catalogue.json'))
  const groups = readJson<EquivalenceGroup[]>(path.join(OUT, 'groups.json'))
  const pharmacies = readJson<Pharmacy[]>(path.join(OUT, 'pharmacies.json'))
  const facts = readJson<Record<string, DrugFacts>>(path.join(OUT, 'drugfacts.json'))
  // Real government prices only, keyed by DIN. ~91% of products have none, and get null.
  const prices = readJson<{ prices: BenefitPrice[] }>(path.join(OUT, 'prices.json'))
  const priceByDin = new Map(prices.prices.map((p) => [p.din, p]))
  const groupByKey = new Map(groups.map((g) => [g.key, g]))

  // The citable brand:generic ratios (step 4). These are per-INGREDIENT, so they attach to every
  // product of that ingredient rather than to a DIN — they are a statement about the ingredient's
  // market, not about one package.
  const ratios = readJson<{ citable: { ingredient: string; ratioPct: number; brandName: string; genericName: string }[] }>(
    path.join(OUT, 'odb-ratios.json'),
  )
  const ratioByIngredient = new Map(
    ratios.citable.map((r) => [
      r.ingredient,
      {
        pct: r.ratioPct,
        cite: `${r.brandName} vs ${r.genericName}, Ontario Drug Benefit Formulary Edition ${ODB_EDITION.edition}`,
      },
    ]),
  )

  const dbPath = path.join(ASSETS, 'medisense.db')
  fs.rmSync(dbPath, { force: true })
  const db = new Database(dbPath)
  db.exec(SCHEMA)

  log.step('Writing tables')
  const insProduct = db.prepare(`INSERT INTO product VALUES
    (@drug_code,@din,@brand_name,@display_name,@company,@ai_group_no,@equivalence_key,@atc_number,
     @atc_name,@form,@route,@ingredient_label,@is_branded,@brand_rank,@benefit_price,@odb_ratio_pct,@odb_citation)`)
  const insIngredient = db.prepare('INSERT INTO ingredient VALUES (?,?,?,?,?)')
  const insFts = db.prepare('INSERT INTO product_fts VALUES (?,?,?,?,?,?)')
  const insGroup = db.prepare('INSERT INTO eq_group VALUES (?,?,?,?,?,?,?,?)')
  const insFacts = db.prepare(`INSERT INTO drug_facts VALUES
    (@base,@label_count,@single_ingredient,@label_substances,@purpose,@indications_and_usage,
     @warnings,@do_not_use,@ask_doctor,@ask_doctor_or_pharmacist,@when_using,@stop_use,
     @pregnancy_or_breast_feeding,@keep_out_of_reach_of_children)`)
  const insPharmacy = db.prepare('INSERT INTO pharmacy VALUES (?,?,?,?,?,?,?,?,?)')
  const insMeta = db.prepare('INSERT INTO meta VALUES (?,?)')

  db.transaction(() => {
    for (const p of catalogue) {
      const price = priceByDin.get(p.din) ?? null
      const grp = p.equivalenceKey ? groupByKey.get(p.equivalenceKey) : undefined
      insProduct.run({
        drug_code: p.drugCode, din: p.din, brand_name: p.brandName, display_name: p.displayName,
        company: p.company, ai_group_no: p.aiGroupNo || null, equivalence_key: p.equivalenceKey,
        atc_number: p.atcNumber || null, atc_name: p.atcName || null,
        form: p.forms.join(' / ') || null, route: p.routes.join(' / ') || null,
        // The product's OWN ingredients. Falling back to the GROUP's label made 8 products show
        // 2x to 225x the wrong strength — Koffex DM (15 mg) displayed 30MG, and two Benylin
        // products displayed exactly double all five of their ingredients.
        ingredient_label: p.ingredientLabel,
        is_branded: p.isBranded ? 1 : 0, brand_rank: p.brandRank,
        benefit_price: price ? JSON.stringify(price) : null,
        odb_ratio_pct: ratioByIngredient.get(p.ingredients[0]?.base ?? '')?.pct ?? null,
        odb_citation: ratioByIngredient.get(p.ingredients[0]?.base ?? '')?.cite ?? null,
      })
      for (const i of p.ingredients) insIngredient.run(p.drugCode, i.name, i.base, i.strength, i.unit)

      const bases = [...new Set(p.ingredients.map((i) => i.base))]
      const purpose = bases.map((b) => facts[b]?.purpose).filter(Boolean).join(' ')
      insFts.run(
        p.brandName,
        bases.concat(p.ingredients.map((i) => i.name)).join(' '),
        p.company, p.atcName ?? '', purpose, p.drugCode,
      )
    }
    for (const g of groups) {
      insGroup.run(g.key, g.aiGroupNo, g.route, g.form, g.ingredientLabel,
        g.brandAnchor, g.members.length, g.hasAlternatives ? 1 : 0)
    }
    for (const [base, f] of Object.entries(facts)) {
      insFacts.run({
        base, label_count: f.labelCount,
        single_ingredient: f.singleIngredient ? 1 : 0,
        label_substances: (f.labelSubstances ?? []).join(', '),
        purpose: f.purpose ?? null, indications_and_usage: f.indications_and_usage ?? null,
        warnings: f.warnings ?? null,
        do_not_use: f.do_not_use ?? null, ask_doctor: f.ask_doctor ?? null,
        ask_doctor_or_pharmacist: f.ask_doctor_or_pharmacist ?? null,
        when_using: f.when_using ?? null, stop_use: f.stop_use ?? null,
        pregnancy_or_breast_feeding: f.pregnancy_or_breast_feeding ?? null,
        keep_out_of_reach_of_children: f.keep_out_of_reach_of_children ?? null,
      })
    }
    for (const p of pharmacies) {
      insPharmacy.run(p.id, p.name, p.brand, p.lat, p.lng, p.address, p.phone, p.hours, p.postcode)
    }

    // Provenance. Rendered in the app's "How we checked this" and "How prices are estimated".
    const meta: Record<string, string> = {
      built_at: new Date().toISOString().slice(0, 10),
      drug_source: 'Health Canada Drug Product Database',
      drug_source_url: 'https://health-products.canada.ca/api/documentation/dpd-documentation-en.html',
      drug_licence: 'Open Government Licence – Canada 2.0',
      label_source: 'openFDA Drug Label API (US labelling, shown for reference)',
      label_licence: 'CC0 1.0 Public Domain',
      pharmacy_source: 'OpenStreetMap via Overpass API',
      pharmacy_licence: 'ODbL 1.0 — © OpenStreetMap contributors',
      price_source: `Ontario Drug Benefit Formulary Edition ${ODB_EDITION.edition} (${ODB_EDITION.createDate})`,
      price_source_url: ODB_EDITION.url,
      price_licence: ODB_EDITION.licence,
      price_disclaimer:
        'Estimated prices. Not retail prices. No Canadian pharmacy publishes shelf prices and ' +
        'MediSense has no access to them.',
      equivalence_rule: 'Health Canada Active Ingredient Group number, intersected with route of administration and dosage form.',
    }
    for (const [k, v] of Object.entries(meta)) insMeta.run(k, v)
  })()

  db.exec('INSERT INTO product_fts(product_fts) VALUES (\'optimize\')')
  db.exec('VACUUM')

  const count = (t: string) => (db.prepare(`SELECT count(*) n FROM ${t}`).get() as { n: number }).n
  for (const t of ['product', 'ingredient', 'eq_group', 'drug_facts', 'pharmacy', 'meta']) {
    log.info(`${t.padEnd(12)} ${String(count(t)).padStart(6)} rows`)
  }

  log.step('Smoke tests')
  const search = db.prepare(`
    SELECT p.display_name, p.ingredient_label, p.benefit_price, p.is_branded
    FROM product_fts f JOIN product p ON p.drug_code = f.drug_code
    WHERE product_fts MATCH ? ORDER BY rank LIMIT 3`)
  for (const q of ['advil', 'ibuprofen', 'loratadine', 'heartburn']) {
    const rows = search.all(q) as { display_name: string; benefit_price: string | null }[]
    log.info(`"${q}" -> ${rows.map((r) => `${r.display_name}${r.benefit_price ? ' [priced]' : ''}`).join(', ') || '(none)'}`)
  }

  const size = fs.statSync(dbPath).size
  assert(size < 8 * 1024 * 1024, `database is ${(size / 1024 / 1024).toFixed(1)} MB — too large to bundle`)
  db.close()
  log.info(`assets/medisense.db — ${(size / 1024 / 1024).toFixed(2)} MB (inspection + step 8 checks)`)

  // ---- The runtime dataset ----
  log.step('Emitting the runtime JSON dataset')
  const dataset = {
    meta: Object.fromEntries(
      Object.entries({
        built_at: new Date().toISOString().slice(0, 10),
        drug_source: 'Health Canada Drug Product Database',
        drug_source_url: 'https://health-products.canada.ca/api/documentation/dpd-documentation-en.html',
        drug_licence: 'Open Government Licence – Canada 2.0',
        label_source: 'openFDA Drug Label API (US labelling, shown for reference)',
        label_licence: 'CC0 1.0 Public Domain',
        pharmacy_source: 'OpenStreetMap via Overpass API',
        pharmacy_licence: 'ODbL 1.0 — © OpenStreetMap contributors',
        price_source: `Ontario Drug Benefit Formulary Edition ${ODB_EDITION.edition} (${ODB_EDITION.createDate})`,
        price_source_url: ODB_EDITION.url,
        price_licence: ODB_EDITION.licence,
        price_disclaimer:
          'Estimated prices. Not retail prices. No Canadian pharmacy publishes shelf prices and ' +
          'MediSense has no access to them.',
        equivalence_rule:
          'Health Canada Active Ingredient Group number, intersected with route of administration and dosage form.',
      }),
    ),
    products: catalogue.map((p) => {
      const price = priceByDin.get(p.din) ?? null
      const bases = [...new Set(p.ingredients.map((i) => i.base))]
      // "Purpose" on the card must say what the medicine DOES. The ATC class name is just the
      // ingredient again ("Purpose: Ibuprofen"), so prefer the label's own purpose line.
      const purpose =
        bases.map((b) => facts[b]?.purpose).find(Boolean) ??
        (p.atcName && !bases.some((b) => p.atcName.toUpperCase().includes(b)) ? p.atcName : null)
      return {
        drug_code: p.drugCode,
        purpose,
        din: p.din,
        brand_name: p.brandName,
        display_name: p.displayName,
        company: p.company,
        ai_group_no: p.aiGroupNo || null,
        equivalence_key: p.equivalenceKey,
        atc_number: p.atcNumber || null,
        atc_name: p.atcName || null,
        form: p.forms.join(' / ') || null,
        route: p.routes.join(' / ') || null,
        ingredient_label: p.ingredientLabel,
        is_branded: p.isBranded ? 1 : 0,
        brand_rank: p.brandRank,
        // Recognition rank from the KNOWN_BRANDS list. Drives which brands the landing screen
        // offers as suggestions — ordering by drug_code surfaces whichever DINs are oldest,
        // which is how the first build ended up suggesting Senokot and Lacri-Lube.
        brand_index: Number.isFinite(p.signals.brandIndex) ? p.signals.brandIndex : 9999,
        benefit_price: price,
        odb_ratio_pct: ratioByIngredient.get(p.ingredients[0]?.base ?? '')?.pct ?? null,
        odb_citation: ratioByIngredient.get(p.ingredients[0]?.base ?? '')?.cite ?? null,
        bases,
      }
    }),
    groups: groups.map((g) => ({
      key: g.key,
      ai_group_no: g.aiGroupNo,
      route: g.route,
      form: g.form,
      ingredient_label: g.ingredientLabel,
      brand_anchor: g.brandAnchor,
      member_count: g.members.length,
      has_alternatives: g.hasAlternatives ? 1 : 0,
      members: g.members,
    })),
    facts: Object.fromEntries(
      Object.entries(facts).filter(([, f]) => f.labelCount > 0).map(([k, f]) => [k, {
        base: k,
        label_count: f.labelCount,
        // Only a label whose sole active substance IS this ingredient may carry warnings into the
        // app. A combination label's warnings cover ingredients the Canadian product may not
        // contain and omit ones it does.
        single_ingredient: f.singleIngredient ? 1 : 0,
        label_substances: (f.labelSubstances ?? []).join(', '),
        purpose: f.purpose ?? null,
        indications_and_usage: f.indications_and_usage ?? null,
        warnings: f.warnings ?? null,
        do_not_use: f.do_not_use ?? null,
        ask_doctor: f.ask_doctor ?? null,
        ask_doctor_or_pharmacist: f.ask_doctor_or_pharmacist ?? null,
        when_using: f.when_using ?? null,
        stop_use: f.stop_use ?? null,
        pregnancy_or_breast_feeding: f.pregnancy_or_breast_feeding ?? null,
        keep_out_of_reach_of_children: f.keep_out_of_reach_of_children ?? null,
      }]),
    ),
    pharmacies,
    // Symptom taxonomy + safety gates, resolved and validated by step 9 (ADR-008).
    ...readJson<Record<string, unknown>>(path.join(OUT, 'symptoms.json')),
  }

  const jsonPath = path.join(ASSETS, 'medisense.json')
  fs.writeFileSync(jsonPath, JSON.stringify(dataset))
  const jsonSize = fs.statSync(jsonPath).size
  assert(jsonSize < 6 * 1024 * 1024, `dataset is ${(jsonSize / 1024 / 1024).toFixed(1)} MB — too large`)
  log.ok(`assets/medisense.json — ${(jsonSize / 1024 / 1024).toFixed(2)} MB (${dataset.products.length} products, ${dataset.pharmacies.length} pharmacies)`)

  log.done('catalogue emitted')
}

main()

/**
 * ADR-003 AMENDMENT — the app consumes JSON, not the SQLite file.
 *
 * expo-sqlite's web support is alpha: its wa-sqlite worker needs SharedArrayBuffer, which needs
 * cross-origin isolation (COOP/COEP) that the Expo dev server and static exports do not set. The
 * result is not an error — the Suspense boundary simply never resolves and the app hangs on
 * "Loading the medicine catalogue…" with a clean console. Verified in Chrome via Playwright.
 *
 * The catalogue is 838 products. At that size an in-memory index is instant, works identically on
 * iOS, Android and web, needs no native module, and removes a whole class of bundling problems.
 * The SQLite file is still emitted — it is the artifact for inspecting the data with the sqlite3
 * CLI and for the golden-file checks in step 8 — but the app ships the JSON.
 */
