/**
 * Shared surface primitives.
 *
 * Before these existed, every screen re-declared its own `card` style — always the same 1px
 * #E6E6E6 border with no elevation — so nothing in the app had a consistent sense of depth and
 * every surface sat in the same plane as the page behind it. These are the three things a surface
 * can be (flat, raised, tinted), declared once.
 */
import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import { radius, space, type, elevation, HIT, type Palette } from '../theme'
import { useTheme } from '../theme-context'
import { Icon, type IconName } from './Icon'

/** A raised surface. `flat` drops the shadow for cards inside an already-raised panel. */
export function Card({
  children, style, flat, padded = true,
}: { children: React.ReactNode; style?: StyleProp<ViewStyle>; flat?: boolean; padded?: boolean }) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <View style={[styles.card, padded && styles.cardPadded, !flat && elevation(color, 1), style]}>
      {children}
    </View>
  )
}

/**
 * Section marker. All-caps, tracked out, with a rule running to the end of the line — the old
 * plain-bold-15px headings were the same weight as the body text under them, so the page had no
 * skimmable structure at all.
 */
export function SectionLabel({
  children, icon, right,
}: { children: React.ReactNode; icon?: IconName; right?: React.ReactNode }) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <View style={styles.sectionRow}>
      {icon ? <Icon name={icon} size={14} color={color.inkTertiary} /> : null}
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {typeof children === 'string' ? children.toUpperCase() : children}
      </Text>
      <View style={styles.sectionRule} />
      {right}
    </View>
  )
}

/** A large tappable tile — the landing's three primary actions. */
export function ActionTile({
  icon, title, subtitle, onPress, tone = 'neutral', style,
}: {
  icon: IconName
  title: string
  subtitle: string
  onPress: () => void
  tone?: 'neutral' | 'accent'
  style?: StyleProp<ViewStyle>
}) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [
        styles.tile,
        elevation(color, 1),
        tone === 'accent' && styles.tileAccent,
        pressed && styles.tilePressed,
        style,
      ]}
    >
      <View style={[styles.tileIcon, tone === 'accent' && styles.tileIconAccent]}>
        <Icon name={icon} size={19} color={tone === 'accent' ? color.accent : color.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </View>
      <Icon name="chevronRight" size={17} color={color.inkTertiary} />
    </Pressable>
  )
}

/** Primary / secondary button. Always a word, never a lone icon. */
export function Button({
  label, onPress, icon, variant = 'primary', style, full,
}: {
  label: string
  onPress: () => void
  icon?: IconName
  variant?: 'primary' | 'secondary' | 'ghost'
  style?: StyleProp<ViewStyle>
  full?: boolean
}) {
  const { color } = useTheme()
  const styles = useStyles()
  const fg = variant === 'primary' ? color.onDark : color.ink
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        full && { flex: 1 },
        pressed && { opacity: 0.72 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  )
}

/** Small status pill. `tone` carries the meaning; the text carries it too (WCAG 1.4.1). */
export function Pill({
  label, icon, tone = 'neutral',
}: { label: string; icon?: IconName; tone?: 'neutral' | 'dark' | 'accent' | 'verified' }) {
  const { color } = useTheme()
  const styles = useStyles()
  const fg =
    tone === 'dark' ? color.onDark
    : tone === 'accent' ? color.accentInk
    : tone === 'verified' ? color.verifiedInk
    : color.ink
  return (
    <View style={[styles.pill, styles[`pill_${tone}` as const]]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.lineMid,
    borderRadius: radius.lg,
  },
  cardPadded: { padding: space.lg },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 22 },
  sectionLabel: { ...type.overline, color: color.inkTertiary },
  sectionRule: { flex: 1, height: 1, backgroundColor: color.line },

  tile: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: color.surface,
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.lg,
    padding: space.lg, minHeight: 76,
  },
  tileAccent: { borderColor: color.accentLine, backgroundColor: color.accentSoft },
  tilePressed: { backgroundColor: color.surfaceAlt },
  tileIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: color.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  tileIconAccent: { backgroundColor: color.surface },
  tileTitle: { ...type.bodyStrong, color: color.ink },
  tileSubtitle: { ...type.small, color: color.inkTertiary },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    minHeight: HIT, paddingHorizontal: space.xl, borderRadius: radius.pill, borderWidth: 1,
  },
  btnPrimary: { backgroundColor: color.dark, borderColor: color.dark },
  btnSecondary: { backgroundColor: color.surface, borderColor: color.lineMid },
  btnGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  btnLabel: { ...type.bodyStrong },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingVertical: 5, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1,
  },
  pill_neutral: { backgroundColor: color.surfaceAlt, borderColor: color.lineMid },
  pill_dark: { backgroundColor: color.dark, borderColor: color.dark },
  pill_accent: { backgroundColor: color.accentSoft, borderColor: color.accentLine },
  pill_verified: { backgroundColor: color.verifiedBg, borderColor: color.verifiedLine },
  pillText: { ...type.micro },
})

function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
