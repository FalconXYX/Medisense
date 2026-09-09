/**
 * Tab 4 — the pharmacies that stock this product, with copy-address and directions.
 */
import { useEffect, useState, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import * as Location from 'expo-location'
import { PharmacyCard } from '../../../src/components/PharmacyCard'
import { getProduct } from '../../../src/lib/repo'
import { nearbyFor, FALLBACK_LOCATION, type NearbyPharmacy } from '../../../src/lib/nearby'
import { useLayout, CardGrid, CONTENT_MAX } from '../../../src/components/Shell'
import { space, type, type Palette } from '../../../src/theme'
import { SectionLabel } from '../../../src/components/ui'
import { useTheme } from '../../../src/theme-context'

export default function Stores() {
  const styles = useStyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { isWide } = useLayout()
  const product = getProduct(Number(id))
  const [origin, setOrigin] = useState(FALLBACK_LOCATION)
  const [located, setLocated] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocated(true)
      } catch {
        /* fall back to downtown Toronto */
      }
    })()
  }, [])

  if (!product) return <View style={styles.screen} />
  const nearby: NearbyPharmacy[] = nearbyFor(product, origin, 20)

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.body, isWide && styles.contained]}>

        <SectionLabel icon="store">
          {`${nearby.length} ${nearby.length === 1 ? 'pharmacy' : 'pharmacies'} near ${located ? 'you' : 'downtown Toronto'}`}
        </SectionLabel>
        {/* The app has no idea what any shop actually carries. Saying so here, once, beside the
            list, rather than letting each card imply it. */}
        <Text style={styles.hint}>
          These are real pharmacies, from OpenStreetMap. We do not know which of them carries this
          product or what it costs there — no Canadian pharmacy publishes that, and we do not
          guess. Call ahead, or check the shelf.
        </Text>
        {!located ? (
          <Text style={styles.hint}>
            Turn on location to sort by distance from where you actually are.
          </Text>
        ) : null}

        <CardGrid>
          {nearby.map((ph) => <PharmacyCard key={ph.id} pharmacy={ph} locationKnown={located} />)}
        </CardGrid>

        <Text style={styles.attribution}>
          Pharmacy locations © OpenStreetMap contributors, used under the Open Database Licence.
        </Text>
      </ScrollView>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  screen: { flex: 1 },
  contained: { maxWidth: CONTENT_MAX, alignSelf: 'center', width: '100%' },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl, paddingTop: space.lg },
  hint: { ...type.small, color: color.inkTertiary, maxWidth: 640 },
  attribution: { ...type.small, color: color.inkTertiary, fontSize: 11, marginTop: space.md },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
