/**
 * Symptom matching and the safety gates.
 *
 * ADR-008 — the app is a product finder indexed by label text, not a symptom checker. The input is
 * a CLOSED vocabulary of 22 curated symptoms plus their synonyms: that is simultaneously the safety
 * control and the reason the feature is buildable at all. Nothing here infers a condition, ranks by
 * effectiveness, or calculates a dose.
 */
import { products, productByCode } from './dataset'
import raw from '../../assets/medisense.json'
import type { Product } from './types'

export interface SymptomClass {
  className: string
  rank: number
  ingredients: string[]
  products: number[]
  singleIngredientCount: number
}

export interface Symptom {
  id: string
  label: string
  synonyms: string[]
  bodyArea: string
  seeSomeoneAfter: string
  source: { title: string; kind: string }
  classes: SymptomClass[]
  productCount: number
}

export interface RedFlag {
  id: string
  label: string
  /** Regex SOURCE. See build/data/symptoms.ts for why this is not substring containment. */
  pattern: string
}

const data = raw as unknown as {
  symptoms: Symptom[]
  redFlags: RedFlag[]
  cautions: { underSixHardBlock: string[]; youngChildPatterns: string[]; general: string[] }
}

export const SYMPTOMS = data.symptoms
export const RED_FLAGS = data.redFlags
export const CAUTIONS = data.cautions

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
/** Spaces removed, so "heart burn" and "heartburn" compare equal. */
const squash = (s: string) => norm(s).replace(/ /g, '')

const flagRegexes = RED_FLAGS.map((f) => ({ flag: f, re: new RegExp(f.pattern, 'i') }))

/**
 * Does this query describe something that needs urgent care rather than a shelf medicine?
 * Checked BEFORE any product lookup — see gate order in search.tsx.
 */
export function matchRedFlag(query: string): RedFlag | null {
  const q = norm(query)
  if (q.length < 4) return null
  for (const { flag, re } of flagRegexes) {
    if (re.test(q)) return flag
  }
  return null
}

export interface SymptomMatch {
  symptom: Symptom
  /** The query IS the symptom ("headache"), rather than merely containing a symptom word. */
  exact: boolean
  /** How many characters of the query the matched term accounts for. Longer wins. */
  matchedLength: number
}

/**
 * Match against the closed vocabulary. Deliberately not fuzzy — no free-text inference (ADR-008).
 *
 * Candidates are RANKED by matched-term length rather than returning the first symptom in array
 * order. Returning the first hit meant "heart burn" (with a space) matched the 4-letter synonym
 * "burn" under Minor cuts and answered a reflux query with 21 first-aid antibiotics, because
 * minor-cuts happens to sit earlier in the array than heartburn.
 */
export function matchSymptom(query: string): SymptomMatch | null {
  const q = norm(query)
  if (q.length < 3) return null

  const qSquashed = squash(query)
  let best: SymptomMatch | null = null
  for (const s of SYMPTOMS) {
    const terms = [norm(s.label), s.id.replace(/-/g, ' '), ...s.synonyms.map(norm)]
    for (const t of terms) {
      if (t.length < 3) continue
      // Compare with spaces removed too: people type "heart burn", and without this the 4-letter
      // synonym "burn" under Minor cuts outranked Heartburn and answered reflux with antibiotics.
      const exact = t === q || squash(t) === qSquashed
      // Whole-word containment, so "bad headache" lands on Headache but "head" does not.
      const contained = t.length > 3 && new RegExp(`\\b${escapeRe(t)}\\b`).test(q)
      if (!exact && !contained) continue
      const candidate: SymptomMatch = { symptom: s, exact, matchedLength: t.length }
      if (
        !best ||
        (candidate.exact && !best.exact) ||
        (candidate.exact === best.exact && candidate.matchedLength > best.matchedLength)
      ) {
        best = candidate
      }
    }
  }
  return best
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const youngChildRegexes = (CAUTIONS.youngChildPatterns ?? []).map((p) => new RegExp(p, 'i'))

/**
 * Is this query about a child too young for cough and cold products? Drives the under-6 hard block.
 * Parses an actual age — the previous word-list version fired for "my son" at any age and missed
 * "for my 2 year old" entirely, which is the exact case the block exists for.
 */
export function mentionsYoungChild(query: string): boolean {
  const q = norm(query)
  return youngChildRegexes.some((re) => re.test(q))
}

export function resolveClass(c: SymptomClass, limit = 6): Product[] {
  return c.products.slice(0, limit).map((code) => productByCode.get(code)).filter(Boolean) as Product[]
}

/** Everything in a class, for the "show all" affordance. */
export function resolveAll(c: SymptomClass): Product[] {
  return c.products.map((code) => productByCode.get(code)).filter(Boolean) as Product[]
}

export const symptomsByArea = () => {
  const areas = new Map<string, Symptom[]>()
  for (const s of SYMPTOMS) {
    const a = areas.get(s.bodyArea)
    if (a) a.push(s); else areas.set(s.bodyArea, [s])
  }
  return areas
}

export const AREA_LABELS: Record<string, string> = {
  head: 'Head and sinuses',
  chest: 'Throat and chest',
  stomach: 'Stomach and digestion',
  skin: 'Skin',
  eyes: 'Eyes',
  sleep: 'Sleep',
  general: 'General',
}

void products // keep the dataset import alive for index construction ordering
