import { useMemo } from "react";
/**
 * Tab 2 — "How we checked this". This replaces the design's "Pharmacist Verified" page.
 *
 * ADR-005. The original page showed a green checkmark, a stock portrait, and a fictional
 * "Dr. Pharmacist". That cannot ship: Ontario's Pharmacy Act s.10(2) restricts holding oneself out
 * as qualified to practise as a pharmacist (s.12: fine up to $25,000), and the Open Government
 * Licence forbids using Health Canada data in a way that suggests official status or endorsement.
 *
 * It also would not have worked. The study found this exact page was the app's biggest usability
 * failure — ~4 errors per participant — and that even those who reached it could not say what the
 * badge meant: "I don't know exactly what pharmacist-verified means", "all of them should be
 * pharmacist verified anyways".
 *
 * So the page asserts a SOURCE instead of a reviewer, and every claim on it is one the user can
 * click through and check. That is both the legal fix and the comprehension fix.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon } from "../../../src/components/Icon";
import { CONTENT_MAX, useLayout } from "../../../src/components/Shell";
import { meta } from "../../../src/lib/db";
import { getGroup, getGroupMembers, getProduct } from "../../../src/lib/repo";
import {
  elevation,
  radius,
  space,
  type,
  type Palette,
} from "../../../src/theme";
import { useTheme } from "../../../src/theme-context";

/**
 * The record page keys on Health Canada's internal drug_code, not the DIN. The DIN-based search
 * URL returns HTTP 200 but renders an EMPTY SEARCH FORM — so the whole "check it yourself"
 * promise this page is built on silently failed. Verified: .../info?lang=eng&code=13452 renders
 * the ADVIL CAPLETS record; .../search/?search_type=din&din=01933531 renders nothing.
 * drug_code is undocumented, so treat a broken link as possible and keep the DIN visible as the
 * durable identifier the user can search by hand.
 */
const dpdUrl = (drugCode: number) =>
  `https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=${drugCode}`;
const aigUrl = (aig: string) =>
  `https://health-products.canada.ca/dpd-bdpp/search-fast-recherche-rapide?lang=eng&no=${aig}`;

export default function Verified() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isWide } = useLayout();
  const router = useRouter();
  const product = getProduct(Number(id));
  if (!product) return <View style={styles.screen} />;

  const group = product.equivalence_key
    ? getGroup(product.equivalence_key)
    : null;
  const members = product.equivalence_key
    ? getGroupMembers(product.equivalence_key)
    : [];
  const m = meta();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.body, isWide && styles.contained]}
      >
        <Text style={styles.h1}>How we checked this</Text>

        <Check
          title="Listed by Health Canada"
          body={`${product.display_name} is in the Drug Product Database with DIN ${product.din}. Status: marketed. Schedule: non-prescription.`}
          linkLabel="View the Health Canada record"
          url={dpdUrl(product.drug_code)}
        />

        {group ? (
          <Check
            title="Same active ingredient and strength"
            body={`Health Canada puts this product in active ingredient group ${group.ai_group_no} — the number it assigns to products that have the same active ingredient or ingredients at the same strength. ${
              members.length > 1
                ? `${members.length - 1} other marketed non-prescription ${members.length === 2 ? "product shares" : "products share"} that group in the same form and route.`
                : "No other marketed non-prescription product currently shares that group in this form and route."
            }`}
            linkLabel="See every product in this group"
            url={aigUrl(group.ai_group_no)}
          />
        ) : null}

        <Check
          title="Matched on form and route, not just ingredient"
          body={`Alternatives are narrowed to the same dosage form (${(group?.form ?? product.form ?? "").toLowerCase()}) and the same route (${(group?.route ?? product.route ?? "").toLowerCase()}). Ingredient group alone would mix suppositories with tablets, and extended-release with immediate-release.`}
        />

        {/* The honest limitation, turned into a route back into the app's map feature. */}
        <View style={styles.pharmacist}>
          <Text style={styles.pharmacistTitle}>Want an actual pharmacist?</Text>
          <Text style={styles.pharmacistBody}>
            Every pharmacy in Ontario has one on duty. Talking to them is free
            and needs no appointment — they can tell you whether a switch makes
            sense for you specifically.
          </Text>
          <Pressable
            onPress={() => router.push(`/product/${product.drug_code}/map`)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>Find a pharmacy near me</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Checked against the catalogue built {m.built_at}. Source:{" "}
          {m.drug_source}, used under the {m.drug_licence}. Health Canada does
          not endorse this app.
          {"\n\n"}
          MediSense shows a price only where a Canadian government publishes
          one. It is a public drug plan&apos;s per-unit reimbursement amount,
          not a shelf price.
        </Text>
      </ScrollView>
    </View>
  );
}

function Check({
  title,
  body,
  linkLabel,
  url,
}: {
  title: string;
  body: string;
  linkLabel?: string;
  url?: string;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.check, elevation(color, 1)]}>
      <View style={styles.checkHead}>
        <Icon name="checkCircle" size={17} color={color.verified} />
        <Text style={styles.checkTitle}>{title}</Text>
      </View>
      <Text style={styles.checkBody}>{body}</Text>
      {linkLabel && url ? (
        <Pressable
          onPress={() => Linking.openURL(url)}
          accessibilityRole="link"
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkText}>{linkLabel}</Text>
          <Icon name="external" size={15} color={color.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (color: Palette) =>
  StyleSheet.create({
    screen: { flex: 1 },
    contained: { maxWidth: CONTENT_MAX, alignSelf: "center", width: "100%" },
    body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
    h1: { ...type.display, color: color.ink },
    b: { fontWeight: "700" },
    honesty: {
      backgroundColor: color.surfaceAlt,
      borderRadius: radius.lg,
      padding: space.lg,
      borderLeftWidth: 4,
      borderLeftColor: color.ink,
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderTopColor: color.line,
      borderRightColor: color.line,
      borderBottomColor: color.line,
    },
    honestyText: { ...type.body, color: color.ink },
    // Three saturated green panels in a column was a wall of colour that made the page look like an
    // alert rather than a record. The surface is neutral now; the green is carried by the tick and
    // one edge, which is enough to read as "checked" without shouting.
    check: {
      borderWidth: 1,
      borderColor: color.lineMid,
      backgroundColor: color.surface,
      borderLeftWidth: 4,
      borderLeftColor: color.verified,
      borderRadius: radius.lg,
      padding: space.lg,
      gap: space.sm,
    },
    checkHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
    checkTitle: { ...type.subtitle, color: color.ink, flex: 1 },
    checkBody: { ...type.small, color: color.inkSecondary },
    link: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
    linkText: {
      ...type.smallStrong,
      color: color.accent,
      textDecorationLine: "underline",
    },
    pharmacist: {
      borderWidth: 1,
      borderColor: color.accentLine,
      backgroundColor: color.accentSoft,
      borderRadius: radius.lg,
      padding: space.lg,
      gap: space.sm,
    },
    pharmacistTitle: { ...type.subtitle, color: color.accentInk },
    pharmacistBody: { ...type.small, color: color.accentInk },
    cta: {
      backgroundColor: color.dark,
      borderRadius: radius.pill,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      marginTop: space.xs,
    },
    ctaText: { ...type.bodyStrong, color: color.onDark },
    footer: {
      ...type.small,
      color: color.inkTertiary,
      fontSize: 11,
      marginTop: space.sm,
    },
  });

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme();
  return useMemo(() => makeStyles(color), [color]);
}
