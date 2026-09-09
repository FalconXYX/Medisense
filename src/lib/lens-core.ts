/**
 * "Lens" — recognise a medicine from what is PRINTED on the package, not from a barcode.
 *
 * WHY THIS EXISTS. The design document's FR4 lists five search inputs, and one of them is "an image
 * of a brand name". Barcodes alone cannot deliver it: Health Canada deleted every UPC from the drug
 * database in 2025 and no free service maps a Canadian OTC barcode to a product (ADR-011), so the
 * scan screen's own table is the only barcode source there is. Reading the box is the input that
 * actually generalises — every package has its name printed on it.
 *
 * HOW IT WORKS. Capture a still, run OCR over it, then score the recognised words against the
 * catalogue: brand names weigh heaviest, then ingredients, then a strength like "200 mg" and the
 * dosage form, which together disambiguate Advil from Advil Cold or a 200 mg tablet from a 400 mg
 * one. The result is a RANKED SHORTLIST, never an automatic navigation — picking the wrong medicine
 * for someone is a safety problem, not a UX one.
 *
 * PLATFORM. This file holds only the platform-independent half: tokenising the recognised text and
 * scoring it against the catalogue. The OCR engine itself is split — lens.web.ts runs Tesseract in
 * the browser, lens.ts reports honestly that Expo Go has no on-device OCR (every ML Kit binding
 * needs a custom native module, and therefore a development build).
 *
 * It is a SEPARATE module from lens.ts on purpose: a `lens.web.ts` that re-exported from './lens'
 * resolved back to itself on the web target, because Metro prefers the platform extension. The
 * cycle left every export undefined and silently disabled the feature.
 */
import { products, productByCode } from './dataset'
import type { Product } from './types'

export interface LensCandidate {
  product: Product
  /** 0-1. Not a probability — a relative ranking within this capture. */
  confidence: number
  /** Which recognised words drove the match, so the UI can show its working. */
  matched: string[]
}

export interface LensResult {
  /** Everything OCR read, for the "we saw this" panel. */
  text: string
  /** The words we actually used. */
  tokens: string[]
  strength: string | null
  candidates: LensCandidate[]
  ms: number
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'each', 'per', 'net', 'contents', 'tablets', 'tablet',
  'caplets', 'caplet', 'capsules', 'capsule', 'softgels', 'liquid', 'relief', 'strength', 'extra',
  'regular', 'new', 'now', 'free', 'non', 'drowsy', 'hour', 'hours', 'pain', 'fast', 'acting',
  'medicinal', 'ingredient', 'ingredients', 'usp', 'ph', 'ca', 'canada', 'made', 'inc', 'ltd',
  'keep', 'out', 'reach', 'children', 'read', 'carton', 'before', 'use', 'directions', 'warning',
  'warnings', 'store', 'room', 'temperature', 'lot', 'exp', 'www', 'com',
  // "brand" appears on every store-brand package ("Life Brand", "Compliments"), and matching it
  // sent a Life Brand ibuprofen box to "Band-Aid Brand Adhesive Bandages".
  'brand', 'value', 'compare', 'active', 'other', 'symptom', 'symptoms', 'formula', 'original',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.%/-]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.\-/]+|[.\-/]+$/g, ''))
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t))
}

/** "200 mg", "200mg", "500 MG" -> "200MG". Strength is the strongest disambiguator on a box. */
export function extractStrength(text: string): string | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|%)\b/i)
  return m ? `${m[1]}${m[2].toUpperCase()}` : null
}

const FORMS = ['tablet', 'caplet', 'capsule', 'softgel', 'gel', 'liquid', 'syrup', 'suspension',
  'cream', 'ointment', 'spray', 'drops', 'suppository', 'lozenge', 'powder', 'patch']

/** Strip everything but letters and digits, so BUCKLEY'S and "buckleys" compare equal. */
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Does the haystack contain this token, allowing for OCR noise? Exact first, then a one-character
 * trim from the end, which covers the common plural/possessive misreads ("buckleys" -> "buckley",
 * "caplets" -> "caplet") without opening the door to spurious short matches.
 */
function contains(hay: string, token: string): boolean {
  if (hay.includes(token)) return true
  return token.length >= 6 && hay.includes(token.slice(0, -1))
}

/**
 * Score the catalogue against what OCR read. Deliberately simple and inspectable — a black-box
 * similarity score would be impossible to explain on screen, and this screen has to show its work.
 */
export function matchProducts(text: string, limit = 5): LensCandidate[] {
  const tokens = tokenize(text)
  if (!tokens.length) return []
  const strength = extractStrength(text)
  const lower = text.toLowerCase()
  const forms = FORMS.filter((f) => lower.includes(f))

  const scored: LensCandidate[] = []
  for (const p of products) {
    // Flattened, so punctuation in a brand name cannot defeat a match.
    const brand = flat(p.brand_name)
    const ing = flat(p.ingredient_label ?? '')
    const company = flat(p.company)
    const matched: string[] = []
    let score = 0

    for (const t of tokens) {
      const f = flat(t)
      if (!f) continue
      if (contains(brand, f)) { score += f.length >= 5 ? 12 : 7; matched.push(t) }
      else if (contains(ing, f)) { score += 5; matched.push(t) }
      else if (contains(company, f)) { score += 1 }
    }
    if (!score) continue

    // A matching strength is the strongest signal on a box: it separates Advil 200 from Advil 400,
    // and Tylenol Extra Strength from Tylenol Dual Action. Weighted above a brand-word hit.
    if (strength && contains(ing, flat(strength))) { score += 16; matched.push(strength) }
    // Conversely, a strength that is printed on the box and absent from the product is evidence
    // AGAINST it — otherwise a combination product wins on brand words alone.
    else if (strength) score -= 6

    // A matching dosage form separates the tablet from the syrup of the same brand.
    if (forms.some((f) => (p.form ?? '').toLowerCase().includes(f))) score += 4
    // Single-ingredient products are the common case on a shelf; a five-ingredient combination
    // should have to earn its place rather than win on containing a popular ingredient.
    if ((p.bases?.length ?? 1) === 1) score += 3
    // Prefer the recognisable brand when several products match equally.
    score += p.brand_rank

    scored.push({ product: p, confidence: score, matched: [...new Set(matched)] })
  }

  scored.sort((a, b) => b.confidence - a.confidence)
  const top = scored.slice(0, limit)
  const max = top[0]?.confidence ?? 1
  return top.map((c) => ({ ...c, confidence: Math.min(1, c.confidence / max) }))
}


void productByCode
