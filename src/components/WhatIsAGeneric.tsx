import { useMemo } from "react";
/**
 * "What is a generic?" — the A4 fix for the study's clearest comprehension failure
 * ("what do you mean by generic?", and "is that not good, or…?" about the branded marker).
 *
 * REWRITTEN FOR LENGTH. The first version answered the question in four stacked slabs of grey
 * prose, about 400 words, with the actual answer buried in the second paragraph of the first one.
 * That is the wrong shape for this: NHS research finds roughly 4 in 10 adults struggle with
 * public-health content, rising to about 6 in 10 once it contains numbers — and the person opening
 * this panel has already told you they do not know the word. A wall of text is how you lose them.
 *
 * So the structure is now: the answer in one sentence, the same fact as a picture, three short
 * lines for what is and is not shared, and the regulatory detail last and small. Same information,
 * about half the words, and nothing above the fold that needs re-reading.
 *
 * ACCURACY (ADR-006) is unchanged — both traps still avoided deliberately:
 *  - The bioequivalence standard is GENERAL CONTEXT about how Canada approves generics. It is never
 *    rendered as "Health Canada found these two products bioequivalent", because many OTC products
 *    are authorised under a Category IV Monograph with no comparative bioavailability study at all.
 *  - Canada puts the 90% confidence interval on AUC only; Cmax is a relative mean. The FDA applies
 *    the interval to both. One jurisdiction per sentence.
 */
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, space, type, type Palette } from "../theme";
import { useTheme } from "../theme-context";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";

const FACTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "checkCircle",
    title: "What is the same",
    body: "The active ingredient, its strength, the form it comes in, and how you take it.",
  },
  {
    icon: "swap",
    title: "What can differ",
    body: "Colour, shape, flavour, and the non-medicinal ingredients — worth checking if you have an allergy.",
  },
  {
    icon: "savings",
    title: "Why it costs less",
    body: "The other company did not pay to develop or advertise the brand.",
  },
];

const SOURCES = [
  {
    title: "Health Canada — Safety and effectiveness of generic drugs",
    url: "https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/fact-sheets/safety-effectiveness-generic-drugs.html",
  },
  {
    title: "Health Canada — Comparative Bioavailability Standards",
    url: "https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/applications-submissions/guidance-documents/bioavailability-bioequivalence/comparative-bioavailability-standards-formulations-used-systemic-effects.html",
  },
  {
    title: "U.S. FDA — Generic drug facts",
    url: "https://www.fda.gov/drugs/generic-drugs/generic-drug-facts",
  },
];

export function WhatIsAGeneric({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="What is a generic?"
      maxWidth={560}
    >
      {/* The answer, first, in one sentence. */}
      <Text style={styles.lead}>
        The same medicine, sold under a different name — usually for less.
      </Text>

      {/* And the same fact as a picture, for anyone who did not read the sentence. */}
      <View style={styles.diagram}>
        <View style={styles.brandRow}>
          {["Advil", "Motrin", "Apo-Ibuprofen"].map((n) => (
            <View key={n} style={styles.brand}>
              <Text style={styles.brandText}>{n}</Text>
            </View>
          ))}
        </View>
        <Icon name="chevronDown" size={18} color={color.inkTertiary} />
        <View style={styles.pill}>
          <Text style={styles.pillText}>ibuprofen 200 mg</Text>
        </View>
        <Text style={styles.diagramNote}>
          Three boxes. One medicine. The brand changes; what is inside does not.
        </Text>
      </View>

      {FACTS.map((f) => (
        <View key={f.title} style={styles.fact}>
          <Icon
            name={f.icon}
            size={17}
            color={color.inkSecondary}
            style={{ marginTop: 2 }}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.factTitle}>{f.title}</Text>
            <Text style={styles.factBody}>{f.body}</Text>
          </View>
        </View>
      ))}

      {/* The number, last and small. */}
      <View style={styles.detail}>
        <Text style={styles.detailTitle}>
          How Canada decides they work the same
        </Text>
        <Text style={styles.detailBody}>
          Where a generic is approved by comparison to an existing product,
          Health Canada requires the 90% confidence interval for the amount
          absorbed to fall within <Text style={styles.b}>80.0%–125.0%</Text> of
          the reference, with the relative mean peak concentration in the same
          range.
        </Text>
        <Text style={styles.detailNote}>
          That is the general rule, not a finding about any two products on your
          screen — some non-prescription medicines are approved against a Health
          Canada monograph instead.
        </Text>
      </View>

      <View style={styles.links}>
        {SOURCES.map((s) => (
          <Pressable
            key={s.url}
            onPress={() => Linking.openURL(s.url)}
            accessibilityRole="link"
            accessibilityLabel={s.title}
            style={({ pressed }) => [
              styles.link,
              pressed && { backgroundColor: color.surfaceAlt },
            ]}
          >
            <Text style={styles.linkTitle} numberOfLines={2}>
              {s.title}
            </Text>
            <Icon name="external" size={15} color={color.inkTertiary} />
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const makeStyles = (color: Palette) =>
  StyleSheet.create({
    lead: { ...type.title, color: color.ink },

    diagram: {
      alignItems: "center",
      gap: space.sm,
      backgroundColor: color.surfaceAlt,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.lg,
      paddingVertical: space.lg,
      paddingHorizontal: space.md,
    },
    brandRow: {
      flexDirection: "row",
      gap: space.sm,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    brand: {
      borderWidth: 1,
      borderColor: color.lineMid,
      borderRadius: radius.sm,
      backgroundColor: color.surface,
      paddingHorizontal: space.md,
      paddingVertical: 6,
    },
    brandText: { ...type.small, color: color.inkSecondary },
    pill: {
      backgroundColor: color.dark,
      borderRadius: radius.pill,
      paddingHorizontal: space.xl,
      paddingVertical: space.sm,
    },
    pillText: { ...type.bodyStrong, color: color.onDark },
    diagramNote: {
      ...type.small,
      color: color.inkTertiary,
      textAlign: "center",
      marginTop: 2,
    },

    fact: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
    factTitle: { ...type.bodyStrong, color: color.ink },
    factBody: { ...type.small, color: color.inkSecondary },

    detail: {
      gap: space.xs,
      borderLeftWidth: 3,
      borderLeftColor: color.lineMid,
      paddingLeft: space.md,
    },
    detailTitle: { ...type.smallStrong, color: color.ink },
    detailBody: { ...type.small, color: color.inkSecondary },
    detailNote: {
      ...type.small,
      color: color.inkTertiary,
      fontSize: 12,
      fontStyle: "italic",
    },
    b: { fontWeight: "700", color: color.ink },

    links: { gap: space.sm },
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      borderWidth: 1,
      borderColor: color.lineMid,
      borderRadius: radius.md,
      backgroundColor: color.surface,
      paddingHorizontal: space.md,
      minHeight: 52,
    },
    linkTitle: { ...type.small, color: color.ink, flex: 1 },

    disclaimer: { ...type.small, color: color.inkTertiary, fontSize: 12 },
  });

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme();
  return useMemo(() => makeStyles(color), [color]);
}
