/**
 * Search history, favourites and the onboarding flag — per-device conveniences. Nothing here
 * leaves the phone.
 *
 * WRITES ARE FIRE-AND-FORGET, DELIBERATELY. AsyncStorage's setItem does not settle on the web
 * build — awaiting it left the favourite toggle permanently unresponsive with no error in the
 * console, which took a while to find. Nothing in this app should ever wait on storage to update
 * the UI: the in-memory copy is the source of truth for the session, and persistence is a
 * best-effort side effect. Reads are also raced against a timeout for the same reason.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

const HISTORY_KEY = 'medisense.history.v1'
const FAVOURITES_KEY = 'medisense.favourites.v1'
const ONBOARDED_KEY = 'medisense.onboarded.v1'
const MAX_HISTORY = 25
const READ_TIMEOUT_MS = 1500

export interface HistoryEntry {
  query: string
  drugCode: number | null
  displayName: string | null
  at: number
}

/** Session cache. Populated on first read, updated synchronously on every write. */
const cache: { history: HistoryEntry[] | null; favourites: number[] | null; onboarded: boolean | null } = {
  history: null,
  favourites: null,
  onboarded: null,
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await Promise.race([
      AsyncStorage.getItem(key),
      new Promise<null>((r) => setTimeout(() => r(null), READ_TIMEOUT_MS)),
    ])
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** Never awaited. A storage failure must not block, break or even be visible to the UI. */
function write(key: string, value: unknown): void {
  try {
    void AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {})
  } catch {
    /* ignore */
  }
}

export const history = {
  async all(): Promise<HistoryEntry[]> {
    if (cache.history === null) cache.history = await read<HistoryEntry[]>(HISTORY_KEY, [])
    return cache.history
  },
  async add(entry: Omit<HistoryEntry, 'at'>): Promise<void> {
    const list = await history.all()
    const deduped = list.filter((e) => !(e.query === entry.query && e.drugCode === entry.drugCode))
    cache.history = [{ ...entry, at: Date.now() }, ...deduped].slice(0, MAX_HISTORY)
    write(HISTORY_KEY, cache.history)
  },
  clear(): void {
    cache.history = []
    write(HISTORY_KEY, [])
  },
}

export const favourites = {
  async all(): Promise<number[]> {
    if (cache.favourites === null) cache.favourites = await read<number[]>(FAVOURITES_KEY, [])
    return cache.favourites
  },
  /** Returns the NEW state immediately — the caller never waits on persistence. */
  async toggle(drugCode: number): Promise<boolean> {
    const list = await favourites.all()
    const on = list.includes(drugCode)
    cache.favourites = on ? list.filter((c) => c !== drugCode) : [drugCode, ...list]
    write(FAVOURITES_KEY, cache.favourites)
    return !on
  },
  async has(drugCode: number): Promise<boolean> {
    return (await favourites.all()).includes(drugCode)
  },
}

export const onboarding = {
  async seen(): Promise<boolean> {
    if (cache.onboarded === null) cache.onboarded = await read<boolean>(ONBOARDED_KEY, false)
    return cache.onboarded
  },
  markSeen(): void {
    cache.onboarded = true
    write(ONBOARDED_KEY, true)
  },
  reset(): void {
    cache.onboarded = false
    write(ONBOARDED_KEY, false)
  },
}
