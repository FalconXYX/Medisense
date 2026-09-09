import { useMemo } from 'react'
/**
 * The persistent header: search field with a camera affordance, then the chip row.
 *
 * The design has NO nav bar and NO back button by deliberate iteration — "the navigation bar
 * indeed made things more confusing". The search field IS the way home, so tapping the logo or
 * submitting a search always returns to the top of the stack.
 *
 * The camera control is a labelled button, not a bare icon (study fix: participants could not
 * tell what was tappable).
 *
 * Two sizes. `hero` is the landing field — tall, with a real shadow, sized so it is unmistakably
 * the primary thing on the screen. `bar` is the compact one that rides in the app bar on every
 * other screen. On a phone the two are nearly the same height; the difference only matters once
 * there is a desktop viewport to fill.
 */
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useLayout } from './Shell'
import { radius, space, type, elevation, type Palette } from '../theme'
import { useTheme } from '../theme-context'
import { Icon } from './Icon'

export interface ChipState {
  favourites: boolean
  history: boolean
  filters: boolean
}

interface Props {
  value: string
  onChangeText: (t: string) => void
  onSubmit: () => void
  onScan: () => void
  onHome?: () => void
  active: Partial<ChipState>
  onToggle: (chip: keyof ChipState) => void
  filterCount?: number
  autoFocus?: boolean
  size?: 'hero' | 'bar'
  /** Chips are hidden when the header sits inside a bar that already carries them elsewhere. */
  chips?: boolean
}

export function SearchHeader({
  value, onChangeText, onSubmit, onScan, onHome, active, onToggle, filterCount = 0, autoFocus,
  size = 'bar', chips = true,
}: Props) {
  const { color } = useTheme()
  const styles = useStyles()
  const { isWide } = useLayout()
  const hero = size === 'hero'
  return (
    <View style={styles.wrap}>
      <View style={[styles.field, hero && styles.fieldHero]}>
        {/* Decorative unless it is the ONLY way home. Two controls with the identical accessible
            name "MediSense home" — the wordmark and this magnifier — is a screen-reader ambiguity,
            so callers that already render the wordmark leave onHome off and this becomes a plain
            adornment on the field. */}
        {onHome ? (
          <Pressable
            onPress={onHome}
            accessibilityRole="button"
            accessibilityLabel="MediSense home"
            hitSlop={10}
            style={({ pressed }) => [styles.glyphBtn, pressed && { opacity: 0.5 }]}
          >
            <Icon name="search" size={hero ? 21 : 18} color={color.inkSecondary} />
          </Pressable>
        ) : (
          <View style={styles.glyphBtn}>
            <Icon name="search" size={hero ? 21 : 18} color={color.inkSecondary} />
          </View>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          // The Figma placeholder names all three ways in, and there is room for it on a desktop.
          // At 390pt there is not: the field clears about 28 characters before the Scan button,
          // so the full string rendered as "Symptoms, ingredients, brand.." — clipped mid-word,
          // which reads as a rendering fault rather than as a hint.
          placeholder={isWide ? 'Symptoms, ingredients, brand…' : 'Search medicines'}
          placeholderTextColor={color.inkTertiary}
          style={[styles.input, hero && styles.inputHero]}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
          accessibilityLabel="Search for a medicine"
        />

        <Pressable
          onPress={onScan}
          accessibilityRole="button"
          accessibilityLabel="Scan a product with the camera"
          style={({ pressed }) => [styles.scanBtn, hero && styles.scanBtnHero, pressed && styles.scanBtnPressed]}
        >
          <Icon name="scan" size={hero ? 17 : 15} color={color.onDark} />
          <Text style={styles.scanLabel}>Scan</Text>
        </Pressable>
      </View>

      {chips ? <ChipRow active={active} onToggle={onToggle} filterCount={filterCount} /> : null}
    </View>
  )
}

/**
 * The Favourites / History / Filters row. Split out because on a desktop it sits inline beside the
 * field in the app bar rather than stacked under it — two stacked rows of chrome on a 1440px
 * window is 110pt of header for a 50pt control.
 */
export function ChipRow({
  active, onToggle, filterCount = 0,
}: { active: Partial<ChipState>; onToggle: (chip: keyof ChipState) => void; filterCount?: number }) {
  const styles = useStyles()
  return (
    <View style={styles.chips}>
      <Chip label="Favourites" icon="heart" on={!!active.favourites} onPress={() => onToggle('favourites')} />
      <Chip label="History" icon="history" on={!!active.history} onPress={() => onToggle('history')} />
      <Chip
        label={filterCount ? `Filters · ${filterCount}` : 'Filters'}
        icon="filters"
        on={!!active.filters || filterCount > 0}
        onPress={() => onToggle('filters')}
      />
    </View>
  )
}

function Chip({
  label, icon, on, onPress,
}: { label: string; icon: 'heart' | 'history' | 'filters'; on: boolean; onPress: () => void }) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.chipPressed]}
    >
      <Icon
        name={icon === 'heart' && on ? 'heartOn' : icon}
        size={14}
        color={on ? color.onDark : color.inkSecondary}
      />
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  wrap: { gap: space.md },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    // The surface edge, not a hairline divider. The old field used the same #E6E6E6 as every
    // internal rule, so at desktop scale it read as a faint suggestion of an input.
    borderWidth: 1,
    borderColor: color.lineMid,
    borderRadius: radius.pill,
    paddingLeft: space.lg,
    paddingRight: 5,
    height: 50,
    backgroundColor: color.surface,
    ...elevation(color, 1),
  },
  fieldHero: { height: 62, paddingRight: 7, ...elevation(color, 2) },
  glyphBtn: { minWidth: 26, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, ...type.body, color: color.ink, paddingHorizontal: space.md, height: '100%' },
  inputHero: { fontSize: 17 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: color.dark, borderRadius: radius.pill,
    paddingHorizontal: space.lg, height: 40, minWidth: 84, justifyContent: 'center',
  },
  scanBtnHero: { height: 48, paddingHorizontal: space.xl },
  scanBtnPressed: { opacity: 0.78 },
  scanLabel: { ...type.micro, color: color.onDark, fontSize: 12 },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.pill,
    backgroundColor: color.surface,
    paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center',
  },
  chipOn: { backgroundColor: color.dark, borderColor: color.dark },
  chipPressed: { backgroundColor: color.surfaceAlt },
  chipText: { ...type.smallStrong, color: color.ink },
  chipTextOn: { color: color.onDark },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
