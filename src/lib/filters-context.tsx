/**
 * Search filters, shared across screens.
 *
 * They used to be local state inside the results screen, which left the Filters chip on the
 * landing page with nothing to open. What it did instead was run `search(query || 'pain')` — so
 * tapping Filters from the landing performed a search for the word "pain" and dropped you on a
 * results page for ibuprofen. That is not a filter panel; it is a bug with a plausible-looking
 * excuse, and it is exactly the class of thing the study was complaining about ("not super clear
 * why this is not clickable but this is").
 *
 * The Figma puts Filters in the persistent header on every screen, so it has to work from every
 * screen. Holding the state here means a filter set on the landing is still set when the results
 * arrive, which is the only behaviour that makes the control worth having there.
 *
 * Session-scoped on purpose — not persisted. A price band silently still applied a week later
 * would produce an empty result screen with no visible cause.
 */
import { createContext, useContext, useMemo, useState } from 'react'
import { NO_FILTERS, type SearchFilters } from './types'

interface FilterState {
  filters: SearchFilters
  setFilters: (f: SearchFilters) => void
  reset: () => void
}

const Ctx = createContext<FilterState | null>(null)

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<SearchFilters>(NO_FILTERS)
  const value = useMemo(
    () => ({ filters, setFilters, reset: () => setFilters(NO_FILTERS) }),
    [filters],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFilters(): FilterState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFilters must be used inside FilterProvider')
  return v
}
