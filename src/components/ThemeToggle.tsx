/**
 * Appearance control. Defaults to following the system, which is what most people want, with an
 * explicit override for the rest. The choice persists.
 *
 * `compact` drops the labels down to icons for the top strip, where the control is a utility and
 * not the point of the screen. It is the one place in the app an icon appears without a visible
 * word beside it, so each option carries its own accessibilityLabel and the group is a radiogroup.
 */
import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { radius, space, type, type Palette } from '../theme'
import { useTheme, type ThemeChoice } from '../theme-context'
import { Icon, type IconName } from './Icon'

const OPTIONS: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Auto', icon: 'auto' },
  { value: 'light', label: 'Light', icon: 'light' },
  { value: 'dark', label: 'Dark', icon: 'dark' },
]

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { color, choice, setChoice } = useTheme()
  const styles = useMemo(() => makeStyles(color), [color])

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
      {OPTIONS.map((o) => {
        const on = choice === o.value
        return (
          <Pressable
            key={o.value}
            onPress={() => setChoice(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${o.label} appearance`}
            style={({ pressed }) => [
              styles.opt,
              compact && styles.optCompact,
              on && styles.optOn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Icon name={o.icon} size={15} color={on ? color.onDark : color.inkSecondary} />
            {compact ? null : (
              <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  wrap: {
    flexDirection: 'row', gap: 3, alignSelf: 'flex-start',
    backgroundColor: color.surfaceAlt, borderRadius: radius.pill, padding: 3,
    borderWidth: 1, borderColor: color.line,
  },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: space.md, minHeight: 34, borderRadius: radius.pill,
  },
  optCompact: { paddingHorizontal: 10, minHeight: 30, minWidth: 34, justifyContent: 'center' },
  optOn: { backgroundColor: color.dark },
  text: { ...type.smallStrong, color: color.inkSecondary },
  textOn: { color: color.onDark },
})
