/**
 * Page footer: what the data actually is, and where it came from.
 *
 * This is not decoration. Three of the four sources carry attribution obligations — OpenStreetMap
 * under ODbL, Health Canada and the Ontario formulary under their Open Government Licences — and
 * with no nav bar and no About screen there is nowhere else in the app those credits can live.
 *
 * The first version laid it out as a label/value table with a fixed 74px label column, which made
 * "PHARMACIES" wrap to "PHARMACIE / S", and underlined all four values so the block ended in four
 * ragged rules. Attribution should be quiet and orderly. It is now four small blocks in a wrapping
 * row — name, then licence beneath it in the same grey as everything else — with the underline
 * dropped in favour of a small external-link arrow.
 *
 * COLLAPSED BY DEFAULT. Four licence names are the last thing on the page and the least likely
 * thing anyone came for, so they sit behind a disclosure. What stays visible is what a reader
 * actually needs: that this is a student project, that the prices are estimates, and the
 * non-endorsement line the Open Government Licence asks for.
 *
 * This does not weaken the ODbL obligation. The OSM notice is displayed persistently on the map
 * tab itself — in Leaflet's own attribution control, beside the data it belongs to, which is where
 * the licence asks for it. The footer entry is a second, fuller credit rather than the only one.
 */
import { useMemo, useState } from "react";
import {
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { meta } from "../lib/dataset";
import { space, type, type Palette } from "../theme";
import { useTheme } from "../theme-context";
import { Icon } from "./Icon";

const SOURCES: { label: string; name: string; licence: string; url: string }[] =
  [
    {
      label: "Medicines",
      name: "Health Canada Drug Product Database",
      licence: "Open Government Licence – Canada 2.0",
      url: "https://health-products.canada.ca/api/documentation/dpd-documentation-en.html",
    },
    {
      label: "Label text",
      name: "openFDA Drug Label API",
      licence: "CC0 1.0 · US labelling, shown for reference",
      url: "https://open.fda.gov/apis/drug/label/",
    },
    {
      label: "Pharmacies",
      // The ODbL notice has to appear verbatim, so it is the name rather than the licence line.
      name: "© OpenStreetMap contributors",
      licence: "Open Database Licence 1.0",
      url: "https://www.openstreetmap.org/copyright",
    },
    {
      label: "Prices",
      name: "Ontario Drug Benefit Formulary",
      licence: "Open Government Licence – Ontario 1.0",
      url: "https://www.ontario.ca/page/ontario-drug-benefit-formulary",
    },
  ];

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function Footer() {
  const { color } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={styles.rule} />

      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Data sources and licences"
        style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.toggleText}>Data sources and licences</Text>
        <Icon
          name={open ? "chevronUp" : "chevronDown"}
          size={14}
          color={color.inkTertiary}
        />
      </Pressable>

      {open ? (
        <View style={styles.sources}>
          {SOURCES.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => Linking.openURL(s.url)}
              accessibilityRole="link"
              accessibilityLabel={`${s.label}: ${s.name}, ${s.licence}`}
              style={({ pressed }) => [
                styles.source,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.sourceLabel}>{s.label.toUpperCase()}</Text>
              <View style={styles.sourceNameRow}>
                <Text style={styles.sourceName} numberOfLines={2}>
                  {s.name}
                </Text>
                {/* Pinned to the first line: centred, it floated halfway down a two-line name and
                  read as belonging to neither line. */}
                <Icon
                  name="external"
                  size={11}
                  color={color.inkTertiary}
                  style={{ marginTop: 3 }}
                />
              </View>
              <Text style={styles.sourceLicence} numberOfLines={2}>
                {s.licence}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.built}>
        Catalogue built {meta.built_at} · Neither Health Canada nor any listed
        source endorses this project.
      </Text>
    </View>
  );
}

const makeStyles = (color: Palette) =>
  StyleSheet.create({
    wrap: { gap: space.md, paddingTop: space.xl, paddingBottom: space.xl },
    rule: { height: 1, backgroundColor: color.line },
    disclaimer: { ...type.small, color: color.inkSecondary, maxWidth: 620 },

    toggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      minHeight: 34,
    },
    toggleText: { ...type.smallStrong, color: color.inkTertiary },
    sources: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
    source: {
      // The affordance is the arrow glyph plus role="link" (which WebStyles turns into a pointer
      // cursor). No underline at rest: four underlined values in a row read as four ragged rules,
      // which is what made the old footer look unfinished.
      gap: 3,
      flexGrow: 1,
      flexBasis: 200,
      maxWidth: 300,
      paddingVertical: 2,
    },
    sourceLabel: { ...type.overline, color: color.inkTertiary, fontSize: 10 },
    sourceNameRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
    sourceName: {
      ...type.smallStrong,
      color: color.ink,
      fontSize: 12.5,
      flexShrink: 1,
    },
    sourceLicence: { ...type.small, color: color.inkTertiary, fontSize: 11 },

    built: { ...type.small, color: color.inkTertiary, fontSize: 11 },
  });

function useStyles() {
  const { color } = useTheme();
  return useMemo(() => makeStyles(color), [color]);
}
