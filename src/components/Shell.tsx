import { useMemo } from 'react'
/**
 * Responsive layout shell.
 *
 * The app is designed mobile-first (375 x 812) and that is the right primary target — but the web
 * export was rendering the phone layout full-bleed, so at 1440px a product card was 1,374px wide
 * with the price stranded 1,200px from the name it belongs to. A phone layout stretched across a
 * desktop is not a desktop layout.
 *
 * The first fix centred everything at one 680px measure, which stopped the stretching but left a
 * narrow strip of phone floating on a grey field. So there are now two measures, because a page
 * has two different jobs:
 *
 *   READ  (720) — prose, results, product detail. Bounded by legibility: past ~75 characters a
 *                 line is measurably harder to track back from, and no amount of screen width
 *                 changes that.
 *   WIDE (1080) — the landing grid, the map, anything whose content is tiles rather than lines.
 *                 Bounded by the tiles, not by the reader.
 *
 * Below WIDE nothing changes at all, so the phone build is untouched.
 */
import { View, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native'
import { space, type Palette } from '../theme'
import { useTheme } from '../theme-context'

/** Above this the viewport is not a phone and the full-bleed layout stops making sense. */
export const WIDE = 700
/** Above this there is room for two cards side by side. */
export const EXTRA_WIDE = 1080
/** Reading measure — roughly 72 characters at our body size. */
export const CONTENT_MAX = 720
/** Grid measure, for tiled content that is not read line by line. */
export const WIDE_MAX = 1080

export function useLayout() {
  const { width } = useWindowDimensions()
  return {
    width,
    isWide: width >= WIDE,
    isExtraWide: width >= EXTRA_WIDE,
    /** Two-column card grid only when each column still gets a sensible width. */
    columns: width >= EXTRA_WIDE ? 2 : 1,
  }
}

/** Page ground. The content surface on a phone; a recessed ground on a desktop. */
export function Page({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const styles = useStyles()
  const { isWide } = useLayout()
  return (
    <View style={[styles.page, isWide && styles.pageWide, style]}>
      {children}
    </View>
  )
}

/**
 * Centres and constrains its children on wide viewports, and does nothing on a phone.
 * `bleed` keeps the horizontal padding off, for rows that manage their own.
 */
export function Contained({
  children, style, bleed, max = CONTENT_MAX,
}: { children: React.ReactNode; style?: ViewStyle; bleed?: boolean; max?: number }) {
  const styles = useStyles()
  const { isWide } = useLayout()
  return (
    <View
      style={[
        styles.contained,
        isWide && { maxWidth: max, alignSelf: 'center' as const },
        !bleed && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  )
}

/**
 * A card stack that becomes a two-column grid when there is room. Falls back to a plain stack on
 * a phone, so the mobile rendering is byte-identical to what it was.
 */
export function CardGrid({
  children, gap = space.md, min = 320,
}: { children: React.ReactNode; gap?: number; min?: number }) {
  const styles = useStyles()
  const { columns } = useLayout()
  if (columns === 1) return <View style={{ gap }}>{children}</View>
  return (
    <View style={[styles.grid, { gap }]}>
      {Array.isArray(children)
        ? children.map((c, i) => (
            <View key={i} style={[styles.gridCell, { minWidth: min }]}>{c}</View>
          ))
        : children}
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  page: { flex: 1, backgroundColor: color.bg },
  pageWide: { backgroundColor: color.ground },
  contained: { width: '100%' },
  padded: { paddingHorizontal: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // flexBasis just under half so two fit per row once the gap is taken out.
  gridCell: { flexBasis: '48%', flexGrow: 1 },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
