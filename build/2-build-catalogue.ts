/**
 * Step 2 — the OTC catalogue and, critically, the equivalence groups.
 *
 * ADR-004 — THE SAFETY CONSTRAINT OF THIS ENTIRE PROJECT:
 * Health Canada's ai_group_no encodes active ingredient identity + strength ONLY. It carries no
 * route and no dosage form. Grouping on it alone offers a rectal suppository as a swap for an oral
 * caplet (AIG 0102009008) and 80 mg/mL paediatric drops as a swap for an 80 mg chewable tablet
 * (AIG 0102009003). It also mixes prescription products in with their OTC counterparts.
 *
 * The equivalence key is therefore  ai_group_no ∩ route ∩ form ∩ STRENGTH,  over an OTC-only
 * universe. Assertions at the bottom of this file enforce it and fail the build if it regresses.
 *
 * THE STRENGTH COMPONENT IS NOT REDUNDANT. ADR-004 originally assumed ai_group_no encoded strength;
 * it does not, reliably. Nine groups mixed strengths — including a children's cough syrup at one
 * QUARTER the strength of the adult product it was offered as an alternative to (Jack & Jill
 * Bedtime vs Robitussin Honey Nighttime, DXM 7.5 mg vs 30 mg), and two Benylin products at exactly
 * half of all five ingredients of the Tylenol they were paired with. Grouping on the group number
 * alone therefore offers a paediatric dose as a swap for an adult one.
 */
import * as path from 'node:path'
import {
  loadDpd, byDrugCode,
  type DrugProduct, type ActiveIngredient, type Schedule, type Status,
  type Form, type Route, type TherapeuticClass,
} from './1-fetch-dpd.ts'
import { OUT, ensure, writeJson } from './lib/paths.ts'
import { log, assert } from './lib/log.ts'
import { norm, baseIngredient, titleCase } from './lib/normalize.ts'
import { brandSignals, type BrandSignals } from './lib/brands.ts'

/**
 * Companies that originate brands rather than copy them. Used only to pick which member of an
 * equivalence group is the "Branded" anchor. A group can legitimately hold several of these —
 * Advil (Haleon) and Motrin (Kenvue) share AIG 0108883004 — so this returns a set, not a winner.
 */
const INNOVATORS = [
  'HALEON', 'KENVUE', 'JOHNSON & JOHNSON', 'MCNEIL', 'BAYER', 'PROCTER & GAMBLE',
  'CHURCH & DWIGHT', 'RECKITT', 'PRESTIGE', 'MEDTECH', 'GLAXOSMITHKLINE', 'GSK',
  'PFIZER', 'SANOFI', 'BOEHRINGER', 'NOVARTIS', 'PERRIGO', 'TEVA CANADA LIMITED',
  'ASTRAZENECA', 'MERCK', 'ABBVIE', 'ABBOTT',
]

/**
 * Ingredients withdrawn from the Canadian market that the DPD status column has not caught up
 * with. Health Canada requested a stop-sale of all ranitidine in 2020 over NDMA contamination and
 * no ranitidine product has been available since, yet DIN 02248246 is still flagged Marketed — so
 * a search for "acid reducer" was returning it. The register is not a shelf.
 */
const WITHDRAWN_INGREDIENTS = new Set([
  'RANITIDINE',   // Health Canada stop-sale, 2020 (NDMA)
  'PHENOLPHTHALEIN',
  'ATTAPULGITE',
])

/** ATC level-1/2 prefixes that are actual self-care medicines. Without this the catalogue is
 *  two-thirds sunscreen (D02) and antiseptics (V07) and reads as a cosmetics list. */
const MEDICINE_ATC = [
  'N02', // analgesics
  'M01', 'M02', 'M03', // anti-inflammatory, topical joint/muscle, muscle relaxant combos (Robaxacet)
  'R05', 'R06', 'R01', 'R02', // cough/cold, antihistamine, nasal, throat
  'A02', 'A03', 'A04', 'A06', 'A07', // acid, functional GI, antiemetic, laxative, antidiarrhoeal
  'D01', 'D04', 'D06', 'D07', 'D08', 'D10', 'D11',
  // antifungal, antipruritic (Gold Bond, Aveeno), topical antibiotic, corticosteroid,
  // antiseptic (Dettol, chlorhexidine — genuine first aid), acne, other dermatological
  'S01', // ophthalmic
  'C05', // haemorrhoid / vasoprotective
  'G01', 'G02', // vaginal antifungal (Canesten, Clotrimaderm), levonorgestrel
  'J02', // oral antifungal sold OTC in Canada (Diflucan One)
  'B01AC', // low-dose ASA (Aspirin 81 mg, Entrophen) — B01 broadly is anticoagulants, so scope it
]

/**
 * D02 is 495 sunscreens, lip balms and barrier creams. It is the single biggest block of
 * "non-prescription" products and none of them are what someone opens a medicine finder for, so
 * it stays out — but the allowlist above was previously so tight it also excluded Aspirin 81 mg,
 * Canesten, Robaxacet, Diflucan One and every anti-itch cream. Widened deliberately.
 */

export interface CatalogueProduct {
  drugCode: number
  din: string
  brandName: string
  displayName: string
  company: string
  aiGroupNo: string
  numberOfAis: number
  schedules: string[]
  status: string
  forms: string[]
  routes: string[]
  atcNumber: string
  atcName: string
  ingredients: {
    name: string; base: string; strength: string; unit: string
    /** Denominator for per-volume products: 15 MG per 5 ML. Blank for solid dose forms. */
    per: string
  }[]
  /** This product's OWN ingredient list, formatted for display. Never the group's. */
  ingredientLabel: string
  /** ai_group_no ∩ route ∩ form — see ADR-004. Null when any component is missing. */
  equivalenceKey: string | null
  signals: BrandSignals
  isBranded: boolean
  brandRank: number
}

export interface EquivalenceGroup {
  key: string
  aiGroupNo: string
  route: string
  form: string
  ingredientLabel: string
  members: number[]
  /** Default "Branded" anchor when the user did not search a specific product. */
  brandAnchor: number | null
  hasAlternatives: boolean
}

const uniq = <T,>(a: T[]) => [...new Set(a)]

/**
 * Strength normalisation for the equivalence key. DPD writes the same strength several ways
 * (650 / 650.0, 17.5 / 17.6 mg of bismuth, 0.07 / 0.075 % CPC), and splitting on those would
 * fragment groups that really are one group. Round to 2 significant decimals and drop trailing
 * zeros; anything that still differs is a genuinely different strength.
 */
function normStrength(v: string): string {
  const n = Number(String(v).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n === 0) return String(v ?? '').trim().toUpperCase()
  // 2 significant figures after the point is enough to keep 7.5 vs 30 apart and 17.5 vs 17.6 together.
  return String(Math.round(n * 20) / 20)
}
const normUnit = (u: string) => (u ?? '').trim().toUpperCase().replace(/\s+/g, '')

/**
 * Display label for a product's own ingredients. De-duplicated (DPD lists the moiety and the salt
 * as separate rows) and carrying the per-volume denominator so a 15 mg/5 mL syrup never reads as
 * a bare "15MG" beside a 15 mg tablet.
 */
export function formatIngredients(
  ing: { base: string; strength: string; unit: string; per: string }[],
): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const i of ing) {
    // Trim trailing zeros so 650.0MG and 650MG, or 0.30% and 0.3%, do not read as different
    // strengths sitting next to each other in an Alternatives list.
    const strength = String(i.strength ?? '').trim().replace(/^(\d*\.\d*?)0+$/, '$1').replace(/\.$/, '')
    const label = `${i.base} ${strength}${i.unit}${i.per ? ` / ${i.per}` : ''}`.replace(/\s+/g, ' ').trim()
    if (seen.has(label)) continue
    seen.add(label)
    parts.push(label)
  }
  // Sorted, so the same combination always reads the same way. DPD's row order varies between
  // products, which made Robaxacet and Tylenol Back Pain — genuinely the same formulation — look
  // like different things sitting next to each other in an Alternatives list.
  return parts.sort().join(' + ')
}

function main() {
  ensure(OUT)
  log.step('Loading DPD tables')
  const products = loadDpd<DrugProduct>('drugproduct')
  const ingredients = byDrugCode(loadDpd<ActiveIngredient>('activeingredient'))
  const schedules = byDrugCode(loadDpd<Schedule>('schedule'))
  const statuses = byDrugCode(loadDpd<Status>('status'))
  const forms = byDrugCode(loadDpd<Form>('form'))
  const routes = byDrugCode(loadDpd<Route>('route'))
  const atc = byDrugCode(loadDpd<TherapeuticClass>('therapeuticclass'))
  log.info(`${products.length.toLocaleString()} products in the register`)

  log.step('Filtering to the marketed OTC universe')
  const funnel = { human: 0, marketed: 0, otc: 0, notHomeopathic: 0, medicine: 0, withdrawn: 0 }

  const catalogue: CatalogueProduct[] = []
  for (const p of products) {
    if (p.class_name !== 'Human') continue
    funnel.human++

    const status = statuses.get(p.drug_code)?.[0]?.status ?? ''
    if (status !== 'Marketed') continue
    funnel.marketed++

    const scheds = uniq((schedules.get(p.drug_code) ?? []).map((s) => s.schedule_name).filter(Boolean))
    if (!scheds.includes('NON-PRESCRIPTION DRUGS')) continue
    funnel.otc++

    // Homeopathics contaminate every ingredient facet (arsenic trioxide under diarrhoea).
    if (scheds.includes('HOMEOPATHIC')) continue
    funnel.notHomeopathic++

    const a = atc.get(p.drug_code)?.[0]
    const atcNumber = a?.tc_atc_number ?? ''
    if (!MEDICINE_ATC.some((pre) => atcNumber.startsWith(pre))) continue
    funnel.medicine++

    const rawIng = ingredients.get(p.drug_code) ?? []
    if (rawIng.some((i) => WITHDRAWN_INGREDIENTS.has(baseIngredient(i.ingredient_name)))) {
      funnel.withdrawn++
      continue
    }

    const ing = (ingredients.get(p.drug_code) ?? []).map((i) => {
      // A bare "15MG" on a syrup is meaningless and, next to a 15 mg tablet, actively misleading.
      // DPD carries the denominator separately in dosage_value/dosage_unit.
      const dv = (i.dosage_value ?? '').trim()
      const du = (i.dosage_unit ?? '').trim()
      return {
        name: norm(i.ingredient_name),
        base: baseIngredient(i.ingredient_name),
        strength: (i.strength ?? '').trim(),
        unit: (i.strength_unit ?? '').trim(),
        per: dv && du ? `${dv}${du}` : '',
      }
    })
    const formList = uniq((forms.get(p.drug_code) ?? []).map((f) => norm(f.pharmaceutical_form_name)).filter(Boolean)).sort()
    const routeList = uniq((routes.get(p.drug_code) ?? []).map((r) => norm(r.route_of_administration_name)).filter(Boolean)).sort()

    // ADR-004: all four components, or no key at all. Strengths are normalised first so that
    // 650 vs 650.0 and 17.5 vs 17.6 mg do not split a group that is genuinely one group.
    const strengthSig = [...new Set(ing.map(
      (i) => `${i.base} ${normStrength(i.strength)}${normUnit(i.unit)}${i.per ? `/${normUnit(i.per)}` : ''}`,
    ))].sort().join(' + ')
    const equivalenceKey =
      p.ai_group_no && formList.length && routeList.length && strengthSig
        ? `${p.ai_group_no}|${routeList.join('+')}|${formList.join('+')}|${strengthSig}`
        : null

    const company = norm(p.company_name)
    const isInnovator = INNOVATORS.some((c) => company.includes(c))
    const signals = brandSignals(p.brand_name, p.company_name, ing.map((i) => i.base), isInnovator)

    catalogue.push({
      drugCode: p.drug_code,
      din: p.drug_identification_number,
      brandName: p.brand_name,
      displayName: titleCase(p.brand_name),
      company: p.company_name,
      aiGroupNo: p.ai_group_no,
      numberOfAis: Number(p.number_of_ais) || ing.length,
      schedules: scheds,
      status,
      forms: formList,
      routes: routeList,
      atcNumber,
      atcName: a?.tc_atc ?? '',
      ingredients: ing,
      ingredientLabel: formatIngredients(ing),
      equivalenceKey,
      signals,
      isBranded: signals.isBranded,
      brandRank: signals.brandRank,
    })
  }

  log.info(`Human                    ${String(funnel.human).padStart(6)}`)
  log.info(`  + Marketed             ${String(funnel.marketed).padStart(6)}`)
  log.info(`  + non-prescription     ${String(funnel.otc).padStart(6)}`)
  log.info(`  + not homeopathic      ${String(funnel.notHomeopathic).padStart(6)}`)
  log.info(`  + medicine ATC classes ${String(funnel.medicine).padStart(6)}`)
  log.info(`  - withdrawn ingredients ${String(funnel.withdrawn).padStart(5)}   <- ${funnel.medicine - funnel.withdrawn} catalogue`)

  log.step('Building equivalence groups (ai_group_no ∩ route ∩ form)')
  const groups = new Map<string, CatalogueProduct[]>()
  for (const p of catalogue) {
    if (!p.equivalenceKey) continue
    const g = groups.get(p.equivalenceKey)
    if (g) g.push(p)
    else groups.set(p.equivalenceKey, [p])
  }
  const multi = [...groups.values()].filter((g) => g.length > 1)
  log.info(`${groups.size} groups, ${multi.length} with alternatives, ${groups.size - multi.length} singletons`)

  // How much worse would AIG-alone have been? Quantify the constraint we are enforcing.
  const naive = new Map<string, CatalogueProduct[]>()
  for (const p of catalogue) {
    if (!p.aiGroupNo) continue
    const g = naive.get(p.aiGroupNo)
    if (g) g.push(p); else naive.set(p.aiGroupNo, [p])
  }
  let unsafe = 0
  for (const g of naive.values()) {
    if (g.length < 2) continue
    if (uniq(g.flatMap((p) => p.forms)).length > 1 || uniq(g.flatMap((p) => p.routes)).length > 1) unsafe++
  }
  log.warn(`AIG alone would have produced ${unsafe} groups mixing route or dosage form (ADR-004)`)

  log.step('Assertions')
  // NOTE these must be checked against each product's OWN fields, not against the key — the key is
  // derived from those fields, so comparing them to it can never fail. The first version of this
  // check did exactly that and was therefore worthless.
  for (const [key, g] of groups) {
    const forms = uniq(g.map((p) => p.forms.join('+')))
    const routes = uniq(g.map((p) => p.routes.join('+')))
    assert(forms.length === 1, `group ${key} spans dosage forms: ${forms.join(' | ')}`)
    assert(routes.length === 1, `group ${key} spans routes: ${routes.join(' | ')}`)

    // The real test: do the members actually contain the same ingredients at the same strengths?
    const sigs = uniq(g.map((p) =>
      [...new Set(p.ingredients.map((i) => `${i.base} ${normStrength(i.strength)}${normUnit(i.unit)}`))]
        .sort().join(' + ')))
    assert(sigs.length === 1, `group ${key} mixes ingredient strengths:\n    ${sigs.join('\n    ')}`)

    // And the same NUMBER of active ingredients, so a plain product is never swapped for a combo.
    const counts = uniq(g.map((p) => new Set(p.ingredients.map((i) => i.base)).size))
    assert(counts.length === 1, `group ${key} mixes ingredient counts: ${counts.join(', ')}`)

    for (const p of g) {
      assert(p.schedules.includes('NON-PRESCRIPTION DRUGS'), `${p.din} is not non-prescription`)
      assert(p.status === 'Marketed', `${p.din} is not marketed`)
    }
  }
  log.ok('every group is single-route, single-form, single-strength, single ingredient-count, all marketed non-prescription')

  log.step('Selecting a default Branded anchor per group')
  const out: EquivalenceGroup[] = []
  let anchored = 0
  for (const [key, g] of groups) {
    const [aiGroupNo, route, form] = key.split('|')
    // Highest brandRank, then best-known brand (Advil before Motrin, Benadryl before Sleep-Eze),
    // then innovator over licensee, then the shorter name (ADVIL before ADVIL LIQUI-GELS).
    const ranked = [...g].sort((a, b) =>
      b.brandRank - a.brandRank ||
      a.signals.brandIndex - b.signals.brandIndex ||
      Number(b.signals.isInnovator) - Number(a.signals.isInnovator) ||
      a.brandName.length - b.brandName.length)
    const anchor = ranked[0].brandRank > 0 ? ranked[0] : null
    if (anchor) anchored++
    out.push({
      key, aiGroupNo, route, form,
      // The GROUP's label, used only for the group header. Every member now shares a strength
      // signature, so the anchor's label describes them all — but products still render their own.
      ingredientLabel: ranked[0].ingredientLabel,
      members: ranked.map((p) => p.drugCode),
      brandAnchor: anchor?.drugCode ?? null,
      hasAlternatives: g.length > 1,
    })
  }
  log.info(`${anchored}/${groups.size} groups have a recognisable branded anchor`)

  const branded = catalogue.filter((p) => p.isBranded).length
  log.info(`${branded} branded / ${catalogue.length - branded} alternatives across the catalogue`)

  writeJson(path.join(OUT, 'catalogue.json'), catalogue)
  writeJson(path.join(OUT, 'groups.json'), out)

  log.done(`${catalogue.length} products, ${groups.size} equivalence groups`)
}

main()
