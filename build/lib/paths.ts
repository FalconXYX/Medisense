import * as path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const RAW = path.join(ROOT, 'data/raw')
export const OUT = path.join(ROOT, 'data/out')
export const ASSETS = path.join(ROOT, 'assets')

export const DPD_DIR = path.join(RAW, 'dpd')
export const ODB_DIR = path.join(RAW, 'odb')
export const OPENFDA_DIR = path.join(RAW, 'openfda')
export const OSM_DIR = path.join(RAW, 'osm')

export function ensure(...dirs: string[]) {
  for (const d of dirs) fs.mkdirSync(d, { recursive: true })
}

export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

export function exists(file: string) {
  return fs.existsSync(file)
}
