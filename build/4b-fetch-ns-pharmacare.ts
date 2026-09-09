/**
 * Step 4b — Nova Scotia Pharmacare formulary prices.
 *
 * A SECOND real, openly-licensed, DIN-keyed price source, added after a 23-source survey found
 * that every Canadian retailer with a real shelf price either forbids automated access in its
 * terms or cannot be joined to a DIN at all (see ADR-017).
 *
 * Nova Scotia publishes its formulary on Socrata as open data under the Open Government Licence –
 * Nova Scotia 1.1, which grants commercial use with attribution as the only condition. There is no
 * anti-scraping clause, no key, no bot protection, and the `din` column is an exact join — no
 * fuzzy brand matching, which is the failure mode that makes retail data unusable here.
 *
 * WHAT THE NUMBER IS, precisely: `reimbursement_price` is the MAXIMUM PER-UNIT AMOUNT Nova Scotia
 * Pharmacare will reimburse a pharmacy for one unit of a product in an interchangeable category.
 * It is:
 *   - not a shelf price — it excludes the pharmacy's markup, the dispensing fee and tax;
 *   - not brand-specific — it is the ceiling for the whole interchangeable group, anchored to the
 *     generic, so a brand's row shows the generic's number;
 *   - Nova Scotia only.
 * Every one of those qualifications has to survive into the UI. A payer price rendered as "$0.63"
 * beside a medicine reads as a shelf price to every user alive.
 *
 * Worth carrying anyway: it covers 30 products Ontario does not, including Claritin Allergy —
 * ODB lists almost none of the products people actually search for.
 */
import * as path from 'node:path'
import { RAW, OUT, ensure, writeJson } from './lib/paths.ts'
import { log } from './lib/log.ts'
import { get } from './lib/net.ts'

export const NS_SOURCE = {
  name: 'Nova Scotia Pharmacare Formulary',
  dataset: 'wyjy-2gt4',
  url: 'https://data.novascotia.ca/resource/wyjy-2gt4.json',
  page: 'https://data.novascotia.ca/Health-and-Wellness/Nova-Scotia-Formulary/wyjy-2gt4',
  licence: 'Open Government Licence – Nova Scotia 1.1',
  attribution: 'Contains information licensed under the Open Government Licence – Nova Scotia.',
}

export interface NsUnitPrice {
  din: string
  nsName: string
  /** Maximum reimbursable amount per unit. NOT a shelf price. */
  pricePerUnit: number
  /** e.g. "loratadine 10mg tab" — the group the ceiling is set for, not this product. */
  interchangeableCategory: string
  /** Undocumented single-letter code (M/L/P). Carried verbatim; never expanded in the UI. */
  priceType: string | null
  benefitStatus: string | null
}

const NS_DIR = path.join(RAW, 'ns')

async function main() {
  ensure(NS_DIR, OUT)
  log.step(`${NS_SOURCE.name} — Socrata dataset ${NS_SOURCE.dataset}`)

  // One request. The whole formulary is 8,222 rows, so there is no pagination to do and no reason
  // to hit this host more than once a month.
  const res = await get(`${NS_SOURCE.url}?$limit=20000`)
  if (!res.ok) throw new Error(`Nova Scotia formulary: HTTP ${res.status}`)
  const rows = (await res.json()) as Record<string, string>[]

  const raw = path.join(NS_DIR, 'ns-formulary.json')
  writeJson(raw, { source: NS_SOURCE, retrieved_at: new Date().toISOString(), rows })
  log.ok(`${rows.length.toLocaleString()} formulary rows`)

  const seen = new Set<string>()
  const prices: NsUnitPrice[] = []
  for (const r of rows) {
    const din = String(r.din ?? '').trim().padStart(8, '0')
    const amount = Number(r.reimbursement_price)
    if (!/^\d{8}$/.test(din) || !Number.isFinite(amount) || amount <= 0) continue
    if (seen.has(din)) continue
    seen.add(din)
    prices.push({
      din,
      nsName: String(r.product_description ?? '').trim(),
      pricePerUnit: amount,
      interchangeableCategory: String(r.interchangeable_category ?? '').trim(),
      priceType: r.price_type ? String(r.price_type) : null,
      benefitStatus: r.benefit_status ? String(r.benefit_status) : null,
    })
  }

  log.ok(`${prices.length.toLocaleString()} distinct DINs carry a reimbursement price`)
  writeJson(path.join(OUT, 'ns-prices.json'), { source: NS_SOURCE, prices })
  log.done(`ns-prices.json — ${prices.length} per-DIN unit prices`)
}

if (import.meta.filename === process.argv[1]) await main()
