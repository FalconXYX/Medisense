/**
 * Network helpers for the build pipeline.
 *
 * This machine's IPv6 route is dead (EHOSTUNREACH on every AAAA), and Node's fetch prefers IPv6,
 * so every request must resolve IPv4-first or the whole pipeline fails on DNS rather than on
 * anything real. curl gets this right on its own; Node does not.
 */
import * as dns from 'node:dns'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { log } from './log.ts'

dns.setDefaultResultOrder('ipv4first')

const UA = 'MediSense/0.1 (CSC318 student project; contact via repo)'

export async function get(url: string, init: RequestInit = {}, tries = 3): Promise<Response> {
  let lastErr: unknown
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'user-agent': UA, ...(init.headers ?? {}) },
      })
      // Overpass fair-use: back off 30s on 429/406 (NOT 504 — the wiki says 429 or 406).
      if (res.status === 429 || res.status === 406) {
        log.warn(`HTTP ${res.status} — backing off 30s (attempt ${i}/${tries})`)
        await sleep(30_000)
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      log.warn(`request failed (attempt ${i}/${tries}): ${(e as Error).message}`)
      if (i < tries) await sleep(2000 * i)
    }
  }
  throw lastErr
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await get(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return (await res.json()) as T
}

/**
 * Download to disk, cached. Large files (the 23 MB NOC dump) go through curl, which streams
 * to disk and handles the IPv4 fallback natively rather than buffering in memory.
 */
export async function download(url: string, dest: string, label = path.basename(dest)) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    log.info(`${label} — cached (${mb(dest)})`)
    return dest
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  execFileSync('curl', ['-sSL', '--fail', '--max-time', '600', '-A', UA, '-o', dest, url], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  log.ok(`${label} — ${mb(dest)}`)
  return dest
}

export const mb = (f: string) => `${(fs.statSync(f).size / 1024 / 1024).toFixed(1)} MB`
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
