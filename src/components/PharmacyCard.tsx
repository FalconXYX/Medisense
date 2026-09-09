/**
 * Pharmacy row for the Stores tab.
 *
 * Carries NO price and NO stock indication (ADR-017). Both used to be here and both were invented:
 * the price came from a seeded PRNG and a hash decided whether a named, real business stocked a
 * product. A fabricated dollar figure beside "Shoppers Drug Mart, 0.2 km" was the least defensible
 * thing in this project — a specific false claim about an identifiable company. What is left is
 * entirely real: OpenStreetMap's name, coordinates, address and opening hours.
 *
 * A4 FIX — the "Address" and "Directions" actions are labelled buttons with icons, not bare icons.
 * The study found the shopping-cart icon that used to lead here read as online checkout
 * ("shopping cart as an icon doesn't make too much intuitive… I associate it with online
 * shopping"), and participants could not find this page at all.
 */
import { useState, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Icon } from './Icon'
import { addressLine, directionsUrl, type NearbyPharmacy } from '../lib/nearby'
import { radius, space, type, elevation, type Palette } from '../theme'
import { useTheme } from '../theme-context'

export function PharmacyCard({
  pharmacy,
  locationKnown = false,
}: {
  pharmacy: NearbyPharmacy
  /** False when the distance is measured from the downtown fallback, not from the user. */
  locationKnown?: boolean
}) {
  const { color } = useTheme()
  const styles = useStyles()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await Clipboard.setStringAsync(addressLine(pharmacy))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <View style={[styles.card, elevation(color, 1), pharmacy.isNearest && styles.cardNearest]}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Icon name="store" size={18} color={color.inkSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{pharmacy.name}</Text>
          {/* Two lines: at two columns the street address was being clipped to "· 2…" on every
              card, which is the one piece of information the Stores tab exists to give. */}
          <Text style={styles.meta} numberOfLines={2}>
            {pharmacy.distanceKm.toFixed(1)} km{locationKnown ? '' : ' from downtown'}
            {pharmacy.address ? ` · ${pharmacy.address}` : ' · address not listed'}
          </Text>
        </View>
      </View>

      {pharmacy.isNearest ? (
        <View style={styles.nearestTag}>
          <Icon name="distance" size={12} color={color.onDark} />
          <Text style={styles.nearestText}>
            {locationKnown ? 'Closest to you' : 'Closest to downtown Toronto'}
          </Text>
        </View>
      ) : null}

      {pharmacy.hours ? <Text style={styles.hours} numberOfLines={1}>{pharmacy.hours}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={copy}
          accessibilityRole="button"
          accessibilityLabel={`Copy address of ${pharmacy.name}`}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Icon name={copied ? 'check' : 'copy'} size={15} color={color.ink} />
          <Text style={styles.btnText}>{copied ? 'Copied' : 'Copy address'}</Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL(directionsUrl(pharmacy))}
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${pharmacy.name}`}
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && { opacity: 0.85 }]}
        >
          <Icon name="directions" size={15} color={color.onDark} />
          <Text style={[styles.btnText, styles.btnTextPrimary]}>Directions</Text>
        </Pressable>
      </View>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.lg,
    backgroundColor: color.surface, padding: space.lg, gap: space.sm,
    // Fills its grid row so a two-column list has flush card bottoms. flexGrow, never flex:1 —
    // see ProductCard for why the basis matters.
    flexGrow: 1,
  },
  cardNearest: { borderColor: color.ink },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 38, height: 38, borderRadius: radius.md, backgroundColor: color.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { ...type.bodyStrong, color: color.ink },
  meta: { ...type.small, color: color.inkTertiary, fontSize: 12 },
  nearestTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', backgroundColor: color.dark,
    borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4,
  },
  nearestText: { ...type.micro, color: color.onDark },
  hours: { ...type.small, color: color.inkSecondary, fontSize: 12 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.pill, minHeight: 44,
  },
  btnPressed: { backgroundColor: color.surfaceAlt },
  btnPrimary: { backgroundColor: color.dark, borderColor: color.dark },
  btnText: { ...type.smallStrong, color: color.ink },
  btnTextPrimary: { color: color.onDark },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
