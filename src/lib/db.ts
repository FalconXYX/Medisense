/**
 * Provenance written by the build pipeline: sources, licences, dates. Shown in the disclosure
 * screens. Kept as its own module so screens do not reach into dataset.ts directly.
 */
import { meta as datasetMeta } from './dataset'

export function meta(): Record<string, string> {
  return datasetMeta
}
