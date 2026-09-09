/**
 * The two safety gates that sit between a symptom and a product list. ADR-008.
 *
 * TIER 2 (RedFlagScreen) is a HARD STOP: no products, no "continue anyway" button. These are
 * presentations where reaching for a shelf medicine is the wrong action.
 *
 * TIER 1 (CautionPanel) is a soft gate — one tap to continue — and it is deliberately framed as a
 * feature rather than a nag: it routes to the pharmacist, who is free, needs no appointment, and is
 * standing in every pharmacy the map tab already knows about.
 */
import { useEffect, useRef, useMemo } from 'react'
import {
  View, Text, Pressable, StyleSheet, Linking, AccessibilityInfo, findNodeHandle, Platform,
} from 'react-native'
import { Icon } from './Icon'
import { radius, space, type, type Palette } from '../theme'
import { useTheme } from '../theme-context'
import type { RedFlag, Symptom } from '../lib/symptoms'

export function RedFlagScreen({ flag, onBack }: { flag: RedFlag; onBack: () => void }) {
  const { color } = useTheme()
  const styles = useStyles()
  const heading = useRef<Text>(null)

  // The screen replaces the results in place, so a screen reader has nothing to announce and the
  // focus stays wherever it was — a blind user submitting "chest pain" would hear silence. Move
  // focus to the heading and mark the region assertive so it interrupts.
  useEffect(() => {
    // findNodeHandle throws on web ("not supported ... use the ref property"). On web the
    // assertive live region below is what carries the announcement; on native we also move focus.
    if (Platform.OS !== 'web') {
      try {
        const tag = heading.current && findNodeHandle(heading.current)
        if (tag) AccessibilityInfo.setAccessibilityFocus(tag)
      } catch {
        /* focus is best-effort; the live region still announces */
      }
    }
    AccessibilityInfo.announceForAccessibility(
      `Urgent. ${flag.label}. This needs urgent medical attention, not an over-the-counter medicine. Call 9 1 1.`,
    )
  }, [flag])

  return (
    <View
      style={styles.urgent}
      accessibilityLiveRegion="assertive"
      accessibilityViewIsModal
    >
      <View style={styles.urgentBadge} accessibilityElementsHidden importantForAccessibility="no">
        <Icon name="alert" size={34} color={color.brandRed} />
      </View>
      <Text ref={heading} accessibilityRole="header" style={styles.urgentTitle}>
        This needs urgent medical attention
      </Text>
      <Text style={styles.urgentBody}>
        {flag.label} is not something to treat with an over-the-counter medicine.
      </Text>

      <Pressable
        onPress={() => Linking.openURL('tel:911')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.urgentCta, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.urgentCtaText}>Call 911</Text>
      </Pressable>

      <Pressable
        onPress={() => Linking.openURL('tel:18002689017')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.urgentSecondary, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.urgentSecondaryText}>Ontario Poison Centre — 1-800-268-9017</Text>
      </Pressable>

      <Text style={styles.urgentNote}>
        Or go to your nearest emergency department. If you are unsure, Health811 (dial 811) can talk
        it through with a nurse, free, at any hour.
      </Text>

      {/* There is deliberately no "show me products anyway". */}
      <Pressable onPress={onBack} accessibilityRole="button" style={styles.urgentBack}>
        <Text style={styles.urgentBackText}>Search for something else</Text>
      </Pressable>
    </View>
  )
}

export function CautionPanel({
  symptom, hardBlockUnderSix,
}: { symptom: Symptom; hardBlockUnderSix: boolean }) {
  const styles = useStyles()

  if (hardBlockUnderSix) {
    return (
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Not for children under 6</Text>
        <Text style={styles.blockBody}>
          Health Canada advises that cough and cold products should not be used in children under
          six years of age. Talk to a pharmacist or doctor about what is appropriate instead.
        </Text>
        {/* This used to push /search?q=pharmacy, which renders "Nothing found for 'pharmacy'" —
            a dead end at the one moment the user most needs somewhere to go. */}
        <Pressable
          onPress={() => Linking.openURL('https://www.google.com/maps/search/?api=1&query=pharmacy+near+me')}
          accessibilityRole="button"
          accessibilityLabel="Find a pharmacy near me, opens maps"
          style={({ pressed }) => [styles.blockCta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.blockCtaText}>Find a pharmacy near me</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.caution}>
      <Text style={styles.cautionTitle}>Before you choose</Text>
      <Text style={styles.cautionBody}>
        See someone about this if you have {symptom.seeSomeoneAfter}.
      </Text>
      <Text style={styles.cautionBody}>
        A pharmacist can tell you whether any of these suit you — especially if you are pregnant or
        breastfeeding, buying for a child or someone over 65, taking other medicines, or managing a
        long-term condition. It is free and needs no appointment.
      </Text>
    </View>
  )
}

/** Shown under every symptom result list. Tier 0 — always present, never dismissible. */
export function SymptomFooter({ symptom }: { symptom: Symptom }) {
  const styles = useStyles()
  return (
    <Text style={styles.footer}>
      MediSense groups non-prescription products by Health Canada&apos;s own therapeutic
      classification, using a hand-checked list of the ingredient classes used for this symptom
      ({symptom.source.title}). It does not diagnose, and it does not recommend one product over
      another. Talk to a pharmacist or doctor before starting any medicine.
    </Text>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  urgent: { padding: space.xl, gap: space.md, alignItems: 'center', flex: 1, justifyContent: 'center' },
  urgentBadge: {
    width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.surfaceAlt, borderWidth: 2, borderColor: color.brandRed,
    marginBottom: space.xs,
  },
  urgentTitle: { ...type.display, color: color.ink, textAlign: 'center', maxWidth: 460 },
  urgentBody: { ...type.body, color: color.inkSecondary, textAlign: 'center', maxWidth: 420 },
  urgentCta: {
    backgroundColor: color.brandRed, borderRadius: radius.pill,
    paddingHorizontal: space.xxl, minHeight: 56, alignItems: 'center', justifyContent: 'center',
    // alignSelf 'stretch' plus a maxWidth is a trap: the item stretches to the container but the
    // cap then pins it to the START edge, so on a 1440px window the Call 911 button rendered
    // hard against the left of the screen with the text it belongs to centred 500px away.
    alignSelf: 'center', width: '100%', maxWidth: 460, marginTop: space.sm,
  },
  urgentCtaText: { ...type.title, color: color.onDark },
  urgentSecondary: {
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.pill,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', width: '100%', maxWidth: 460,
  },
  urgentSecondaryText: { ...type.smallStrong, color: color.ink },
  urgentNote: { ...type.small, color: color.inkSecondary, textAlign: 'center', maxWidth: 420 },
  urgentBack: { minHeight: 44, justifyContent: 'center', marginTop: space.sm },
  urgentBackText: { ...type.smallStrong, color: color.inkSecondary, textDecorationLine: 'underline' },

  block: {
    borderWidth: 1, borderColor: color.brandRed, borderLeftWidth: 4, borderRadius: radius.lg,
    backgroundColor: color.surface, padding: space.lg, gap: space.sm,
  },
  blockTitle: { ...type.subtitle, color: color.brandRed },
  blockBody: { ...type.body, color: color.ink },
  blockCta: {
    backgroundColor: color.dark, borderRadius: radius.pill, minHeight: 48,
    alignItems: 'center', justifyContent: 'center', marginTop: space.xs,
  },
  blockCtaText: { ...type.bodyStrong, color: color.onDark },

  caution: {
    backgroundColor: color.noticeBg, borderRadius: radius.lg, padding: space.lg, gap: space.sm,
    borderWidth: 1, borderColor: color.noticeLine, borderLeftWidth: 4,
  },
  cautionTitle: { ...type.subtitle, color: color.noticeInk },
  // Capped, not stretched. The results column is 1,080px wide because it holds tiled cards, but
  // this is prose — at full width the safety copy ran to about 145 characters a line, which is
  // roughly double the point at which a reader starts losing their place returning to the left.
  cautionBody: { ...type.small, color: color.noticeInk, maxWidth: 720 },
  footer: { ...type.small, color: color.inkTertiary, fontSize: 12, marginTop: space.md, maxWidth: 700 },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
