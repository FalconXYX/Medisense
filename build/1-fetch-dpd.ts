/**
 * Step 1 — Health Canada Drug Product Database, full JSON dumps.
 *
 * WHY THE API AND NOT allfiles.zip:
 * The documented bulk extract lives on www.canada.ca, which sits behind bot protection that
 * kills the connection mid-stream (curl 92 / HTTP2 INTERNAL_ERROR) from ordinary networks —
 * reproduced here on every UA and protocol combination. health-products.canada.ca serves the
 * same data as unfiltered JSON with no auth, no key and `access-control-allow-origin: *`, so we
 * take it from there. Bonus: no headerless-CSV column-order trap (ther.txt has 4 columns, not 7).
 *
 * WHY DUMPS AND NOT QUERIES (ADR-003):
 * The API has no ai_group_no parameter and SILENTLY IGNORES unknown query params — returning the
 * full dataset rather than erroring. A filter that looks right ships code that quietly returns
 * everything. So: pull whole tables, join locally, assert row counts.
 *
 * Licence: Open Government Licence – Canada 2.0. Attribution required; must not imply endorsement.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DPD_DIR, ensure, readJson } from './lib/paths.ts'
import { log, assert } from './lib/log.ts'
import { download, mb } from './lib/net.ts'

const BASE = 'https://health-products.canada.ca/api/drug'

/** endpoint -> local file. Field names are the API's, not the CSV extract's. */
export const DPD_TABLES = {
  drugproduct: 'drugproduct.json',
  activeingredient: 'activeingredient.json',
  schedule: 'schedule.json',
  status: 'status.json',
  form: 'form.json',
  route: 'route.json',
  therapeuticclass: 'therapeuticclass.json',
  packaging: 'packaging.json',
} as const

export type DpdTable = keyof typeof DPD_TABLES

export interface DrugProduct {
  drug_code: number
  class_name: string
  drug_identification_number: string
  brand_name: string
  descriptor: string
  number_of_ais: string
  ai_group_no: string
  company_name: string
  last_update_date: string
}
export interface ActiveIngredient {
  drug_code: number
  ingredient_name: string
  strength: string
  strength_unit: string
  dosage_value: string
  dosage_unit: string
}
export interface Schedule { drug_code: number; schedule_name: string }
export interface Status { drug_code: number; status: string; history_date: string }
export interface Form { drug_code: number; pharmaceutical_form_name: string }
export interface Route { drug_code: number; route_of_administration_name: string }
export interface TherapeuticClass { drug_code: number; tc_atc_number: string; tc_atc: string }
export interface Packaging { drug_code: number; upc: string; package_size: string; product_information: string }

export function loadDpd<T>(table: DpdTable): T[] {
  return readJson<T[]>(path.join(DPD_DIR, DPD_TABLES[table]))
}

/** Index rows by drug_code. Tables are one-to-many, so callers get arrays. */
export function byDrugCode<T extends { drug_code: number }>(rows: T[]): Map<number, T[]> {
  const m = new Map<number, T[]>()
  for (const r of rows) {
    const a = m.get(r.drug_code)
    if (a) a.push(r)
    else m.set(r.drug_code, [r])
  }
  return m
}

async function main() {
  ensure(DPD_DIR)
  log.step('Health Canada DPD — full table dumps')

  for (const [ep, file] of Object.entries(DPD_TABLES)) {
    await download(`${BASE}/${ep}/?lang=en&type=json`, path.join(DPD_DIR, file), ep)
  }

  log.step('Row counts')
  let total = 0
  for (const t of Object.keys(DPD_TABLES) as DpdTable[]) {
    const n = loadDpd(t).length
    total += n
    log.info(`${t.padEnd(18)} ${String(n).padStart(7)} rows   ${mb(path.join(DPD_DIR, DPD_TABLES[t]))}`)
  }

  // Sanity: the record the whole build is anchored on.
  const advil = loadDpd<DrugProduct>('drugproduct').find((d) => d.drug_identification_number === '01933531')
  assert(advil, 'DIN 01933531 (ADVIL CAPLETS) not found — dump is wrong or truncated')
  assert(advil.ai_group_no === '0108883004', `ADVIL ai_group_no drifted: ${advil.ai_group_no}`)
  log.ok(`anchor: ${advil.brand_name} — AIG ${advil.ai_group_no}, ${advil.company_name}`)

  // Verify the barcode dead-end for ourselves rather than trusting the docs (ADR-011).
  const pkg = loadDpd<Packaging>('packaging')
  const withUpc = pkg.filter((p) => p.upc && p.upc.trim()).length
  log.info(`packaging rows with a non-empty UPC: ${withUpc} / ${pkg.length}`)
  assert(withUpc === 0, `DPD now has ${withUpc} UPCs — barcode strategy (ADR-011) can be revisited`)
  log.warn('UPC empty in 100% of rows (removed 2025-05-01) — barcodes must be hand-seeded')

  fs.writeFileSync(
    path.join(DPD_DIR, '_meta.json'),
    JSON.stringify({ source: BASE, fetchedAt: new Date().toISOString(), rows: total }, null, 2),
  )
  log.done(`${total.toLocaleString()} rows across ${Object.keys(DPD_TABLES).length} tables`)
}

if (import.meta.filename === process.argv[1]) await main()
