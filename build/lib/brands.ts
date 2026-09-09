/**
 * Brand recognition.
 *
 * DPD has no brand-vs-generic field, and the obvious heuristic ("is the product named after its
 * own ingredient?") fails on exactly the products this app exists to surface: SLEEP-EZE,
 * ALLERGY FORMULA, 24 HOUR ALLERGY REMEDY and ALLERNIX are all private-label trade names that
 * look brand-like by that test. So we combine three signals and rank, rather than guess a boolean.
 *
 * NOTE the retail store brands from the Figma (Life Brand, Personnelle, Kirkland, Equate, OPTION+)
 * do not appear in DPD at all — they are contract-manufactured under the manufacturer's own DIN
 * (Vita Health, Juno, Sigma, LNK). Mapping those retail labels on is a separate, disclosed step.
 */
import { norm } from './normalize.ts'

/**
 * Consumer brands a Canadian shopper would recognise, IN ROUGH ORDER OF RECOGNITION.
 * The order is load-bearing: it breaks ties when several members of one equivalence group are
 * brands (Advil and Motrin share AIG 0108883004; Benadryl and Sleep-Eze share 0102639002).
 * Without it the tie-break falls to string length and anchors the group on the wrong product.
 */
const KNOWN_BRANDS = [
  'TYLENOL', 'ADVIL', 'ASPIRIN', 'ALEVE', 'MOTRIN', 'ANACIN', 'ATASOL', 'TEMPRA', 'ABENOL',
  'BENADRYL', 'CLARITIN', 'REACTINE', 'AERIUS', 'ALLEGRA', 'CHLOR-TRIPOLON',
  'UNISOM', 'NYTOL', 'ZZZQUIL', 'SLEEP-EZE', 'DORMIPHEN',
  'GRAVOL', 'PEPCID', 'ZANTAC', 'NEXIUM', 'PRILOSEC', 'LOSEC',
  'TUMS', 'ROLAIDS', 'MAALOX', 'GAVISCON', 'PEPTO', 'DIOVOL',
  'IMODIUM', 'SENOKOT', 'DULCOLAX', 'COLACE', 'SELAX', 'SOFLAX', 'METAMUCIL', 'RESTORALAX',
  'ROBITUSSIN', 'BUCKLEY', 'NEOCITRAN', 'BENYLIN', 'DIMETAPP', 'TRIAMINIC',
  'OTRIVIN', 'DRISTAN', 'SINEX', 'SUDAFED', 'CLARITIN', 'VICKS',
  'POLYSPORIN', 'OZONOL', 'BACTROBAN', 'VOLTAREN', 'ROBAXACET', 'ROBAXISAL',
  'CANESTEN', 'MONISTAT', 'LAMISIL', 'TINACTIN', 'MICATIN',
  'VISINE', 'REFRESH', 'SYSTANE', 'HYPOTEARS', 'ARTIFICIAL TEARS',
  'PREPARATION H', 'ANUSOL', 'ABREVA', 'ZOVIRAX',
  'SELSUN', 'HEAD & SHOULDERS', 'NIZORAL', 'DENOREX', 'TGEL', 'T/GEL',
  'CORTATE', 'CORTODERM', 'BETADINE', 'BAND-AID', 'AFTERBITE',
  'MIDOL', 'PAMPRIN', 'NAPROSYN',
]

/** Houses whose Canadian OTC output is overwhelmingly generic or private label. */
const GENERIC_HOUSES = [
  'APOTEX', 'TEVA', 'JAMP', 'PHARMASCIENCE', 'SANDOZ', 'MYLAN', 'SIVEM', 'RIVA',
  'TRIANON', 'VITA HEALTH', 'SIGMA LIFE', 'CONFAB', 'LALCO', 'MARCAN', 'AA PHARMA',
  'NAT HEALTH', 'ODAN', 'PENDOPHARM', 'LNK', 'JUNO', 'GUARDIAN DRUG', 'CRLS',
  'ANGITA', 'STERIMAX', 'ALTAMED', 'PHARMAPAR', 'VANITY', 'ROUGIER',
]

export interface BrandSignals {
  isKnownBrand: boolean
  /** Index into KNOWN_BRANDS; lower is better known. Infinity when not a known brand. */
  brandIndex: number
  isInnovator: boolean
  isGenericHouse: boolean
  namedAfterIngredient: boolean
  /** 0-3; higher is more brand-like. Used to pick a group's default "Branded" anchor. */
  brandRank: number
  isBranded: boolean
}

export function brandSignals(
  brandName: string,
  company: string,
  ingredientBases: string[],
  isInnovator: boolean,
): BrandSignals {
  const b = norm(brandName)
  const c = norm(company)
  const brandIndex = KNOWN_BRANDS.findIndex((k) => b.includes(norm(k)))
  const isKnownBrand = brandIndex >= 0
  const isGenericHouse = GENERIC_HOUSES.some((g) => c.includes(g))
  const namedAfterIngredient = ingredientBases.some((i) => i.length > 3 && b.includes(i))

  let brandRank = 0
  if (isKnownBrand) brandRank = 3
  else if (isInnovator && !namedAfterIngredient) brandRank = 2
  else if (!namedAfterIngredient && !isGenericHouse) brandRank = 1

  // A product named after its own ingredient is never the branded anchor, whoever makes it.
  const isBranded = isKnownBrand || (isInnovator && !namedAfterIngredient)

  return {
    isKnownBrand,
    brandIndex: isKnownBrand ? brandIndex : Number.POSITIVE_INFINITY,
    isInnovator, isGenericHouse, namedAfterIngredient, brandRank, isBranded,
  }
}
