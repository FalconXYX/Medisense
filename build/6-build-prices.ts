/**
 * Step 6 — real prices only.
 *
 * REPLACES the seeded price generator (ADR-017). The old step 6 produced a price for all 1,024
 * products from `mulberry32(fnv1a(din + ':' + osmId))`, labelled every one "Est.", and disclosed
 * the formula in a modal. A 23-source survey established that no lawful, DIN-keyed Canadian retail
 * price exists for even one of those products — every retailer either forbids automated access in
 * its terms or cannot be joined to a DIN, and Health Canada deleted every UPC from the DPD on
 * 2025-05-01 (verified: 0 of 58,239 packaging rows carry a `upc` or a `package_size`).
 *
 * So this step no longer invents anything. It joins the two open, licensed, DIN-keyed government
 * sources we actually have, and every product that neither source covers gets NO PRICE — which is
 * about 91% of the catalogue, and is the honest outcome.
 *
 * NOTHING HERE IS A SHELF PRICE. Both numbers are per-unit amounts a public drug plan reimburses a
 * pharmacy, excluding the pharmacy's markup, the dispensing fee and tax. Apo-Ibuprofen at
 * $0.0309/tablet implies $1.55 for 50 caplets against $8–12 at a till — understated 5–8×. The
 * basis therefore travels WITH the number, in the same object, so the UI cannot render the digits
 * without it.
 */
import * as path from 'node:path'
import { OUT, writeJson, readJson } from './lib/paths.ts'
import { log } from './lib/log.ts'
import type { CatalogueProduct } from './2-build-catalogue.ts'
import type { OdbUnitPrice } from './4-fetch-odb.ts'
import type { NsUnitPrice } from './4b-fetch-ns-pharmacare.ts'
import { ODB_EDITION } from './4-fetch-odb.ts'
import { NS_SOURCE } from './4b-fetch-ns-pharmacare.ts'
import { OBSERVED_PRICES } from './data/observed-prices.ts'

/**
 * A real per-unit price published by a Canadian government, joined on an exact DIN.
 * There is deliberately no field called `price` anywhere in this project any more.
 */
export interface BenefitPrice {
  din: string
  /** 'OBS' is a price a human read off a shelf tag — the only RETAIL price in the project. */
  jurisdiction: 'ON' | 'NS' | 'OBS'
  amountPerUnit: number
  /** "tablet", "capsule", "suppository", "mL", "g" … derived from the dosage form. */
  unit: string
  /** One line naming exactly what the number is. Rendered beside the digits, never behind a tap. */
  basis: string
  /** The citation a reader can check. */
  source: string
  /**
   * ODB only, and only where it DIFFERS from amountPerUnit — the ministry reimburses the
   * lowest-cost alternative, so Dulcolax lists at 1.2267 and is reimbursed at 0.4206. Showing one
   * without the other would misrepresent both.
   */
  ministryPays: number | null
  /** NS only — the interchangeable group the ceiling is set for. It is not brand-specific. */
  interchangeableGroup: string | null
  /** Observed prices only: the pack the price was for, so it means something. */
  pack: { size: number; unit: string } | null
  /** Observed prices only: where and when a person saw it. */
  observed: { store: string; city: string; on: string; by: string; note?: string } | null
}

/**
 * Dosage form -> the noun that makes "$0.4206 per ___" read correctly. Falls back to "unit",
 * which is honest but clumsy, rather than guessing.
 */
function unitFor(form: string): string {
  const f = (form || '').toUpperCase()
  if (/SUPPOSITORY/.test(f)) return 'suppository'
  if (/CAPSULE/.test(f)) return 'capsule'
  if (/TABLET/.test(f)) return 'tablet'
  if (/(SOLUTION|SUSPENSION|SYRUP|LIQUID|DROPS|ELIXIR)/.test(f)) return 'mL'
  if (/(CREAM|OINTMENT|GEL|LOTION|PASTE|POWDER)/.test(f)) return 'g'
  if (/(PATCH|LOZENGE|GUM|WAFER|PAD|SWAB)/.test(f)) return 'each'
  return 'unit'
}

async function main() {
  const catalogue = readJson<CatalogueProduct[]>(path.join(OUT, 'catalogue.json'))
  const odb = readJson<{ prices: OdbUnitPrice[] }>(path.join(OUT, 'odb-prices.json')).prices
  const ns = readJson<{ prices: NsUnitPrice[] }>(path.join(OUT, 'ns-prices.json')).prices

  const odbBy = new Map(odb.map((p) => [p.din, p]))
  const nsBy = new Map(ns.map((p) => [p.din, p]))

  log.step('Joining real prices to the catalogue on exact DIN')

  /**
   * Hand-observed shelf prices, dropped once they go stale.
   *
   * 180 days is generous for a price and deliberately not configurable — a two-year-old shelf tag
   * presented as current is the same failure as a generated number, only slower to notice.
   */
  const MAX_AGE_DAYS = 180
  const today = Date.now()
  const fresh = OBSERVED_PRICES.filter((o) => {
    const age = (today - Date.parse(o.observedOn)) / 86_400_000
    if (!Number.isFinite(age)) {
      log.warn(`observed price for DIN ${o.din} has an unparseable date — dropped`)
      return false
    }
    if (age > MAX_AGE_DAYS) {
      log.warn(`observed price for DIN ${o.din} is ${Math.round(age)} days old — dropped`)
      return false
    }
    return true
  })
  const obsBy = new Map(fresh.map((o) => [o.din, o]))

  const out: BenefitPrice[] = []
  for (const p of catalogue) {
    // CatalogueProduct carries `forms` (an array — a DIN can list more than one), not `form`.
    const unit = unitFor((p.forms ?? []).join(' '))

    // A price somebody actually paid outranks a payer's reimbursement ceiling.
    const obs = obsBy.get(p.din)
    if (obs) {
      out.push({
        din: p.din,
        jurisdiction: 'OBS',
        amountPerUnit: obs.price,
        unit: obs.packUnit,
        basis:
          `Seen on the shelf at ${obs.store}, ${obs.city}, on ${obs.observedOn}. One store on one ` +
          'day, before tax — not a national price, and it will drift.',
        source: `Observed by ${obs.observedBy}${obs.note ? ` — ${obs.note}` : ''}`,
        ministryPays: null,
        interchangeableGroup: null,
        pack: { size: obs.packSize, unit: obs.packUnit },
        observed: {
          store: obs.store, city: obs.city, on: obs.observedOn, by: obs.observedBy, note: obs.note,
        },
      })
      continue
    }

    const o = odbBy.get(p.din)
    if (o) {
      out.push({
        din: p.din,
        jurisdiction: 'ON',
        amountPerUnit: o.pricePerUnit,
        unit,
        basis:
          `What the Ontario Drug Benefit program pays a pharmacy for one ${unit} when this ` +
          'product is covered. Not a shelf price — it excludes the pharmacy markup, the ' +
          'dispensing fee and tax, and it applies only in Ontario.',
        source: `Ontario Drug Benefit Formulary, Edition ${ODB_EDITION.edition} (${ODB_EDITION.createDate})`,
        ministryPays: null,
        interchangeableGroup: null,
        pack: null,
        observed: null,
      })
      continue
    }
    // Ontario first, because its number is product-specific; Nova Scotia's is a group ceiling.
    const n = nsBy.get(p.din)
    if (n) {
      out.push({
        din: p.din,
        jurisdiction: 'NS',
        amountPerUnit: n.pricePerUnit,
        unit,
        basis:
          `The most Nova Scotia Pharmacare will reimburse for one ${unit} in the interchangeable ` +
          `group “${n.interchangeableCategory}”. Not a shelf price, and not specific to this ` +
          'brand — it is the ceiling for the whole group.',
        source: `${NS_SOURCE.name} (Socrata ${NS_SOURCE.dataset})`,
        ministryPays: null,
        interchangeableGroup: n.interchangeableCategory || null,
        pack: null,
        observed: null,
      })
    }
  }

  const obsCount = out.filter((p) => p.jurisdiction === 'OBS').length
  const on = out.filter((p) => p.jurisdiction === 'ON').length
  const nsCount = out.filter((p) => p.jurisdiction === 'NS').length
  if (obsCount) log.ok(`${obsCount} products carry a hand-observed shelf price`)
  log.ok(`${on} products priced from Ontario`)
  log.ok(`${nsCount} more priced from Nova Scotia`)
  log.warn(`${catalogue.length - out.length} of ${catalogue.length} products have NO published price — the app shows none`)

  writeJson(path.join(OUT, 'prices.json'), {
    sources: [
      { jurisdiction: 'ON', name: 'Ontario Drug Benefit Formulary', edition: ODB_EDITION.edition, licence: ODB_EDITION.licence },
      { jurisdiction: 'NS', name: NS_SOURCE.name, licence: NS_SOURCE.licence },
      { jurisdiction: 'OBS', name: 'Hand-observed shelf prices', licence: 'Primary observation' },
    ],
    note: 'Per-unit public-plan reimbursement amounts. NOT retail shelf prices.',
    prices: out,
  })
  log.done(`prices.json — ${out.length} real prices, 0 generated`)
}

if (import.meta.filename === process.argv[1]) await main()
