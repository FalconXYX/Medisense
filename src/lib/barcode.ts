/**
 * Barcode -> product resolution.
 *
 * ADR-011. There is no barcode-to-Canadian-drug database. Health Canada removed every UPC from the
 * DPD packaging file on 2025-05-01 (build step 1 asserts this: 0 non-empty UPCs in 58,239 rows),
 * GS1 Canada is paid membership, and the free consumer databases score 0/4 on Canadian store-brand
 * generics — exactly the products the Alternatives section exists to surface.
 *
 * The chain below is therefore best-effort, cheapest first, and every step is allowed to miss.
 * The miss path in scan.tsx is the designed flow, not an error.
 *
 * NOTE ON TIMEOUTS: AbortSignal.timeout() does not exist on React Native's Hermes runtime. Using
 * it threw a TypeError on the first line of both remote steps, which the bare catch swallowed —
 * so on device the chain silently degraded to "local table only" and the network steps were dead
 * code. withTimeout() below uses an AbortController and a timer, which work everywhere.
 */
import { SEEDED_BARCODES } from './barcodes.seed'

/** fetch with a real timeout that works on Hermes as well as in a browser. */
async function withTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

export interface BarcodeHit {
  drugCode: number | null
  /** A product or brand name to fuzzy-match when we could not resolve an exact product. */
  textHint: string | null
  source: 'seed' | 'openfda' | 'upcitemdb' | 'none'
}

/**
 * iOS AVFoundation prepends a zero to UPC-A and expo-camera strips it back off, while openFDA
 * stores UPCs zero-padded to 13. Naively stripping leading zeros corrupts genuinely zero-prefixed
 * codes — Life Brand's whole 057800 range begins with one. So try both widths, never rewrite.
 */
function variants(raw: string): string[] {
  const digits = raw.replace(/\D/g, '')
  const out = new Set<string>([digits])
  if (digits.length === 12) out.add(`0${digits}`)
  if (digits.length === 13 && digits.startsWith('0')) out.add(digits.slice(1))
  return [...out]
}

export async function lookupBarcode(raw: string): Promise<BarcodeHit> {
  const codes = variants(raw)

  // 1. Our own table. The only source with any Canadian coverage, because we entered it by hand.
  for (const c of codes) {
    const seeded = SEEDED_BARCODES[c]
    if (seeded) return { drugCode: seeded, textHint: null, source: 'seed' }
  }

  // 2. openFDA. US products only, but a Toronto shopper may well be holding one.
  try {
    for (const c of codes) {
      const res = await withTimeout(
        `https://api.fda.gov/drug/ndc.json?search=openfda.upc:"${c}"&limit=1`,
        4000,
      )
      if (!res.ok) continue
      const json = (await res.json()) as {
        results?: { brand_name?: string; generic_name?: string }[]
      }
      const r = json.results?.[0]
      if (r) {
        return {
          drugCode: null,
          textHint: r.generic_name ?? r.brand_name ?? null,
          source: 'openfda',
        }
      }
    }
  } catch { /* offline, timed out, or rate-limited — fall through */ }

  // 3. UPCitemdb's keyless trial tier. ~100 lookups/day, roughly a third of national brands.
  try {
    const res = await withTimeout(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${codes[0]}`,
      4000,
    )
    if (res.ok) {
      const json = (await res.json()) as { items?: { title?: string; brand?: string }[] }
      const item = json.items?.[0]
      if (item?.title || item?.brand) {
        return { drugCode: null, textHint: item.brand ?? item.title ?? null, source: 'upcitemdb' }
      }
    }
  } catch { /* fall through to the miss path */ }

  return { drugCode: null, textHint: null, source: 'none' }
}
