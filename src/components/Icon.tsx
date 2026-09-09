/**
 * The icon set.
 *
 * Everything in this app used to draw its icons with Unicode text — ⌕ for search, ▣ for the
 * camera, ♡ ◷ ⚙ for the chips, › ⌄ for chevrons, ● ○ ✓ for badges. That is why the interface read
 * as thin and unfinished: those glyphs come from whatever fallback font the platform picks, so
 * their stroke weight, optical size and baseline are all different from each other and none of
 * them match the UI text they sit beside. On a desktop at 2x they are visibly hairline.
 *
 * These are real vector icons from a single family (Ionicons, already a dependency via
 * @expo/vector-icons) at one consistent weight, addressed by *semantic* name. Components ask for
 * `scan` or `verified`, never for a specific glyph — so the family can be swapped in one place and
 * nothing else has to know.
 *
 * Icons are always decorative here: every one of them sits beside a visible text label (the A4
 * fix), so they are hidden from screen readers rather than announced twice.
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import type { StyleProp, TextStyle } from 'react-native'

/**
 * Semantic name -> Ionicons glyph.
 *
 * Filled variants for states that are "on" or that need presence at small sizes; outline for the
 * resting state. The pairs are deliberate — a heart that only changes colour is a WCAG 1.4.1
 * problem, one that also fills is not.
 */
const GLYPH = {
  search: 'search',
  scan: 'scan-outline',
  camera: 'camera-outline',
  lens: 'sparkles-outline',
  barcode: 'barcode-outline',

  heart: 'heart-outline',
  heartOn: 'heart',
  history: 'time-outline',
  filters: 'options-outline',

  chevronRight: 'chevron-forward',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  chevronLeft: 'chevron-back',
  close: 'close',
  external: 'open-outline',

  info: 'information-circle-outline',
  help: 'help-circle-outline',
  warning: 'warning-outline',
  alert: 'alert-circle',
  check: 'checkmark',
  checkCircle: 'checkmark-circle',
  verified: 'shield-checkmark',
  document: 'document-text-outline',

  pill: 'medkit-outline',
  swap: 'swap-horizontal',
  tag: 'pricetag-outline',
  savings: 'trending-down',

  map: 'map-outline',
  pin: 'location',
  pinOutline: 'location-outline',
  store: 'storefront-outline',
  directions: 'navigate',
  copy: 'copy-outline',
  distance: 'walk-outline',
  star: 'star',

  auto: 'contrast-outline',
  light: 'sunny-outline',
  dark: 'moon-outline',

  refresh: 'refresh',
  image: 'image-outline',
  flash: 'flash-outline',
  flashOff: 'flash-off-outline',
  phone: 'call-outline',
} as const

/**
 * Body-area glyphs for the symptom picker, from MaterialCommunityIcons — Ionicons has no anatomy.
 * The picker used to be 22 identical text pills, which gave the user nothing to aim at; these turn
 * it into something scannable by region.
 */
const MC_GLYPH = {
  head: 'head-outline',
  stomach: 'stomach',
  chest: 'lungs',
  sleep: 'sleep',
  skin: 'hand-back-right-outline',
  eyes: 'eye-outline',
  general: 'human',
  capsule: 'pill',
  bag: 'medical-bag',
  thermometer: 'thermometer',
  muscle: 'arm-flex-outline',
  allergy: 'allergy',
  burn: 'fire',
  bandage: 'bandage',
  foot: 'foot-print',
  face: 'face-man-outline',
  voice: 'account-voice',
  drop: 'water-outline',
} as const

/**
 * Per-symptom overrides. `bodyArea` alone put a torso figure on Fever and a pair of lungs on
 * sore throat, which is not wrong but is not recognisable either. Where a specific glyph reads
 * faster than the region, it wins; everything else falls through to the body area.
 */
const SYMPTOM_ICON: Record<string, BodyIconName> = {
  fever: 'thermometer',
  'muscle-joint-pain': 'muscle',
  allergies: 'allergy',
  'sore-throat': 'voice',
  heartburn: 'burn',
  'minor-cuts': 'bandage',
  'athletes-foot': 'foot',
  acne: 'face',
  'dry-eyes': 'drop',
}

export type IconName = keyof typeof GLYPH
export type BodyIconName = keyof typeof MC_GLYPH

export function Icon({
  name, size = 18, color, style,
}: {
  name: IconName
  size?: number
  color: string
  style?: StyleProp<TextStyle>
}) {
  return (
    <Ionicons
      name={GLYPH[name] as never}
      size={size}
      color={color}
      style={style}
      // Decorative by construction — there is a text label next to every one of these.
      accessible={false}
      aria-hidden
    />
  )
}

/** Same contract, different family. Kept separate so the two sets cannot be confused at a call site. */
export function BodyIcon({
  name, size = 18, color, style,
}: {
  name: BodyIconName
  size?: number
  color: string
  style?: StyleProp<TextStyle>
}) {
  return (
    <MaterialCommunityIcons
      name={MC_GLYPH[name] as never}
      size={size}
      color={color}
      style={style}
      accessible={false}
      aria-hidden
    />
  )
}

/** Picks the glyph for a symptom: specific override first, then body area, then a generic figure. */
export function bodyIconFor(area: string, id?: string): BodyIconName {
  if (id && SYMPTOM_ICON[id]) return SYMPTOM_ICON[id]
  return (area in MC_GLYPH ? area : 'general') as BodyIconName
}
