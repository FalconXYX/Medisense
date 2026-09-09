/**
 * Tab 3 — the map.
 *
 * A4 FIX — the price markers are directly tappable. The study: "I was expecting if I press onto
 * this thing [price icon on map] it would show this page", and every participant made at least one
 * error reaching the directions page, one of them six extra clicks.
 *
 * The nearest pharmacy is drawn in black, the rest in white, per the design.
 *
 * react-native-maps renders nothing on web (its web entry is UnimplementedView), so map.web.tsx
 * sits alongside this file with a list-based equivalent.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { PriceExplainer } from './PriceExplainer'
import { PharmacyCard } from './PharmacyCard'
import { Icon } from './Icon'
import { getProduct } from '../lib/repo'
import { nearbyFor, FALLBACK_LOCATION, type NearbyPharmacy } from '../lib/nearby'
import { useLayout, CONTENT_MAX } from './Shell'
import { radius, space, type, type Palette } from '../theme'
import { useTheme } from '../theme-context'

export function MapScreen({ id }: { id: string }) {
  const { color } = useTheme()
  const styles = useStyles()
  const router = useRouter()
  const product = getProduct(Number(id))
  const [origin, setOrigin] = useState(FALLBACK_LOCATION)
  const [located, setLocated] = useState(false)
  const [selected, setSelected] = useState<NearbyPharmacy | null>(null)
  const [showPrices, setShowPrices] = useState(false)
  /** Markers with custom children must start tracking, then stop, or the frame rate collapses.
   *  Flipping too early renders the pills blank on iOS — so we wait a beat after first paint. */
  const [tracking, setTracking] = useState(true)
  const { isWide } = useLayout()
  const mapRef = useRef<MapView>(null)

  useEffect(() => {
    const t = setTimeout(() => setTracking(false), 1200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocated(true)
      } catch { /* keep the fallback */ }
    })()
  }, [])

  const nearby = useMemo(
    () => (product ? nearbyFor(product, origin, 18) : []),
    [product, origin],
  )

  if (!product) return <View style={styles.screen} />

  return (
    <View style={styles.screen}>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFill}
          showsUserLocation={located}
          showsMyLocationButton={false}
          initialRegion={{
            latitude: origin.lat,
            longitude: origin.lng,
            latitudeDelta: 0.035,
            longitudeDelta: 0.035,
          }}
        >
          {nearby.map((ph) => (
            <Marker
              key={ph.id}
              coordinate={{ latitude: ph.lat, longitude: ph.lng }}
              onPress={() => setSelected(ph)}
              tracksViewChanges={tracking}
              anchor={{ x: 0.5, y: 1 }}
              accessibilityLabel={`${ph.name}, ${ph.distanceKm.toFixed(1)} kilometres away`}
            >
              <View style={[styles.pin, ph.isNearest && styles.pinNearest]}>
                {/* The pin carried a generated price until ADR-017 — a false financial claim
                    about a named, real business, rendered on a map so it read as surveyed fact.
                    It now carries the one thing we actually know about the place. */}
                <Text
                  style={[styles.pinText, ph.isNearest && styles.pinTextNearest]}
                  numberOfLines={1}
                >
                  {ph.name.length > 20 ? `${ph.name.slice(0, 19)}…` : ph.name}
                </Text>
                <Icon
                  name="chevronRight"
                  size={12}
                  color={ph.isNearest ? color.onDark : color.ink}
                />
              </View>
            </Marker>
          ))}
        </MapView>

        {/* ODbL attribution must stay reachable. With no nav bar, this corner is the only place. */}
        <Pressable
          onPress={() => setShowPrices(true)}
          style={styles.attribution}
          accessibilityRole="button"
          accessibilityLabel="Map data and price sources"
        >
          <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
        </Pressable>

        <View style={styles.banner}>
          <Text style={styles.bannerText} numberOfLines={2}>
            Estimated prices — not live retail prices. Tap a price for that pharmacy.
          </Text>
        </View>
      </View>

      {selected ? (
        <View style={isWide ? styles.sheetWide : styles.sheet}>
          <Pressable
            onPress={() => setSelected(null)}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.sheetClose}
          >
            <Icon name="close" size={18} color={color.inkSecondary} />
          </Pressable>
          <PharmacyCard pharmacy={selected} locationKnown={located} />
        </View>
      ) : (
        <View style={isWide ? styles.hintBarWide : styles.hintBar}>
          <Text style={styles.hintText}>
            {nearby.length} pharmacies near here. We don&apos;t know what any of them stock.
          </Text>
          <Pressable onPress={() => router.push(`/product/${product.drug_code}/stores`)}>
            <Text style={styles.hintLink}>See all</Text>
            <Icon name="chevronRight" size={14} color={color.ink} />
          </Pressable>
        </View>
      )}

      <PriceExplainer visible={showPrices} onClose={() => setShowPrices(false)} />
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  mapWrap: { flex: 1, overflow: 'hidden' },
  pin: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.lineStrong,
    borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 5,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 3 },
      default: {},
    }),
  },
  pinNearest: { backgroundColor: color.dark, borderColor: color.dark },
  pinText: { ...type.micro, color: color.ink, fontSize: 11 },
  pinTextNearest: { color: color.onDark },
  attribution: {
    position: 'absolute', bottom: space.sm, right: space.sm,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.sm,
    paddingHorizontal: space.sm, paddingVertical: 4, minHeight: 26, justifyContent: 'center',
  },
  attributionText: { fontSize: 10, color: color.inkSecondary },
  banner: {
    position: 'absolute', top: space.sm, left: space.sm, right: space.sm,
    backgroundColor: color.noticeBg, borderWidth: 1, borderColor: color.noticeLine,
    borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 7,
  },
  bannerText: { ...type.small, color: color.noticeInk, fontSize: 12 },
  sheet: {
    padding: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: color.line,
    backgroundColor: color.surface,
  },
  sheetWide: {
    padding: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: color.line,
    backgroundColor: color.surface,
    width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center',
  },
  sheetClose: { alignSelf: 'flex-end', minHeight: 32, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { fontSize: 15, color: color.inkSecondary },
  hintBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderTopWidth: 1, borderTopColor: color.line, gap: space.md,
  },
  hintBarWide: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderTopWidth: 1, borderTopColor: color.line, gap: space.md,
    width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center',
  },
  hintText: { ...type.small, color: color.inkSecondary, flex: 1 },
  hintLink: { ...type.smallStrong, color: color.ink },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
