/**
 * The full symptom list, in a sheet.
 *
 * Searching by symptom is a source requirement (FR4: "search by symptom, brand, ingredient,
 * barcode, or a photo of a brand name"), and ADR-008 fixes the input to a CLOSED vocabulary of 22
 * curated entries — that closed list is simultaneously the safety control and the reason the
 * feature is buildable at all.
 *
 * What was wrong was where it lived. All 22 were laid out as a tile wall on the landing page,
 * under a heading nobody asked for, which made the first thing you see a symptom checker rather
 * than a medicine finder — the opposite of what this app is. The list is unchanged; it is now one
 * click away instead of occupying the fold.
 */
import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Sheet } from './Sheet'
import { BodyIcon, bodyIconFor } from './Icon'
import { SYMPTOMS } from '../lib/symptoms'
import { radius, space, type, type Palette } from '../theme'
import { useTheme } from '../theme-context'

export function SymptomPicker({
  visible, onClose, onPick,
}: { visible: boolean; onClose: () => void; onPick: (label: string) => void }) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <Sheet visible={visible} onClose={onClose} title="What are you treating?" maxWidth={620}>
      <Text style={styles.note}>
        Products whose approved Canadian label lists this. MediSense does not diagnose, and this is
        not a symptom checker — a pharmacist can tell you whether any of them suit you.
      </Text>
      <View style={styles.grid}>
        {SYMPTOMS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => { onClose(); onPick(s.label) }}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          >
            <BodyIcon name={bodyIconFor(s.bodyArea, s.id)} size={19} color={color.inkSecondary} />
            <Text style={styles.tileText} numberOfLines={2}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  note: { ...type.small, color: color.inkTertiary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: color.surface,
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 52,
    flexGrow: 1, flexBasis: 170, maxWidth: 280,
  },
  tilePressed: { backgroundColor: color.surfaceAlt, borderColor: color.ink },
  tileText: { ...type.smallStrong, color: color.ink, flexShrink: 1 },
})

function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
