/**
 * Nearby pharmacies. Locations and distances only — no prices, no stock (ADR-017).
 *
 * Prices are computed here rather than stored (ADR-007) — estimatePrice is pure, so the value is
 * identical every launch and identical to what the build pipeline would have produced.
 * stocks() gives each store a deterministic ~70% of the catalogue, so the map has realistic gaps.
 */
import { getPharmacies } from './repo'
import type { PharmacyRow, Product } from './types'

/** Downtown Toronto — Yonge & Dundas. Used when location permission is refused or unavailable. */
export const FALLBACK_LOCATION = { lat: 43.6561, lng: -79.3803 }

/**
 * A real pharmacy, at a real distance. Deliberately WITHOUT a price and without a stock flag.
 *
 * Both used to be here and both were fabricated: `price` came from a seeded PRNG and `stocks()`
 * decided from a hash whether a named, real business carried a product. Attaching an invented
 * dollar figure to "Shoppers Drug Mart, 0.2 km" was the single least defensible thing in this
 * project — a specific false claim about an identifiable company. See ADR-017.
 *
 * What remains is entirely real: OpenStreetMap's name, coordinates, address and opening hours.
 */
export interface NearbyPharmacy extends PharmacyRow {
  distanceKm: number
  isNearest: boolean
}

/** Haversine, in kilometres. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function nearbyFor(
  product: Product,
  origin: { lat: number; lng: number },
  limit = 24,
): NearbyPharmacy[] {
  // Every marketed pharmacy, nearest first. No stock filter: we have no idea what any shop
  // actually carries, and the old hash-based `stocks()` was pretending otherwise.
  const near = getPharmacies()
    .map((ph) => ({
      ...ph,
      distanceKm: distanceKm(origin.lat, origin.lng, ph.lat, ph.lng),
      isNearest: false,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)

  if (near.length) near[0].isNearest = true
  return near
}

/**
 * Universal directions link — one URL that works on iOS, Android and web with no SDK.
 * Falls back to raw coordinates, which both Google and Apple accept; ~57% of the OSM records
 * have no street address, so a text query alone would fail for most of them.
 */
export function directionsUrl(ph: PharmacyRow): string {
  const dest = ph.address ? encodeURIComponent(`${ph.address}, Toronto, ON`) : `${ph.lat},${ph.lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

export function addressLine(ph: PharmacyRow): string {
  if (ph.address) return `${ph.address}${ph.postcode ? `, ${ph.postcode}` : ''}, Toronto, ON`
  return `${ph.lat.toFixed(5)}, ${ph.lng.toFixed(5)}`
}
