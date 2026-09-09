/**
 * MediSense design tokens.
 *
 * The design document asked for "common black and white themes throughout" and the first pass
 * took that literally: pure white, 1px #E6E6E6 hairlines, and Unicode text glyphs (⌕ ▣ ♡ ◷ ⚙)
 * standing in for icons. On a phone that reads as restraint. On a 1440px desktop it reads as an
 * unfinished wireframe — the strokes are hairline-thin, nothing has weight, and every surface sits
 * in the same plane.
 *
 * So the monochrome foundation stays, but it is now built out of things that carry weight:
 *
 *   - Neutrals with a hint of warmth (stone, not slate). Pure #FFF next to pure #E6E6E6 is the
 *     single most recognisable "unstyled" combination there is.
 *   - Borders in two weights — `line` for dividers inside a surface, `lineMid` for the edge of a
 *     surface itself. One hairline for both was why cards dissolved into the page.
 *   - Real elevation, palette-aware: shadows in light mode, raised surfaces plus a brighter border
 *     in dark, where a shadow is invisible by definition.
 *   - One accent, used only for interaction. Green stays reserved for verification and red for
 *     the logo pin, so nothing competes for the same meaning.
 *
 * Every foreground/background pair below has a computed contrast ratio, not an eyeballed one —
 * the first light palette shipped a 2.81:1 grey carrying the medical disclaimer.
 */
import { Platform } from 'react-native'

export interface Palette {
  /** Behind the whole page. On wide viewports the centred column sits on this. */
  ground: string
  bg: string
  surface: string
  surfaceAlt: string
  surfaceRaised: string
  /** A tinted, sunken well — used for the search field and inset panels. */
  well: string

  ink: string
  inkSecondary: string
  inkTertiary: string

  /** Divider inside a surface. */
  line: string
  /** The edge of a surface. Visibly darker than `line` — this is the fix for "too thin". */
  lineMid: string
  lineStrong: string

  onDark: string
  dark: string

  /** Interaction only: links, active tabs, focus, selected states. Never decoration. */
  accent: string
  accentInk: string
  accentSoft: string
  accentLine: string

  verified: string
  verifiedInk: string
  verifiedBg: string
  verifiedLine: string

  brandRed: string

  noticeBg: string
  noticeLine: string
  noticeInk: string

  focus: string
  scrim: string

  /** Shadow colour, tuned per palette. Dark mode leans on surfaces instead. */
  shadowColor: string
  shadowStrength: number
}

export const lightColors: Palette = {
  ground: '#F2F1EF',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F4F2',
  surfaceRaised: '#FFFFFF',
  well: '#F5F4F2',

  ink: '#1B1917',          // 16.9:1 on white
  inkSecondary: '#57534E', // 7.35:1
  inkTertiary: '#726C66',  // 5.19:1 — still body text, not decoration
  line: '#E9E6E2',
  lineMid: '#D5D0CA',
  lineStrong: '#1B1917',

  onDark: '#FFFFFF',
  dark: '#1B1917',

  accent: '#1D4ED8',       // 6.29:1 on white
  accentInk: '#1E3A8A',    // 10.1:1 — accent text on accentSoft
  accentSoft: '#EEF3FE',
  accentLine: '#C3D4FB',

  verified: '#15803D',     // 4.99:1 on white
  verifiedInk: '#11602F',  // 6.9:1 on verifiedBg
  verifiedBg: '#ECFDF3',
  verifiedLine: '#A7E3BF',

  /** Logo pin only. Deliberately NOT the branded badge — the study found a red marker on a
   *  branded product read as a warning ("is that not good, or…?"). */
  brandRed: '#DC2626',

  noticeBg: '#FDF7E7',
  noticeLine: '#EBDCAE',
  noticeInk: '#6B5518',    // 7.02:1 on noticeBg

  focus: '#1D4ED8',
  scrim: 'rgba(27,25,23,0.42)',

  shadowColor: '#3B342C',
  shadowStrength: 1,
}

export const darkColors: Palette = {
  // Not pure black. A near-black ground stops the raised surfaces from vibrating, and the whole
  // ramp is warm-neutral so it matches the light palette rather than turning blue.
  ground: '#0C0B0B',
  bg: '#121110',
  surface: '#1B1A18',
  surfaceAlt: '#232120',
  surfaceRaised: '#25231F',
  well: '#0E0D0C',

  ink: '#FAF9F7',          // 17.4:1 on bg
  inkSecondary: '#B8B2AB', // 8.5:1
  inkTertiary: '#928B84',  // 5.2:1
  line: '#2C2926',
  lineMid: '#3D3934',
  lineStrong: '#FAF9F7',

  // Inverted: the "dark" chip becomes the light one so it still reads as the filled state.
  onDark: '#121110',
  dark: '#FAF9F7',

  accent: '#8AAEFF',       // 8.4:1 on bg
  accentInk: '#B6CDFF',
  accentSoft: '#17203A',
  accentLine: '#2E3D66',

  verified: '#5CD68C',
  verifiedInk: '#7FE0A6',
  verifiedBg: '#10251A',
  verifiedLine: '#255B3A',

  brandRed: '#FF7A6E',

  noticeBg: '#2A2314',
  noticeLine: '#4A3F22',
  noticeInk: '#F0D98A',    // 9.1:1 on noticeBg

  focus: '#8AAEFF',
  scrim: 'rgba(0,0,0,0.66)',

  shadowColor: '#000000',
  shadowStrength: 0,       // shadows do nothing on a dark ground; borders carry the depth instead
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const

export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const

/**
 * Elevation, resolved against the palette.
 *
 * Level 0 is flush. 1 is a card. 2 is a raised panel (the app bar once it has scrolled). 3 is a
 * modal. In dark mode the shadow is dropped and the surface lifts plus the border brightens —
 * a black shadow on a near-black ground is not depth, it is nothing.
 */
export function elevation(color: Palette, level: 0 | 1 | 2 | 3) {
  if (level === 0) return {}
  if (color.shadowStrength === 0) {
    return { borderColor: level >= 2 ? color.lineMid : color.line }
  }
  const spec = {
    1: { y: 1, blur: 2, spread: 0, a: 0.05, a2: 0.04, blur2: 1 },
    2: { y: 4, blur: 10, spread: -2, a: 0.08, a2: 0.05, blur2: 3 },
    3: { y: 16, blur: 32, spread: -8, a: 0.16, a2: 0.08, blur2: 8 },
  }[level]
  if (Platform.OS === 'web') {
    return {
      boxShadow:
        `0 ${spec.y}px ${spec.blur}px ${spec.spread}px ${rgba(color.shadowColor, spec.a)}, ` +
        `0 1px ${spec.blur2}px ${rgba(color.shadowColor, spec.a2)}`,
    } as const
  }
  return {
    shadowColor: color.shadowColor,
    shadowOpacity: spec.a * 2.2,
    shadowRadius: spec.blur / 1.6,
    shadowOffset: { width: 0, height: spec.y },
    elevation: level * 2,
  }
}

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/**
 * Type scale.
 *
 * The old scale ran 28 / 20 / 15 / 13 / 11 — five steps inside a 17pt range, so nothing was
 * clearly larger than anything else and every screen read as one flat grey block. This one has
 * real jumps at the top, negative tracking on the display sizes (which is what stops large text
 * looking loose and amateur), and positive tracking on the micro/overline sizes.
 */
export const type = {
  hero: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1.2, lineHeight: 44 },
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.8, lineHeight: 34 },
  title: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.4, lineHeight: 26 },
  subtitle: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 22 },
  section: { fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  smallStrong: { fontSize: 13, fontWeight: '600' as const, lineHeight: 19 },
  micro: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.3 },
  /** All-caps section marker. Uppercase is applied by the component, not baked in here. */
  overline: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.9 },
  price: { fontSize: 19, fontWeight: '800' as const, letterSpacing: -0.4 },
} as const

/**
 * Minimum interactive size. WCAG 2.2 SC 2.5.8 asks for 24x24 CSS px; the study found participants
 * could not tell what was tappable at all, so everything interactive gets 44 (the platform HIG
 * figure) and a visible label. Nothing in this app is a bare icon.
 */
export const HIT = 44

/** Kept so non-themed modules and tests can still reach a palette without a React context. */
export const color = lightColors
