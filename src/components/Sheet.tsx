/**
 * The app's one modal container.
 *
 * Every panel that used to be its own full-screen `<Modal>` — What is a generic, How prices are
 * estimated, Filters, Onboarding — rendered edge to edge. On a phone that is correct. On a 1440px
 * window it meant a 1,440px-wide dialog holding a single 60-character paragraph, which is the
 * clearest possible tell that a web page is a phone build in a trench coat.
 *
 * So the same content is presented two ways:
 *   PHONE    full-screen, slides up. Unchanged.
 *   DESKTOP  a centred card on a scrim, sized to its content, with the page still visible around
 *            it — which is what a dialog is for. Clicking the scrim closes it, as does Escape
 *            (RN's onRequestClose is wired to the Escape key by react-native-web).
 */
import { useMemo } from 'react'
import { Modal, View, Text, ScrollView, Pressable, StyleSheet, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLayout } from './Shell'
import { Icon } from './Icon'
import { radius, space, type, elevation, HIT, type Palette } from '../theme'
import { useTheme } from '../theme-context'

export function Sheet({
  visible, onClose, title, closeLabel = 'Done', children, footer, maxWidth = 640, contentStyle,
}: {
  visible: boolean
  onClose: () => void
  title: string
  closeLabel?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: number
  contentStyle?: ViewStyle
}) {
  const { color } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const { isWide } = useLayout()

  const panel = (
    <View
      style={[
        styles.panel,
        isWide && [styles.panelWide, { maxWidth }, elevation(color, 3)],
        !isWide && { paddingTop: insets.top + space.md },
      ]}
    >
      <View style={styles.bar}>
        <Text style={styles.barTitle} accessibilityRole="header">{title}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`${closeLabel}. Close ${title}`}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.closeText}>{closeLabel}</Text>
          <Icon name="close" size={16} color={color.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: (isWide ? space.xl : insets.bottom + space.xxl) },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: isWide ? space.lg : insets.bottom + space.lg }]}>
          {footer}
        </View>
      ) : null}
    </View>
  )

  return (
    <Modal
      visible={visible}
      animationType={isWide ? 'fade' : 'slide'}
      onRequestClose={onClose}
      transparent={isWide}
    >
      {isWide ? (
        <View style={styles.scrim}>
          {/* The dismiss target is a SIBLING behind the card, not a parent wrapping it. Nesting
              them put a <button> inside a <button> on web — invalid HTML that React warns about
              and that makes the inner control unreachable for some assistive technology. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
          />
          {panel}
        </View>
      ) : (
        panel
      )}
    </Modal>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  scrim: {
    flex: 1, backgroundColor: color.scrim,
    alignItems: 'center', justifyContent: 'center', padding: space.xl,
  },
  panel: { flex: 1, backgroundColor: color.bg },
  panelWide: {
    // NOT `flex: 0`. A ScrollView inside a zero-flex, auto-height box collapses to nothing — the
    // dialog rendered as a scrim with no card in it at all. grow 0 / shrink 1 / basis auto means
    // the card is as tall as its content, and shrinks to fit the window when the content is
    // taller, which is the only arrangement that gives the ScrollView a height in both cases.
    flexGrow: 0, flexShrink: 1, flexBasis: 'auto',
    width: '100%', maxHeight: '100%',
    borderRadius: radius.xl, borderWidth: 1, borderColor: color.lineMid,
    backgroundColor: color.surface, overflow: 'hidden',
  },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md,
    borderBottomWidth: 1, borderBottomColor: color.line, backgroundColor: color.surface,
  },
  barTitle: { ...type.subtitle, color: color.ink, flex: 1 },
  close: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: HIT, justifyContent: 'center', paddingHorizontal: space.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: color.lineMid,
  },
  closeText: { ...type.smallStrong, color: color.ink },
  body: { padding: space.lg, gap: space.lg },
  footer: {
    borderTopWidth: 1, borderTopColor: color.line,
    paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.surface,
  },
})

function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
