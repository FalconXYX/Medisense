/**
 * The application chrome for every screen except the landing and the camera.
 *
 * There is still no nav bar and no back button — that was a deliberate outcome of the team's own
 * iteration ("the navigation bar indeed made things more confusing"), and the search field is
 * still the way home. What this adds is an *edge*: a full-width surface with a rule under it, so
 * the page has a top instead of beginning abruptly at y=0. On a 1440px window the old build put a
 * 46pt pill at the very top of an otherwise empty white field, which read as a browser toolbar
 * belonging to a page that had failed to load.
 *
 * The two layouts are genuinely different rather than one stretched:
 *   PHONE    search field, then the chip row beneath it — unchanged from the Figma.
 *   DESKTOP  one row: mark, field, chips, appearance. There is horizontal room, so using it
 *            vertically was just wasting the fold.
 */
import { useMemo } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SearchHeader, ChipRow, type ChipState } from './SearchHeader'
import { Wordmark } from './Brand'
import { ThemeToggle } from './ThemeToggle'
import { useLayout, WIDE_MAX } from './Shell'
import { space, elevation, type Palette } from '../theme'
import { useTheme } from '../theme-context'

interface Props {
  value: string
  onChangeText: (t: string) => void
  onSubmit: () => void
  onScan: () => void
  onHome: () => void
  active: Partial<ChipState>
  onToggle: (chip: keyof ChipState) => void
  filterCount?: number
}

export function AppBar(props: Props) {
  const { color } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const { isWide } = useLayout()

  return (
    <View style={[styles.bar, elevation(color, 1), { paddingTop: insets.top + space.sm }]}>
      <View style={[styles.inner, isWide && styles.innerWide]}>
        {isWide ? (
          <Pressable
            onPress={props.onHome}
            accessibilityRole="button"
            accessibilityLabel="MediSense home"
            style={({ pressed }) => [styles.brand, pressed && { opacity: 0.6 }]}
          >
            <Wordmark size="sm" />
          </Pressable>
        ) : null}

        <View style={isWide ? styles.fieldWide : undefined}>
          {/* On a desktop the wordmark to the left is the home control, so the field's magnifier
              stays decorative rather than duplicating its accessible name. */}
          <SearchHeader {...props} onHome={isWide ? undefined : props.onHome} size="bar" chips={!isWide} />
        </View>

        {isWide ? (
          <>
            <ChipRow active={props.active} onToggle={props.onToggle} filterCount={props.filterCount} />
            <ThemeToggle compact />
          </>
        ) : null}
      </View>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  bar: {
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    // Above the scrolling content, so the shadow lands on the page rather than under it.
    zIndex: 2,
  },
  inner: { width: '100%' },
  innerWide: {
    maxWidth: WIDE_MAX, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: space.lg, flexWrap: 'wrap',
  },
  brand: { flexShrink: 0 },
  fieldWide: { flex: 1, minWidth: 320 },
})

function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
