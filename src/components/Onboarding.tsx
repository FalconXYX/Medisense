/**
 * First-run onboarding — an A4 fix. The study concluded the app needed "a short onboarding screen
 * explaining branding vs. generic medications and equivalency" because the core concept was not
 * universally understood.
 *
 * Three screens, skippable, shown once. It explains the CONCEPT; it is not a UI tour, because a
 * tour that explains a bad label leaves the bad label in place for every session after the first.
 * The labels were fixed first (see Badge.tsx).
 */
import { useState, useMemo } from 'react'
import { Modal, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLayout } from './Shell'
import { Icon } from './Icon'
import { radius, space, type, elevation, type Palette } from '../theme'
import { useTheme } from '../theme-context'

const STEPS = [
  {
    title: 'The same medicine has many names',
    body:
      'Advil, Motrin and Apo-Ibuprofen are all ibuprofen 200 mg. The brand on the box changes. ' +
      'The medicine inside does not.',
    art: 'names',
  },
  {
    title: 'Which is why the price changes',
    body:
      'Companies that did not develop or advertise the brand can sell the same active ingredient ' +
      'for less. MediSense shows you the brand you searched for, then everything equivalent to it ' +
      '— so you can compare the price tags yourself.',
    art: 'price',
  },
  {
    title: 'We show you what we checked',
    body:
      'No pharmacist works on this app. Instead, every product is matched against Health Canada’s ' +
      'public drug records, and we show you the record so you can check it yourself.',
    art: 'check',
  },
] as const

export function Onboarding({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const { color } = useTheme()
  const styles = useStyles()
  const [step, setStep] = useState(0)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { isWide } = useLayout()
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onDone}>
      {/* On a phone this fills the screen, as an onboarding flow should. On a desktop it becomes a
          card: three sentences and a diagram stretched across 1440px was the single most obviously
          unconsidered screen in the web build. */}
      <View style={[styles.outer, isWide && styles.outerWide]}>
      <View
        style={[
          styles.screen,
          isWide && [styles.screenWide, elevation(color, 3)],
          !isWide && { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg },
        ]}
      >
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          style={({ pressed }) => [styles.skip, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <View style={styles.content}>
          <Art kind={s.art} width={width} />
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
            ))}
          </View>
          <Pressable
            onPress={() => (last ? onDone() : setStep(step + 1))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.ctaText}>{last ? 'Start searching' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
      </View>
    </Modal>
  )
}

/** Small diagrams drawn in plain views — no assets, and they inherit the monochrome palette. */
function Art({ kind, width }: { kind: string; width: number }) {
  const { color } = useTheme()
  const styles = useStyles()
  const w = Math.min(width - space.xl * 2, 320)
  if (kind === 'names') {
    return (
      <View style={[styles.art, { width: w }]}>
        <View style={styles.artRow}>
          {['Advil', 'Motrin', 'Apo-Ibuprofen'].map((n) => (
            <View key={n} style={styles.box}><Text style={styles.boxText}>{n}</Text></View>
          ))}
        </View>
        <View style={styles.artArrow}><Icon name="chevronDown" size={20} color={color.inkTertiary} /></View>
        <View style={styles.pillBox}><Text style={styles.pillText}>ibuprofen 200 mg</Text></View>
      </View>
    )
  }
  if (kind === 'price') {
    return (
      <View style={[styles.art, { width: w }]}>
        <View style={styles.barRow}>
          <View style={styles.barLabelWrap}><Text style={styles.barLabel}>Advil</Text></View>
          <View style={[styles.bar, { flex: 1, backgroundColor: color.dark }]} />
          <Text style={styles.barValue}>Brand</Text>
        </View>
        <View style={styles.barRow}>
          <View style={styles.barLabelWrap}><Text style={styles.barLabel}>Apo-Ibuprofen</Text></View>
          <View style={[styles.bar, { flex: 0.44, backgroundColor: color.inkSecondary }]} />
          <Text style={styles.barValue}>Generic</Text>
        </View>
      </View>
    )
  }
  return (
    <View style={[styles.art, { width: w }]}>
      <View style={styles.checkRow}>
        <Icon name="verified" size={16} color={color.verified} />
        <Text style={styles.checkText}>Health Canada listed · DIN 01933531</Text>
      </View>
      <Text style={styles.checkNote}>Tap it, and we show you the record.</Text>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  outer: { flex: 1, backgroundColor: color.bg },
  outerWide: {
    backgroundColor: color.ground, alignItems: 'center', justifyContent: 'center', padding: space.xl,
  },
  screen: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.xl, justifyContent: 'space-between' },
  screenWide: {
    flex: 0, width: '100%', maxWidth: 520, minHeight: 560,
    borderRadius: radius.xl, borderWidth: 1, borderColor: color.lineMid,
    backgroundColor: color.surface, paddingVertical: space.xl,
  },
  skip: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  skipText: { ...type.smallStrong, color: color.inkSecondary },
  content: { flex: 1, justifyContent: 'center', gap: space.lg, alignItems: 'center' },
  title: { ...type.display, color: color.ink, textAlign: 'center' },
  body: { ...type.body, color: color.inkSecondary, textAlign: 'center', maxWidth: 330 },
  footer: { gap: space.lg },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.line },
  dotOn: { backgroundColor: color.ink, width: 20 },
  cta: {
    backgroundColor: color.dark, borderRadius: radius.pill,
    minHeight: 52, alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...type.bodyStrong, color: color.onDark },

  art: { gap: space.md, alignItems: 'center' },
  artRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  box: {
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.sm,
    paddingHorizontal: space.md, paddingVertical: 6, backgroundColor: color.surface,
  },
  boxText: { ...type.small, color: color.inkSecondary },
  artArrow: { alignItems: 'center' },
  pillBox: {
    backgroundColor: color.dark, borderRadius: radius.pill,
    paddingHorizontal: space.xl, paddingVertical: space.sm,
  },
  pillText: { ...type.bodyStrong, color: color.onDark },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, width: '100%' },
  barLabelWrap: { width: 86 },
  barLabel: { ...type.small, color: color.inkSecondary },
  bar: { height: 22, borderRadius: 4 },
  barValue: { ...type.smallStrong, color: color.ink, width: 82, textAlign: 'right' },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: color.verifiedBg, borderWidth: 1, borderColor: color.verifiedLine,
    borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  checkText: { ...type.smallStrong, color: color.verifiedInk, flexShrink: 1 },
  checkNote: { ...type.small, color: color.inkTertiary },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
