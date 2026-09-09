/**
 * The MediSense mark: a magnifier enclosing a location pin, per the Figma.
 *
 * Drawn from Views rather than shipped as an asset, so it inherits the palette and stays crisp at
 * any density. The first version was a 5px ring around a plain red dot with a detached handle —
 * at desktop scale the ring read as hairline and the "pin" read as a full stop. This one has a
 * heavier ring, a real pin glyph inside it, and a handle that actually meets the lens.
 */
import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { space, type, type Palette } from '../theme'
import { useTheme } from '../theme-context'
import { Icon } from './Icon'

export function LogoMark({ size = 44 }: { size?: number }) {
  const { color } = useTheme()
  const ring = Math.max(3, Math.round(size * 0.115))
  const lens = Math.round(size * 0.78)
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* The handle is drawn first and sits behind the lens, so the join is hidden under the ring
          instead of showing as a seam across it. */}
      <View
        style={{
          position: 'absolute',
          width: ring + 1,
          height: size * 0.42,
          borderRadius: size,
          backgroundColor: color.ink,
          bottom: size * 0.02,
          right: size * 0.1,
          transform: [{ rotate: '-45deg' }],
        }}
      />
      <View
        style={{
          width: lens,
          height: lens,
          borderRadius: lens / 2,
          borderWidth: ring,
          borderColor: color.ink,
          backgroundColor: color.surface,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -size * 0.08,
          marginLeft: -size * 0.08,
        }}
      >
        <Icon name="pin" size={Math.round(lens * 0.55)} color={color.brandRed} />
      </View>
    </View>
  )
}

/** Mark plus wordmark, for the app bar and the landing hero. */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const styles = useStyles()
  const mark = size === 'lg' ? 56 : size === 'sm' ? 28 : 34
  return (
    <View style={styles.row}>
      <LogoMark size={mark} />
      <Text style={[styles.word, size === 'lg' && styles.wordLg, size === 'sm' && styles.wordSm]}>
        MediSense
      </Text>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  word: { ...type.title, color: color.ink },
  wordSm: { ...type.subtitle, color: color.ink },
  wordLg: { ...type.hero, color: color.ink },
})

function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
