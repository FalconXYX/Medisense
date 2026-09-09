import { useMemo } from 'react'
/**
 * Filters. Mirrors the Figma panel, with one deliberate rename.
 *
 * The price-band filter and the "sort by cost" toggle are gone (ADR-017). Both operated on a
 * generated number. With real prices covering 92 of 1,024 products — and those being per-unit
 * reimbursement amounts from $0.0114 to $15.65 — a "$10 – $20" band is meaningless, and sorting a
 * list by a value 91% of it does not have orders the majority arbitrarily while implying the
 * order means something. What replaces them is the only price question the data can answer.
 *
 * "Pharmacist verified only" became "Health Canada listed only" (ADR-005). It is still a real
 * filter over real data — the product has a DIN and a current status of Marketed — but it is a
 * claim we can actually stand behind. Flag this rename in the write-up as a reasoned correction,
 * not a dropped requirement.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Sheet } from './Sheet'
import { Icon } from './Icon'
import { SectionLabel, Button } from './ui'
import { radius, space, type, type Palette } from '../theme'
import { useTheme } from '../theme-context'
import { NO_FILTERS, type SearchFilters } from '../lib/types'


export function FilterSheet({
  visible, filters, onChange, onClose, doneLabel = 'Show results',
}: {
  visible: boolean
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
  onClose: () => void
  /** "Show results" on the results screen; "Done" on the landing, where closing shows nothing. */
  doneLabel?: string
}) {
  const styles = useStyles()
  const set = (patch: Partial<SearchFilters>) => onChange({ ...filters, ...patch })

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      closeLabel="Close"
      maxWidth={520}
      footer={
        <View style={styles.footer}>
          {/* Only offered once there is something to clear — an always-present Reset on an
              untouched panel is a control that does nothing. */}
          {countActive(filters) > 0 ? (
            <Button label="Reset" variant="secondary" onPress={() => onChange(NO_FILTERS)} />
          ) : null}
          <Button label={doneLabel} onPress={onClose} style={{ flex: 1 }} />
        </View>
      }
    >
      <View style={styles.group}>
        <Check
          label="Health Canada listed only"
          hint="Has a Drug Identification Number and is currently marketed"
          on={filters.healthCanadaListedOnly}
          onPress={() => set({ healthCanadaListedOnly: !filters.healthCanadaListedOnly })}
        />
        <Check
          label="Name-brand only"
          hint="Hide lower-cost alternatives"
          on={filters.nameBrandOnly}
          onPress={() => set({ nameBrandOnly: !filters.nameBrandOnly })}
        />
      </View>

      <View style={styles.group}>
        <SectionLabel>Price</SectionLabel>
        <Check
          label="Only products with a published price"
          hint="92 of 1,024. A provincial drug plan publishes a per-unit price for these"
          on={filters.publishedPriceOnly}
          onPress={() => set({ publishedPriceOnly: !filters.publishedPriceOnly })}
        />
      </View>
    </Sheet>
  )
}

function Check({
  label, hint, on, onPress,
}: { label: string; hint?: string; on: boolean; onPress: () => void }) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.check, pressed && { backgroundColor: color.surfaceAlt }]}
    >
      <View style={[styles.boxOuter, on && styles.boxOn]}>
        {on ? <Icon name="check" size={14} color={color.onDark} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        {hint ? <Text style={styles.checkHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  )
}

export function countActive(f: SearchFilters): number {
  let n = 0
  if (f.healthCanadaListedOnly) n++
  if (f.nameBrandOnly) n++
  if (f.publishedPriceOnly) n++
  return n
}

const makeStyles = (color: Palette) => StyleSheet.create({
  footer: { flexDirection: 'row', gap: space.sm },
  group: { gap: space.sm },
  check: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 54,
    borderRadius: radius.md, paddingHorizontal: space.md,
    borderWidth: 1, borderColor: color.line, backgroundColor: color.surface,
  },
  boxOuter: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: color.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: color.dark },
  checkLabel: { ...type.body, color: color.ink },
  checkHint: { ...type.small, color: color.inkTertiary, fontSize: 12 },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
