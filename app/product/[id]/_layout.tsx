import { useMemo } from 'react'
/**
 * The four product tabs from the design: product info, verification, map, stores.
 *
 * A4 FIX — every tab carries a permanently visible TEXT LABEL beside its icon. The study's worst
 * result was Task 4 (find verified information) at ~4 errors per participant, driven by unlabelled
 * icons: "not super clear why this is not clickable but this is", "maybe text underline".
 * The Figma's bottom bar was icon-only. This one is not.
 *
 * Navigation uses expo-router <Link> rather than React Navigation's navigation.navigate(routeName)
 * or an imperative router call. Both of those silently did nothing from inside a custom tabBar —
 * verified with a real mouse click leaving the URL unchanged. Link renders a genuine anchor on web
 * (so the tabs are shareable, middle-clickable URLs) and a Pressable on native.
 *
 * The bar sits in a different PLACE at the two sizes, because a bottom tab bar is a phone
 * convention and pinning one to the bottom of a 900px-tall desktop window is what makes a web app
 * look like a stretched phone. On a desktop it becomes a segmented control directly under the
 * product, where a set of views of one object belongs.
 *
 * The product card header is rendered HERE, once, rather than by each of the four screens. It is
 * persistent chrome across the tabs (exactly as in the Figma), and rendering it per-screen left
 * four copies in the tree — the one on top was inert, so its Save and Search controls silently did
 * nothing while identical Pressables elsewhere worked.
 *
 * The global app still has no back button and no nav bar — this bar is scoped to one product.
 */
import { Tabs, Link, useSegments, useLocalSearchParams } from 'expo-router'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ProductHeader } from '../../../src/components/ProductHeader'
import { Icon, type IconName } from '../../../src/components/Icon'
import { getProduct } from '../../../src/lib/repo'
import { useLayout, CONTENT_MAX } from '../../../src/components/Shell'
import { radius, space, type, elevation, type Palette } from '../../../src/theme'
import { useTheme } from '../../../src/theme-context'

/**
 * Labels are short enough to fit four columns at 390 pt without colliding, but still words rather
 * than bare icons — the whole point of the A4 fix. The full phrasing goes to screen readers via
 * accessibilityLabel, and each tab repeats it as its own heading.
 */
const TABS: { segment: string; path: string; label: string; a11y: string; icon: IconName }[] = [
  { segment: 'index', path: '', label: 'Product', a11y: 'Product information', icon: 'document' },
  { segment: 'verified', path: '/verified', label: 'Checked', a11y: 'How we checked this', icon: 'verified' },
  { segment: 'map', path: '/map', label: 'Map', a11y: 'Map of nearby pharmacies', icon: 'map' },
  { segment: 'stores', path: '/stores', label: 'Stores', a11y: 'Pharmacies and directions', icon: 'store' },
]

function TabBar({ placement }: { placement: 'top' | 'bottom' }) {
  const { color } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const segments = useSegments()
  const { id } = useLocalSearchParams<{ id: string }>()
  const top = placement === 'top'

  // segments looks like ['product', '[id]'] on the index tab, or [..., 'verified'] on the others.
  const last = segments[segments.length - 1]
  const current = TABS.some((t) => t.segment === last) ? last : 'index'

  return (
    <View
      style={[
        top ? styles.barTop : styles.bar,
        !top && { paddingBottom: Math.max(insets.bottom, space.sm) },
      ]}
    >
      <View style={top ? styles.barInnerTop : styles.barInner}>
        {TABS.map((t) => {
          const focused = current === t.segment
          return (
            <Link
              key={t.segment}
              href={`/product/${id}${t.path}` as never}
              replace
              asChild
              // Sizing lives on the Link, not on the Pressable, because of the bug documented
              // below: the Link's style is the ONLY style that survives.
              style={top ? styles.tabLinkTop : styles.tabLink}
            >
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={t.a11y}
              >
                {/*
                  EVERY visual style has to live on this inner View, not on the Pressable.

                  `<Link asChild>` renders through Radix's Slot, which merges the two style props
                  with `{ ...slotStyle, ...childStyle }`. That is object spread — so a child style
                  that is a FUNCTION (`({pressed}) => [...]`, the normal Pressable idiom) spreads
                  to `{}` and is silently discarded, and an array spreads to `{0:…, 1:…}` which is
                  not a style either. There is no warning; the component simply renders unstyled.

                  That is what made the selected tab invisible — white label on the default light
                  ground, because `tabTopOn`'s dark fill never reached the DOM — and it is the real
                  reason the icon and label used to lay out side by side rather than stacked: the
                  Pressable was rendering with no style at all, so it never got its column
                  direction either. A plain nested View has no Slot between it and the renderer,
                  so its styles apply normally.
                */}
                {({ pressed }) => (
                  <View
                    style={[
                      top ? styles.tabTop : styles.tab,
                      top && focused && styles.tabTopOn,
                      pressed && { opacity: 0.55 },
                    ]}
                  >
                    <Icon
                      name={t.icon}
                      size={top ? 16 : 19}
                      color={focused ? (top ? color.onDark : color.ink) : color.inkTertiary}
                    />
                    <Text
                      style={[
                        top ? styles.labelTop : styles.label,
                        focused && (top ? styles.labelTopOn : styles.labelOn),
                      ]}
                      numberOfLines={1}
                    >
                      {t.label}
                    </Text>
                    {focused && !top ? <View style={styles.underline} /> : null}
                  </View>
                )}
              </Pressable>
            </Link>
          )
        })}
      </View>
    </View>
  )
}

export default function ProductTabs() {
  const { color } = useTheme()
  const styles = useStyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const product = getProduct(Number(id))
  const { isWide } = useLayout()

  return (
    <View style={[styles.screen, isWide && styles.screenWide]}>
      {product ? <ProductHeader product={product} /> : null}
      {isWide ? <TabBar placement="top" /> : null}
      <Tabs
        tabBar={() => (isWide ? null : <TabBar placement="bottom" />)}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: isWide ? color.ground : color.bg },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="verified" />
        <Tabs.Screen name="map" />
        <Tabs.Screen name="stores" />
      </Tabs>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  screenWide: { backgroundColor: color.ground },

  barInner: { flexDirection: 'row', width: '100%' },
  bar: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.surface,
    paddingTop: space.sm,
  },
  // The <a> that Link renders does not inherit React Native's column default, so without an
  // explicit flexDirection the icon and label lay out SIDE BY SIDE. On a phone that happened to
  // wrap and looked correct; at 1440px it spread the strip across the whole viewport with each
  // icon detached from its own label.
  tabLink: { flex: 1 },
  tab: {
    flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
    paddingVertical: 4, paddingHorizontal: 2, minHeight: 54,
  },
  label: { ...type.micro, color: color.inkTertiary, fontSize: 11, textAlign: 'center' },
  labelOn: { color: color.ink },
  underline: {
    position: 'absolute', bottom: -space.sm, height: 2, width: 26,
    borderRadius: 1, backgroundColor: color.ink,
  },

  // Desktop: a segmented control sitting in the content column, not a strip pinned to the window.
  barTop: { paddingHorizontal: space.lg, paddingTop: space.lg, backgroundColor: color.ground },
  barInnerTop: {
    flexDirection: 'row', gap: 4, alignSelf: 'center',
    width: '100%', maxWidth: CONTENT_MAX,
    backgroundColor: color.surfaceAlt, borderRadius: radius.pill, padding: 4,
    borderWidth: 1, borderColor: color.line,
  },
  tabLinkTop: { flex: 1 },
  tabTop: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 40, borderRadius: radius.pill,
  },
  tabTopOn: { backgroundColor: color.dark, ...elevation(color, 1) },
  labelTop: { ...type.smallStrong, color: color.inkSecondary },
  labelTopOn: { color: color.onDark },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
