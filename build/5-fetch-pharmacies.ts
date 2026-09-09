/**
 * Step 5 — real Toronto pharmacies from OpenStreetMap via Overpass.
 *
 * ADR-010. Baked at BUILD time, not queried at runtime: Overpass fair use for a distributed
 * application is ~100 queries/day, and a live query would also make the demo non-deterministic.
 *
 * Licence: ODbL. Attribution is an obligation, not a courtesy — the app shows a reachable
 * "© OpenStreetMap" credit on the map tab.
 */
import * as path from 'node:path'
import { OSM_DIR, OUT, ensure, writeJson, readJson, exists } from './lib/paths.ts'
import { log, assert } from './lib/log.ts'
import { get } from './lib/net.ts'

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

/** City of Toronto. area 3600324211 is the OSM relation for the city boundary. */
const QUERY = `
[out:json][timeout:90];
area(3600324211)->.toronto;
(
  node["amenity"="pharmacy"](area.toronto);
  way["amenity"="pharmacy"](area.toronto);
  node["healthcare"="pharmacy"](area.toronto);
  way["healthcare"="pharmacy"](area.toronto);
);
out center tags;
`

interface OverpassEl {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface Pharmacy {
  id: string
  name: string
  brand: string | null
  lat: number
  lng: number
  address: string | null
  phone: string | null
  hours: string | null
  postcode: string | null
}

async function fetchOverpass(): Promise<OverpassEl[]> {
  for (const url of ENDPOINTS) {
    try {
      log.info(`querying ${new URL(url).host}`)
      const res = await get(url, {
        method: 'POST',
        body: new URLSearchParams({ data: QUERY }),
      })
      if (!res.ok) { log.warn(`HTTP ${res.status}`); continue }
      const json = (await res.json()) as { elements: OverpassEl[] }
      if (json.elements?.length) return json.elements
      log.warn('empty result')
    } catch (e) {
      log.warn(`${(e as Error).message}`)
    }
  }
  throw new Error('all Overpass endpoints failed')
}

async function main() {
  ensure(OSM_DIR, OUT)
  const cache = path.join(OSM_DIR, 'overpass-pharmacies.json')

  log.step('Toronto pharmacies from OpenStreetMap')
  let elements: OverpassEl[]
  if (exists(cache)) {
    elements = readJson<OverpassEl[]>(cache)
    log.info(`cached — ${elements.length} elements`)
  } else {
    elements = await fetchOverpass()
    writeJson(cache, elements)
    log.ok(`${elements.length} elements`)
  }

  const pharmacies: Pharmacy[] = []
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue
    const t = el.tags ?? {}
    const name = t.name || t.brand || t.operator
    if (!name) continue

    const num = t['addr:housenumber']
    const street = t['addr:street']
    pharmacies.push({
      id: `${el.type}/${el.id}`,
      name,
      brand: t.brand ?? null,
      lat, lng,
      address: num && street ? `${num} ${street}` : (street ?? null),
      phone: t.phone ?? t['contact:phone'] ?? null,
      hours: t.opening_hours ?? null,
      postcode: t['addr:postcode'] ?? null,
    })
  }

  assert(pharmacies.length > 200, `only ${pharmacies.length} pharmacies — Overpass query may have failed`)

  const withAddr = pharmacies.filter((p) => p.address).length
  const brands = new Map<string, number>()
  for (const p of pharmacies) if (p.brand) brands.set(p.brand, (brands.get(p.brand) ?? 0) + 1)

  log.info(`${pharmacies.length} named pharmacies`)
  log.info(`${withAddr} (${Math.round((withAddr / pharmacies.length) * 100)}%) have a street address`)
  log.info(`top brands: ${[...brands].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n} ${c}`).join(', ')}`)
  log.warn(`${pharmacies.length - withAddr} have no street address — directions fall back to raw lat,lng`)

  writeJson(path.join(OUT, 'pharmacies.json'), pharmacies)
  log.done(`${pharmacies.length} pharmacies`)
}

if (import.meta.filename === process.argv[1]) await main()
