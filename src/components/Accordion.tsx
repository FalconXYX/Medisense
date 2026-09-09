/**
 * Expand/collapse section, per the design's "expandable and collapsible manner".
 *
 * Affordance is deliberate and doubled up: a chevron that rotates, a full-width press target, and
 * accessibilityState.expanded. The study found participants could not tell what was interactive,
 * so nothing here relies on a lone glyph.
 *
 * Visually it is now a raised card rather than a hairline rectangle. Four stacked 1px outlines
 * with nothing inside them is the shape of a wireframe, and on a light desktop the old #E6E6E6
 * border effectively disappeared — the panels read as floating text with no container at all.
 */
import { useState, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native'
import { radius, space, type, elevation, type Palette } from '../theme'
import { useTheme } from '../theme-context'
import { Icon } from './Icon'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export function Accordion({
  title, subtitle, children, defaultOpen = false,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const { color } = useTheme()
  const styles = useStyles()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <View style={[styles.wrap, elevation(color, 1)]}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setOpen((o) => !o)
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={({ pressed }) => [styles.head, pressed && { backgroundColor: color.surfaceAlt }]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && !open ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.chevron}>
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={color.inkSecondary} />
        </View>
      </Pressable>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  )
}

/** Verbatim label text. Never paraphrased or summarised — see ADR-008. */
export function LabelText({ label, value }: { label: string; value?: string | null }) {
  const styles = useStyles()
  if (!value) return null
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.blockValue}>{value}</Text>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  wrap: {
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.lg,
    backgroundColor: color.surface, overflow: 'hidden',
  },
  head: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 60,
  },
  title: { ...type.subtitle, color: color.ink },
  subtitle: { ...type.small, color: color.inkTertiary, fontSize: 12 },
  // A bounded circle rather than a bare glyph: it gives the control an edge to aim at, which is
  // the study's finding about unlabelled affordances in its smallest form.
  chevron: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceAlt,
  },
  content: {
    paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.lg,
    borderTopWidth: 1, borderTopColor: color.line, paddingTop: space.lg,
  },
  block: { gap: 4 },
  blockLabel: { ...type.overline, color: color.inkTertiary },
  blockValue: { ...type.body, color: color.ink },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
