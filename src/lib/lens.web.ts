/**
 * Lens — WEB entry point. Tesseract runs as WASM in the browser, so the image never leaves the
 * device, which matters when the alternative is uploading photographs of someone's medicine
 * cabinet to a third party.
 *
 * The English trained data (~2 MB) is fetched once on first use and then cached by the browser.
 * `readText` surfaces a clear error if that fetch fails, so the screen can fall back to typing
 * rather than hanging.
 *
 * Imports lens-core, NOT './lens' — on the web target Metro would resolve that back to this file.
 */
import { createWorker, type Worker } from 'tesseract.js'
import { matchProducts, tokenize, extractStrength } from './lens-core'
import type { LensResult } from './lens-core'

export * from './lens-core'

export const isLensAvailable = true

let worker: Worker | null = null
let starting: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (worker) return worker
  if (!starting) starting = createWorker('eng').then((w) => { worker = w; return w })
  return starting
}

export async function readText(uri: string): Promise<string> {
  try {
    const w = await getWorker()
    const { data } = await w.recognize(uri)
    return data.text ?? ''
  } catch (e) {
    throw new Error(
      `Could not start the text recogniser${e instanceof Error ? ` (${e.message})` : ''}. ` +
        'It needs a connection the first time it runs.',
    )
  }
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

/** Free the WASM worker when the scan screen unmounts — it holds real memory. */
export async function disposeLens(): Promise<void> {
  const w = worker
  worker = null
  starting = null
  if (w) await w.terminate().catch(() => {})
}
