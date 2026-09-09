import { useMemo } from 'react'
/**
 * Verification badges.
 *
 * ADR-005 — these replace "Pharmacist Verified". The badge asserts a SOURCE, not a reviewer:
 * legally we cannot imply a pharmacist reviewed anything (Ontario Pharmacy Act s.10/s.12), the
 * Health Canada data licence forbids implying endorsement, and the usability study found nobody
 * could define "pharmacist verified" anyway.
 *
 * Every badge carries a permanently visible text label — never a bare icon. The study's single
 * worst task was participants failing to recognise an unlabelled green checkmark as interactive
 * (4 errors each). NN/g: icon labels must be visible without interaction; hover "fails to
 * translate well on touch devices". Meaning is carried by shape and text, not colour alone
 * (WCAG 2.2 SC 1.4.1) — which is also why these are a shield, a pill and a swap arrow rather
 * than three differently-coloured dots.
 */
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native'
import { radius, space, type, HIT, type Palette } from '../theme'
import { useTheme } from '../theme-context'
import { Icon } from './Icon'

interface Props {
  onPress?: () => void
  style?: ViewStyle
}

/**
 * Every product in the catalogue has a DIN and is Marketed — this is a checkable fact.
 * `compact` is the in-card form: same words, no fill, so a list of cards is not a wall of green.
 */
export function HealthCanadaBadge({
  din, onPress, style, compact,
}: Props & { din: string; compact?: boolean }) {
  const { color } = useTheme()
  const styles = useStyles()
  const body = (
    <View style={[compact ? styles.badgeCompact : styles.badge, !compact && styles.verified, style]}>
      <Icon name="verified" size={compact ? 13 : 15} color={color.verified} />
      <Text
        style={compact ? styles.compactText : styles.verifiedText}
        numberOfLines={1}
      >
        Health Canada listed · DIN {din}
      </Text>
      {onPress ? <Icon name="chevronRight" size={16} color={color.verified} style={{ marginLeft: 'auto' }} /> : null}
    </View>
  )
  if (!onPress) return body
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Health Canada listed, DIN ${din}. See how we checked this.`}
      hitSlop={8}
      style={({ pressed }) => [{ minHeight: HIT, justifyContent: 'center' }, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
}

/**
 * Names the specific product AND strength, never just the brand family — "Advil" spans at least
 * seven Active Ingredient Groups, so "same as Advil" would be ambiguous and overclaiming.
 */
export function SameIngredientBadge({ reference, style }: { reference: string; style?: ViewStyle }) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <View style={[styles.badge, styles.neutral, style]}>
      <Icon name="swap" size={15} color={color.inkSecondary} />
      <Text style={styles.neutralText} numberOfLines={2}>
        Same ingredient and strength as {reference}
      </Text>
    </View>
  )
}

/**
 * Replaces the red octagon. The study: "So this is branded… is that not good, or…?" — a red
 * warning shape on a branded product read as a hazard. A neutral tag glyph and the plain word
 * carry the meaning instead.
 */
export function BrandedBadge() {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <View style={[styles.tag, styles.tagDark]}>
      <Icon name="tag" size={13} color={color.onDark} />
      <Text style={styles.tagDarkText}>Brand name</Text>
    </View>
  )
}

/**
 * Replaces the thumbs-up, which the study found confusing ("Thumbs up is a bit confusing").
 *
 * `count` is how many are actually CHEAPER; `total` is how many equivalents exist. Saying
 * "N lower-cost alternatives" when N counted every equivalent was simply false — 138 of 231 brand
 * searches listed at least one alternative priced above the brand, and one was 218% of it.
 * Equivalence and price are different claims, so the badge now makes them separately.
 */
export function AlternativeBadge({ count, total }: { count: number; total: number }) {
  const { color } = useTheme()
  const styles = useStyles()
  const label =
    count === 0
      ? `${total} equivalent ${total === 1 ? 'product' : 'products'}, none cheaper`
      : count === total
        ? `${count} lower-cost ${count === 1 ? 'alternative' : 'alternatives'}`
        : `${count} of ${total} equivalents cost less`
  return (
    <View style={[styles.tag, styles.tagLight]}>
      <Icon name={count === 0 ? 'swap' : 'savings'} size={13} color={color.ink} />
      <Text style={styles.tagLightText}>{label}</Text>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  badgeCompact: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  compactText: { ...type.small, color: color.inkSecondary, fontSize: 11.5, flexShrink: 1 },
  verified: { backgroundColor: color.verifiedBg, borderColor: color.verifiedLine },
  neutral: { backgroundColor: color.surfaceAlt, borderColor: color.lineMid },
  verifiedText: { ...type.smallStrong, color: color.verifiedInk, flexShrink: 1 },
  neutralText: { ...type.small, color: color.ink, flexShrink: 1 },
  pressed: { opacity: 0.6 },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tagDark: { backgroundColor: color.dark, borderColor: color.dark },
  tagLight: { backgroundColor: color.surface, borderColor: color.ink },
  tagDarkText: { ...type.micro, color: color.onDark },
  tagLightText: { ...type.micro, color: color.ink },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
