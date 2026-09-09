/**
 * Lens — NATIVE entry point. See lens-core.ts for the matching logic and the full rationale.
 *
 * Expo Go has no on-device OCR: every ML Kit binding is a custom native module and therefore needs
 * a development build. Rather than pretend, this reports the capability honestly and the scan
 * screen disables the Lens tab and stays on barcode + typing.
 */
import { matchProducts, tokenize, extractStrength } from './lens-core'
import type { LensResult } from './lens-core'

export * from './lens-core'

export const isLensAvailable = false

export async function readText(_uri: string): Promise<string> {
  throw new Error('Reading the package needs a development build on this platform.')
}

export async function runLens(uri: string): Promise<LensResult> {
  const started = Date.now()
  const text = await readText(uri)
  return {
    text,
    tokens: tokenize(text),
    strength: extractStrength(text),
    candidates: matchProducts(text),
    ms: Date.now() - started,
  }
}

/** No worker to free on native. */
export async function disposeLens(): Promise<void> {}
