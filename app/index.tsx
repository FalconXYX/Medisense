/**
 * Landing screen — brand, search, the three ways in, and a short row of starting points.
 *
 * The A4 fix list is visible here: a "What is a generic?" entry point sits above the fold (the
 * study found participants asking "what do you mean by generic?"), and first-run onboarding fires
 * before anything else.
 *
 * The layout is deliberately different at the two sizes rather than one layout stretched:
 *
 *   PHONE   the original stack — search first, because on a 375pt screen the search field IS the
 *           product and a hero would push it under the fold.
 *   DESKTOP a real hero. Mark and wordmark lead, the field is 62pt tall and centred under them,
 *           and the entry points become a row of tiles. The old build put a 46pt search bar at
 *           y=0 of a 1440px window with the logo underneath it, which read as a browser toolbar
 *           with a page that had failed to load.
 *
 * The 22-symptom picker lives in a sheet (SymptomPicker), not on this page. Searching by symptom
 * is a source requirement, but putting the whole closed list on the landing made the first screen
 * read as a symptom checker — which is exactly what ADR-008 says this app is not.
 */
import { useCallback, useEffect, useState, useMemo } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SearchHeader, type ChipState } from '../src/components/SearchHeader'
import { WhatIsAGeneric } from '../src/components/WhatIsAGeneric'
import { Onboarding } from '../src/components/Onboarding'
import { SymptomPicker } from '../src/components/SymptomPicker'
import { FilterSheet, countActive } from '../src/components/FilterSheet'
import { useFilters } from '../src/lib/filters-context'
import { titleish } from '../src/components/ProductCard'
import { Wordmark, LogoMark } from '../src/components/Brand'
import { Icon } from '../src/components/Icon'
import { SectionLabel, ActionTile } from '../src/components/ui'
import { Footer } from '../src/components/Footer'
import { topBrands, getProduct } from '../src/lib/repo'
import { SYMPTOMS } from '../src/lib/symptoms'
import { products } from '../src/lib/dataset'
import { ThemeToggle } from '../src/components/ThemeToggle'
import { history, favourites, onboarding, type HistoryEntry } from '../src/lib/store'
import type { Product } from '../src/lib/types'
import { useLayout, WIDE_MAX } from '../src/components/Shell'
import { radius, space, type, elevation, type Palette } from '../src/theme'
import { useTheme } from '../src/theme-context'

/**
 * The mixed starting points, in the Figma's own spirit: a few of the most common things people
 * actually type, symptoms and brands together. Kept short deliberately — a suggestion list long
 * enough to need scanning is not a suggestion list.
 */
const STARTERS = ['Headache', 'Heartburn', 'Allergies', 'Cough', 'Ibuprofen']

export default function Landing() {
  const { color } = useTheme()
  const styles = useStyles()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isWide, isExtraWide } = useLayout()
  const { filters, setFilters } = useFilters()

  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<keyof ChipState | null>(null)
  const [explainer, setExplainer] = useState(false)
  const [picker, setPicker] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [recent, setRecent] = useState<HistoryEntry[]>([])
  const [saved, setSaved] = useState<Product[]>([])

  // Fewer brand chips on a phone: the names are long ("Aspirin Regular Strength"), so eleven
  // chips wrapped to five rows and the suggestion row stopped being glanceable.
  const suggestions = topBrands(isWide ? 6 : 3)

  useEffect(() => {
    onboarding.seen().then((seen) => setShowOnboarding(!seen))
  }, [])

  const refresh = useCallback(() => {
    history.all().then(setRecent)
    favourites.all().then((codes) => setSaved(codes.map(getProduct).filter(Boolean) as Product[]))
  }, [])
  useFocusEffect(refresh)

  const search = (q: string) => {
    const term = q.trim()
    if (!term) return
    history.add({ query: term, drugCode: null, displayName: null })
    router.push({ pathname: '/search', params: { q: term } })
  }

  const toggle = (chip: keyof ChipState) => {
    // Filters opens the filter panel. It used to run `search(query || 'pain')`, which meant
    // pressing Filters on an empty landing page searched for the word "pain" and left you on a
    // results screen you never asked for.
    if (chip === 'filters') { setShowFilters(true); return }
    setPanel((p) => (p === chip ? null : chip))
  }

  const home = panel === null && query.length === 0
  const measure = { maxWidth: isWide ? WIDE_MAX : undefined, width: '100%' as const, alignSelf: 'center' as const }

  return (
    <View style={[styles.screen, isWide && styles.screenWide]}>
      {/* A slim, full-width strip rather than a floating row: it gives the page a top edge, which
          is most of what separates "an application" from "a document that starts abruptly". */}
      <View style={[styles.topStrip, { paddingTop: insets.top + space.sm }]}>
        <View style={[styles.topStripInner, measure]}>
          <Pressable
            onPress={() => { setQuery(''); setPanel(null) }}
            accessibilityRole="button"
            accessibilityLabel="MediSense home"
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Wordmark size="sm" />
          </Pressable>
          <ThemeToggle compact />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.body, measure]}>
          {home && isWide ? (
            <View style={styles.hero}>
              <LogoMark size={64} />
              <Text style={styles.heroTitle}>Find the same medicine for less</Text>
              <Text style={styles.heroSub}>
                {products.length.toLocaleString()} Canadian over-the-counter products, grouped by
                what is actually inside them — not by what is printed on the box.
              </Text>
            </View>
          ) : null}

          <View style={[styles.searchSlot, isWide && home && styles.searchSlotHero]}>
            <SearchHeader
              value={query}
              onChangeText={setQuery}
              onSubmit={() => search(query)}
              onScan={() => router.push('/scan')}
              // The wordmark in the strip above is the home control; see SearchHeader.
              active={{ favourites: panel === 'favourites', history: panel === 'history' }}
              onToggle={toggle}
              filterCount={countActive(filters)}
              size={isWide && home ? 'hero' : 'bar'}
            />
          </View>

          {home && !isWide ? (
            <View style={styles.heroPhone}>
              <Text style={styles.heroTitlePhone}>Find the same medicine for less</Text>
              <Text style={styles.heroSubPhone}>
                {products.length.toLocaleString()} Canadian over-the-counter products, grouped by
                what is actually inside them.
              </Text>
            </View>
          ) : null}

          {panel === 'history' ? (
            <Panel title="Recent searches" empty={!recent.length} emptyText="Nothing searched yet.">
              {recent.map((h, i) => (
                <ListRow
                  key={`${h.query}-${i}`}
                  title={h.displayName ?? h.query}
                  subtitle={h.displayName ? h.query : 'Search'}
                  onPress={() => (h.drugCode ? router.push(`/product/${h.drugCode}`) : search(h.query))}
                />
              ))}
            </Panel>
          ) : null}

          {panel === 'favourites' ? (
            <Panel
              title="Favourites"
              empty={!saved.length}
              emptyText="Tap Save on any medicine to keep it here."
            >
              {saved.map((p) => (
                <ListRow
                  key={p.drug_code}
                  title={p.display_name}
                  subtitle={`${p.ingredient_label} · ${titleish(p.form ?? '')}`}
                  onPress={() => router.push(`/product/${p.drug_code}`)}
                />
              ))}
            </Panel>
          ) : null}

          {home ? (
            <View style={[styles.tiles, isExtraWide && styles.tilesWide]}>
              <View style={styles.tileCell}>
                <ActionTile
                  icon="help"
                  title="What is a generic?"
                  subtitle="Same ingredient, different box, lower price"
                  onPress={() => setExplainer(true)}
                  style={{ flex: 1 }}
                />
              </View>
              <View style={styles.tileCell}>
                <ActionTile
                  icon="barcode"
                  title="Scan a barcode"
                  subtitle="Point the camera at the package"
                  onPress={() => router.push('/scan')}
                  style={{ flex: 1 }}
                />
              </View>
              <View style={styles.tileCell}>
                <ActionTile
                  icon="lens"
                  title="Read the box"
                  subtitle="Recognise a product from its printed label"
                  tone="accent"
                  onPress={() => router.push({ pathname: '/scan', params: { mode: 'lens' } })}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : null}

          {home ? (
            <View style={styles.section}>
              {/*
                One row of starting points, not two stacked walls.

                This used to be a 22-tile "What's bothering you?" grid followed by a separate row
                of brands — about 900px of chrome before the fold, and it made the landing read as
                a symptom checker, which is precisely what this app is not (ADR-008: it is a
                product finder indexed by label text). The Figma's own pattern is a single mixed
                suggestion grid — "Advil, Headache, Ibuprofen Tablet, Unisom" — symptoms and brands
                side by side with no ceremony. That is what this is.

                Symptom search is a source requirement and is not reduced: the full closed list of
                22 is one click away, on the right of this label.
              */}
              <SectionLabel
                icon="search"
                right={
                  <Pressable
                    onPress={() => setPicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse all ${SYMPTOMS.length} symptoms`}
                    style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={styles.moreText}>All {SYMPTOMS.length} symptoms</Text>
                    <Icon name="chevronRight" size={14} color={color.inkSecondary} />
                  </Pressable>
                }
              >
                Try
              </SectionLabel>
              <View style={styles.chips}>
                {STARTERS.map((label) => (
                  <Chip key={label} label={label} onPress={() => { setQuery(label); search(label) }} />
                ))}
                {suggestions.map((p) => (
                  <Chip
                    key={p.drug_code}
                    label={p.display_name}
                    onPress={() => { setQuery(p.display_name); search(p.display_name) }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {home ? <Footer /> : null}
        </View>
      </ScrollView>

      <WhatIsAGeneric visible={explainer} onClose={() => setExplainer(false)} />
      <SymptomPicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(label) => { setQuery(label); search(label) }}
      />
      <FilterSheet
        visible={showFilters}
        filters={filters}
        onChange={setFilters}
        onClose={() => setShowFilters(false)}
        doneLabel="Done"
      />
      <Onboarding
        visible={showOnboarding}
        onDone={() => { onboarding.markSeen(); setShowOnboarding(false) }}
      />
    </View>
  )
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  )
}

/** Favourites / History live in a raised panel so they read as an overlay on the page, not part of it. */
function Panel({
  title, children, empty, emptyText,
}: { title: string; children?: React.ReactNode; empty?: boolean; emptyText?: string }) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <View style={[styles.panel, elevation(color, 1)]}>
      <Text style={styles.panelTitle}>{title}</Text>
      {empty ? <Text style={styles.empty}>{emptyText}</Text> : children}
    </View>
  )
}

function ListRow({
  title, subtitle, right, onPress,
}: { title: string; subtitle?: string; right?: React.ReactNode; onPress: () => void }) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: color.surfaceAlt }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
      <Icon name="chevronRight" size={16} color={color.inkTertiary} />
    </Pressable>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  screenWide: { backgroundColor: color.ground },

  topStrip: {
    borderBottomWidth: 1, borderBottomColor: color.line,
    backgroundColor: color.surface, paddingBottom: space.sm, paddingHorizontal: space.lg,
  },
  topStripInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },

  scroll: { flexGrow: 1 },
  body: { paddingHorizontal: space.lg, gap: space.xl, paddingTop: space.lg },

  hero: { alignItems: 'center', gap: space.md, paddingTop: space.xxl, paddingBottom: space.sm },
  heroTitle: { ...type.hero, color: color.ink, textAlign: 'center', maxWidth: 620 },
  heroSub: { ...type.body, fontSize: 16, color: color.inkSecondary, textAlign: 'center', maxWidth: 520 },
  heroPhone: { gap: space.xs, paddingTop: space.xs },
  heroTitlePhone: { ...type.display, color: color.ink },
  heroSubPhone: { ...type.small, color: color.inkSecondary },

  searchSlot: { width: '100%' },
  searchSlotHero: { maxWidth: 720, alignSelf: 'center', alignItems: 'stretch' },

  tiles: { gap: space.md },
  tilesWide: { flexDirection: 'row' },
  tileCell: { flex: 1, minWidth: 260, alignSelf: 'stretch' },

  section: { gap: space.md },


  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingLeft: space.sm },
  moreText: { ...type.smallStrong, color: color.inkSecondary },
  chip: {
    borderWidth: 1, borderColor: color.line, borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
    paddingHorizontal: space.lg, minHeight: 40, justifyContent: 'center',
  },
  chipPressed: { backgroundColor: color.surface, borderColor: color.ink },
  chipText: { ...type.smallStrong, color: color.ink },

  panel: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.lineMid,
    borderRadius: radius.lg, padding: space.lg, gap: space.xs,
  },
  panelTitle: { ...type.subtitle, color: color.ink, marginBottom: space.xs },
  empty: { ...type.small, color: color.inkTertiary },

  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: space.md, borderTopWidth: 1, borderTopColor: color.line, minHeight: 58,
  },
  listTitle: { ...type.bodyStrong, color: color.ink },
  listSubtitle: { ...type.small, color: color.inkTertiary },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
