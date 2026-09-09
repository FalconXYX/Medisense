/**
 * Step 4 — real brand-vs-generic price ratios from the Ontario Drug Benefit Formulary.
 *
 * This is the ONLY real price data in the project. It is far thinner than it looks: once the
 * non-prescription filter is actually applied, only a handful of ingredient groups have BOTH a
 * brand price and a generic price, because ODB systematically omits <individualPrice> for brands
 * flagged notABenefit="Y". Acetaminophen — the flagship category — yields nothing for that reason.
 *
 * So this step does not produce prices for the app. It produces CITED RATIOS: evidence that
 * generics of a given ingredient list at X% of the brand under Ontario's formulary. Where a ratio
 * exists we cite it. Where it does not, the app says so rather than inventing a saving.
 *
 * The URL is date-stamped per monthly edition and is PINNED. Never fetch at runtime: the next
 * edition 404s this one, and the "stable" health.gov.on.ca URL has an expired TLS cert.
 * Licence: Open Government Licence – Ontario 1.0.
 */
import * as path from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import { ODB_DIR, OUT, ensure, writeJson, readJson } from './lib/paths.ts'
import { log } from './lib/log.ts'
import { download } from './lib/net.ts'
import { baseIngredient } from './lib/normalize.ts'
import type { CatalogueProduct } from './2-build-catalogue.ts'

export const ODB_EDITION = {
  edition: 43,
  createDate: '2026-08-26',
  url: 'https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml',
  licence: 'Open Government Licence – Ontario 1.0',
}

/**
 * A real, per-DIN price published by the Government of Ontario.
 *
 * This is NOT a shelf price and must never be rendered as one. `pricePerUnit` is the Ontario Drug
 * Benefit *reimbursement* amount for a single unit (one tablet, one capsule, one gram) — the
 * ceiling the public plan pays a pharmacy, exclusive of the pharmacy's markup, the dispensing fee
 * and tax. Saskatchewan's formulary states the same thing in its own words: "the price as confirmed
 * by the manufacturer, exclusive of mark-ups".
 *
 * It is worth carrying anyway, because it is the only price in this project that is real, exactly
 * keyed to a DIN, openly licensed and citable — and because a per-UNIT figure is directly
 * comparable between two products without knowing either one's pack size, which is the exact
 * comparison the app exists to make and the exact thing no retail price can give us (Health
 * Canada's DPD publishes package_size at 0% fill across all 58,239 rows).
 */
export interface OdbUnitPrice {
  din: string
  /** Ontario's name for the product, kept so a citation can be checked against the source. */
  odbName: string
  pricePerUnit: number
  dosageForm: string
  strength: string
  /** Y = Ontario lists it but does not reimburse it. The price is still published. */
  notABenefit: boolean
}

export interface OdbRatio {
  ingredient: string
  strength: string
  dosageForm: string
  brandName: string
  brandPricePerUnit: number
  genericName: string
  genericPricePerUnit: number
  /** generic as a percentage of brand. 100 means no saving. */
  ratioPct: number
  /**
   * True only when the expensive side is genuinely a BRAND. ODB omits <individualPrice> for
   * products flagged notABenefit="Y", which is most brands — so a comparison usually ends up
   * generic-vs-generic and says nothing about brand savings. Only cite ratios where this is true.
   */
  brandSideIsBranded: boolean
}

const arr = <T,>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }

async function main() {
  ensure(ODB_DIR, OUT)
  const xmlPath = path.join(ODB_DIR, `odb-edition-${ODB_EDITION.edition}.xml`)

  log.step(`Ontario Drug Benefit Formulary — Edition ${ODB_EDITION.edition} (${ODB_EDITION.createDate})`)
  await download(ODB_EDITION.url, xmlPath, `edition-${ODB_EDITION.edition}.xml`)

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' })
  const doc = parser.parse(await (await import('node:fs/promises')).readFile(xmlPath, 'utf8'))

  // Real structure (verified against the Edition 43 file):
  //   extract > formulary > pcg2 > pcg6 > genericName(<name>) > pcgGroup > pcg9(<strength>,<dosageForm>)
  //           > drug(@id = DIN, @notABenefit) > <name>, <manufacturerId>, <individualPrice>
  // Note the brand very often carries NO <individualPrice> at all (it is flagged notABenefit="Y"),
  // which is why "most expensive member" cannot be used to identify the brand. We join the DIN to
  // our own catalogue instead and use its brand signals.
  const catalogue = readJson<CatalogueProduct[]>(path.join(OUT, 'catalogue.json'))
  const byDin = new Map(catalogue.map((p) => [p.din, p]))
  const ours = new Set(catalogue.flatMap((p) => p.ingredients.map((i) => i.base)))

  const ratios: OdbRatio[] = []
  /** Every per-DIN price Ontario publishes for a product in OUR catalogue. */
  const unitPrices: OdbUnitPrice[] = []
  let pcg9Count = 0
  let otcGroups = 0

  const evaluate = (g: Record<string, unknown>, ingredient: string) => {
    pcg9Count++
    const drugs = arr(g.drug as Record<string, unknown>[]).map((d) => {
      const din = String(d['@id'] ?? '').padStart(8, '0')
      return {
        din,
        name: String((d.name as string) ?? ''),
        price: num(d.individualPrice),
        product: byDin.get(din),
      }
    })
    // Only groups that touch our marketed-OTC catalogue are usable by this app.
    if (!drugs.some((d) => d.product)) return
    otcGroups++

    // Harvest every per-DIN price BEFORE the ratio logic narrows things down. The ratio test needs
    // two priced members of one group and a genuine brand on the expensive side, which holds for
    // only a handful — but the individual prices are real for every product that has one, and
    // throwing 62 real numbers away to keep 4 derived ones was the wrong trade.
    for (const d of drugs) {
      if (!d.product || d.price == null) continue
      const raw = arr(g.drug as Record<string, unknown>[]).find(
        (x) => String(x['@id'] ?? '').padStart(8, '0') === d.din,
      )
      unitPrices.push({
        din: d.din,
        odbName: d.name,
        pricePerUnit: d.price,
        dosageForm: String(g.dosageForm ?? ''),
        strength: String(g.strength ?? ''),
        notABenefit: String(raw?.['@notABenefit'] ?? '') === 'Y',
      })
    }

    const priced = drugs.filter((d) => d.price != null)
    if (priced.length < 2) return

    const realBrand = priced.find((d) => d.product?.isBranded)
    const brand = realBrand ?? [...priced].sort((a, b) => b.price! - a.price!)[0]
    const generics = priced.filter((d) => d.din !== brand.din)
    if (!generics.length) return
    const generic = generics.sort((a, b) => a.price! - b.price!)[0]

    ratios.push({
      ingredient: baseIngredient(ingredient),
      strength: String(g.strength ?? ''),
      dosageForm: String(g.dosageForm ?? ''),
      brandName: brand.name,
      brandPricePerUnit: brand.price!,
      genericName: generic.name,
      genericPricePerUnit: generic.price!,
      ratioPct: Number(((generic.price! / brand.price!) * 100).toFixed(1)),
      brandSideIsBranded: Boolean(realBrand),
    })
  }

  for (const pcg2 of arr(doc.extract?.formulary?.pcg2)) {
    for (const pcg6 of arr(pcg2.pcg6)) {
      for (const gn of arr(pcg6.genericName)) {
        const ingredient = String(gn.name ?? '')
        for (const grp of arr(gn.pcgGroup)) {
          for (const g of arr(grp.pcg9)) evaluate(g, ingredient)
        }
      }
    }
  }
  log.info(`${otcGroups} of ${pcg9Count.toLocaleString()} pcg9 groups contain a marketed OTC product from our catalogue`)
  log.info(`${ratios.length} groups have a computable brand:generic ratio`)

  const relevant = ratios.filter((r) => ours.has(r.ingredient))

  // One ratio per ingredient: the median, so a single outlier strength does not set the headline.
  const byIngredient = new Map<string, OdbRatio[]>()
  for (const r of relevant) {
    const a = byIngredient.get(r.ingredient)
    if (a) a.push(r); else byIngredient.set(r.ingredient, [r])
  }
  const headline = [...byIngredient].map(([ing, rs]) => {
    const sorted = [...rs].sort((a, b) => a.ratioPct - b.ratioPct)
    return sorted[Math.floor(sorted.length / 2)]
  }).sort((a, b) => a.ratioPct - b.ratioPct)

  const citable = headline.filter((r) => r.brandSideIsBranded)

  log.step('Ratios where the expensive side is genuinely a brand — these are citable')
  for (const r of citable) {
    const saving = r.ratioPct >= 99 ? 'no saving' : `${(100 - r.ratioPct).toFixed(0)}% cheaper`
    log.ok(`${r.ingredient.padEnd(20)} ${String(r.ratioPct).padStart(5)}%  ${saving.padEnd(12)} ${r.brandName.slice(0, 20)} vs ${r.genericName.slice(0, 24)}`)
  }
  log.step('Generic-vs-generic only — NOT citable as brand savings')
  for (const r of headline.filter((r) => !r.brandSideIsBranded)) {
    log.info(`${r.ingredient.padEnd(20)} ${String(r.ratioPct).padStart(5)}%  ${r.brandName.slice(0, 20)} vs ${r.genericName.slice(0, 24)}  (brand has no ODB price)`)
  }

  log.warn(`${citable.length} of ${ours.size} catalogue ingredients have a citable brand:generic ratio.`)
  log.warn('Every other price in the app is an estimate and must be labelled "Est." (ADR-007).')

  // De-duplicate: a DIN can appear under more than one pcg9 group. Keep the first price seen.
  const seen = new Set<string>()
  const prices = unitPrices.filter((u) => (seen.has(u.din) ? false : (seen.add(u.din), true)))

  log.step('Per-DIN prices published by Ontario for products in our catalogue')
  log.ok(`${prices.length} of ${byDin.size} catalogue products have a real ODB unit price`)
  const branded = prices.filter((u) => byDin.get(u.din)?.isBranded)
  log.info(`${branded.length} of those are branded products: ${branded.map((u) => u.odbName).slice(0, 8).join(', ')}`)

  writeJson(path.join(OUT, 'odb-ratios.json'),
    { edition: ODB_EDITION, citable, generatedFrom: headline, all: relevant })
  writeJson(path.join(OUT, 'odb-prices.json'), { edition: ODB_EDITION, prices })
  log.done(`${citable.length} citable ratios, ${prices.length} real per-DIN unit prices`)
}

if (import.meta.filename === process.argv[1]) await main()
