/** Text normalization shared across the pipeline. */

/** Collapse whitespace, uppercase, strip punctuation that varies between sources. */
export function norm(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // ACÉTAMINOPHÈNE -> ACETAMINOPHENE
    .toUpperCase()
    .replace(/[‐-―]/g, '-')   // DPD uses U+2011 non-breaking hyphens
    .replace(/[^A-Z0-9%./+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Strip salt/ester suffixes so PSEUDOEPHEDRINE HYDROCHLORIDE and PSEUDOEPHEDRINE SULFATE
 * both reduce to PSEUDOEPHEDRINE. Used for symptom matching and display, never for the
 * equivalence key (where DPD's own ai_group_no already handles it).
 */
const SALTS = [
  'HYDROCHLORIDE', 'HYDROBROMIDE', 'SULFATE', 'SULPHATE', 'MALEATE', 'NITRATE', 'CITRATE',
  'TARTRATE', 'ACETATE', 'PHOSPHATE', 'SODIUM', 'POTASSIUM', 'CALCIUM', 'MAGNESIUM',
  'BITARTRATE', 'FUMARATE', 'SUCCINATE', 'MESYLATE', 'BESYLATE', 'DIHYDRATE', 'MONOHYDRATE',
  'ANHYDROUS', 'MICRONIZED', 'HCL', 'HBR',
]
export function baseIngredient(name: string): string {
  // DPD writes the active moiety then the salt actually used, as
  // "EPINEPHRINE (EPINEPHRINE BITARTRATE)" / "POLYMYXIN B (POLYMYXIN B SULFATE)".
  // Take the moiety. Split on " (" specifically so CHLORDAN(E) survives intact.
  const paren = name.indexOf(' (')
  const s = norm(paren > 0 ? name.slice(0, paren) : name)
  // Strip salt words only AFTER the first token. "DICLOFENAC SODIUM" -> DICLOFENAC, but
  // CALCIUM CARBONATE, SODIUM BICARBONATE and MAGNESIUM HYDROXIDE keep their leading cation.
  const tokens = s.split(' ')
  const kept = tokens.filter((t, i) => i === 0 || !SALTS.includes(t))
  return kept.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * INN -> USAN aliases. DPD and openFDA use different vocabularies and the mismatch is silent:
 * DPD says ACETYLSALICYLIC ACID, openFDA has zero OTC labels under that name and 701 under
 * "aspirin". A pass-through lookup returns nothing and looks like missing coverage.
 */
export const INN_TO_USAN: Record<string, string> = {
  'ACETYLSALICYLIC ACID': 'aspirin',
  'ACETAMINOPHEN': 'acetaminophen',
  'PARACETAMOL': 'acetaminophen',
  'ADRENALINE': 'epinephrine',
  'SALBUTAMOL': 'albuterol',
  'DIMENHYDRINATE': 'dimenhydrinate',
  'ACETYLCYSTEINE': 'acetylcysteine',
  'BECLOMETASONE': 'beclomethasone',
  'GLYCERIN': 'glycerin',
  'GLYCEROL': 'glycerin',
  'LIDOCAINE': 'lidocaine',
  'LIGNOCAINE': 'lidocaine',
}
export function toUsan(inn: string): string {
  const b = baseIngredient(inn)
  return INN_TO_USAN[b] ?? b.toLowerCase()
}

/** Title-case a DPD SHOUTED brand name for display: "ADVIL CAPLETS" -> "Advil Caplets". */
export function titleCase(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(/\b(Usp|Bp|Ip|Hcl|Er|Xr|Sr|Mg|Ml)\b/g, (m) => m.toUpperCase())
}
