/**
 * Search results — the Branded / Alternatives screen.
 *
 * Structure comes straight from the design: one branded product at the top, then everything
 * equivalent to it under "Alternatives", sorted by price ascending.
 *
 * Two study fixes are load-bearing here:
 *  - The `$$$` and 👍 section markers are replaced with labelled badges (see Badge.tsx). The red
 *    octagon that preceded them read as a warning; the thumbs-up read as an opinion.
 *  - 204 of 361 equivalence groups are singletons — Reactine, Pepcid AC, Nexium 24HR and Voltaren
 *    genuinely have no equivalent. That renders as an explained empty state, never a blank list.
 */
import { useMemo, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { goHome as routerGoHome } from '../src/lib/nav'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type ChipState } from '../src/components/SearchHeader'
import { AppBar } from '../src/components/AppBar'
import { SectionLabel } from '../src/components/ui'
import { Icon } from '../src/components/Icon'
import { Footer } from '../src/components/Footer'
import { ProductCard, titleish } from '../src/components/ProductCard'
import { BrandedBadge, AlternativeBadge } from '../src/components/Badge'
import { PriceExplainer } from '../src/components/PriceExplainer'
import { FilterSheet, countActive } from '../src/components/FilterSheet'
import { RedFlagScreen, CautionPanel, SymptomFooter } from '../src/components/SafetyGate'
import { buildResultSet, applyFilters } from '../src/lib/repo'
import {
  matchRedFlag, matchSymptom, mentionsYoungChild, resolveClass, CAUTIONS,
} from '../src/lib/symptoms'
import { history } from '../src/lib/store'
import { type Product } from '../src/lib/types'
import { useFilters } from '../src/lib/filters-context'
import { useLayout, CardGrid, WIDE_MAX } from '../src/components/Shell'
import { radius, space, type, type Palette } from '../src/theme'
import { useTheme } from '../src/theme-context'

export default function SearchResults() {
  const { color } = useTheme()
  const styles = useStyles()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isWide } = useLayout()
  const { q } = useLocalSearchParams<{ q: string }>()

  const [query, setQuery] = useState(q ?? '')
  const [submitted, setSubmitted] = useState(q ?? '')
  // Shared with the landing page, so a filter set before searching is still set afterwards.
  const { filters, setFilters } = useFilters()
  const [showFilters, setShowFilters] = useState(false)
  const [showPrices, setShowPrices] = useState(false)

  /**
   * How many products of each symptom class are mounted. Expanding used to mount the WHOLE class
   * into a plain ScrollView — 264 ProductCards, ~5,900 nodes and about 2.3 s of blocked main
   * thread on the largest class, with the screen staying degraded afterwards. Pages of 12 keep
   * every interaction under a frame and still let a determined user reach everything.
   */
  const [shownPerClass, setShownPerClass] = useState<Record<string, number>>({})
  const PAGE = 12

  // GATE ORDER MATTERS (ADR-008): a red flag is checked BEFORE any product lookup, so nothing is
  // ever shown alongside "call 911".
  const redFlag = useMemo(() => matchRedFlag(submitted), [submitted])

  // The product lookup ALWAYS runs (unless a red flag fired). It used to be skipped whenever a
  // symptom word appeared anywhere in the query, which swallowed 293 of 838 product names: typing
  // "Claritin Allergy", "Benylin Cough" or "Advil Cold and Sinus" — the name printed on the box —
  // rendered a symptom page instead of the product, and for 34 products the page did not even
  // contain the thing that was typed.
  const productResults = useMemo(
    () => (redFlag ? null : buildResultSet(submitted, filters)),
    [submitted, filters, redFlag],
  )

  const symptomMatch = useMemo(() => (redFlag ? null : matchSymptom(submitted)), [submitted, redFlag])

  // A symptom page wins only when the query IS a symptom, or when it merely mentions one and the
  // catalogue has nothing that actually looks like what was typed.
  const namesTypedProduct = useMemo(() => {
    const p = productResults?.branded
    if (!p) return false
    const hay = `${p.display_name} ${p.ingredient_label ?? ''} ${p.company}`.toLowerCase()
    const tokens = submitted.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2)
    return tokens.length > 0 && tokens.every((t) => hay.includes(t))
  }, [productResults, submitted])

  const symptom = symptomMatch && (symptomMatch.exact || !namesTypedProduct) ? symptomMatch.symptom : null
  const results = symptom ? null : productResults

  const underSixBlock =
    !!symptom && CAUTIONS.underSixHardBlock.includes(symptom.id) && mentionsYoungChild(submitted)

  const activeFilters = countActive(filters)

  /**
   * Whether the brand you searched for would itself have been filtered out. It is shown anyway —
   * it is the thing you typed, and dropping it would leave the screen with no anchor and nothing
   * for the alternatives to be alternatives TO. But setting "Under $10" and then seeing a $22.99
   * card at the top with no explanation is exactly the kind of unexplained state the study kept
   * catching, so the card says so itself.
   */
  const brandedOutsideFilters = useMemo(() => {
    const b = results?.branded
    return !!b && activeFilters > 0 && applyFilters([b], filters).length === 0
  }, [results, filters, activeFilters])

  /**
   * The lowest PUBLISHED price among the alternatives, if any of them has one.
   *
   * This used to flag the cheapest of 11 generated numbers, which meant a card always carried
   * "Lowest estimate" even though every figure behind it was invented. Now it flags nothing unless
   * at least two members carry a real government price to compare — one price is not a ranking.
   */
  const cheapest = useMemo(() => {
    const priced = (results?.alternatives ?? []).filter((p) => p.benefit_price)
    if (priced.length < 2) return null
    return priced.reduce((a, b) =>
      b.benefit_price!.amountPerUnit < a.benefit_price!.amountPerUnit ? b : a)
  }, [results])

  const open = (drugCode: number, displayName: string) => {
    history.add({ query: submitted, drugCode, displayName })
    router.push(`/product/${drugCode}`)
  }
  const open_ = (p: Product) => open(p.drug_code, p.display_name)

  const goHome = () => routerGoHome(router)

  const toggle = (chip: keyof ChipState) => {
    if (chip === 'filters') setShowFilters(true)
    else goHome()
  }

  return (
    <View style={[styles.screen, isWide && styles.screenWide]}>
      <AppBar
        value={query}
        onChangeText={setQuery}
        onSubmit={() => setSubmitted(query.trim())}
        onScan={() => router.push('/scan')}
        onHome={goHome}
        active={{}}
        onToggle={toggle}
        filterCount={activeFilters}
      />

      {redFlag ? (
        <RedFlagScreen flag={redFlag} onBack={goHome} />
      ) : (
      <ScrollView
        contentContainerStyle={[
          styles.body,
          isWide && styles.bodyWide,
          { paddingBottom: insets.bottom + space.xxl },
        ]}
      >
        {symptom ? (
          <>
            <Text style={styles.symptomTitle}>{symptom.label}</Text>
            <CautionPanel symptom={symptom} hardBlockUnderSix={underSixBlock} />

            {!underSixBlock ? (
              <>
                <Text style={styles.symptomNote}>
                  Non-prescription products Health Canada classifies as the kinds of medicine used
                  for this. Grouped by what kind they are — a cheaper product from a different
                  group is not a like-for-like swap.
                </Text>

                {symptom.classes.map((c) => {
                  const limit = shownPerClass[c.className] ?? 4
                  const shown: Product[] = resolveClass(c, limit)
                  const remaining = c.products.length - shown.length
                  return (
                    <View key={c.className} style={styles.section}>
                      <View style={styles.classHead}>
                        <Text style={styles.className}>{c.className}</Text>
                        {/* A rule between the name and the count, rather than justify-between:
                            at 1,080px the count was stranded a thousand pixels from the heading
                            it belongs to, reading as an unrelated number in the margin. */}
                        <View style={styles.classRule} />
                        <Text style={styles.classCount}>{c.products.length}</Text>
                      </View>
                      <Text style={styles.classIngredients}>
                        {c.ingredients.map((i) => titleish(i)).join(' · ')}
                      </Text>
                      <CardGrid>
                        {shown.map((p) => (
                          <ProductCard key={p.drug_code} product={p} onPress={() => open_(p)} />
                        ))}
                      </CardGrid>
                      {remaining > 0 ? (
                        <Pressable
                          onPress={() =>
                            setShownPerClass((m) => ({ ...m, [c.className]: limit + PAGE }))
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Show ${Math.min(remaining, PAGE)} more ${c.className} products`}
                          style={({ pressed }) => [styles.showAll, pressed && { opacity: 0.6 }]}
                        >
                          <Text style={styles.showAllText}>
                            Show {Math.min(remaining, PAGE)} more · {remaining} left
                          </Text>
                        </Pressable>
                      ) : limit > 4 ? (
                        <Pressable
                          onPress={() => setShownPerClass((m) => ({ ...m, [c.className]: 4 }))}
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.showAll, pressed && { opacity: 0.6 }]}
                        >
                          <Text style={styles.showAllText}>Show fewer</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )
                })}

                <SymptomFooter symptom={symptom} />
              </>
            ) : null}
          </>
        ) : !results ? null : (
        <>
        {!results.branded ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing found for “{submitted}”</Text>
            <Text style={styles.emptyBody}>
              Try a brand (Advil), an ingredient (ibuprofen), or what you are treating (headache).
              This catalogue covers medicines Health Canada lists as non-prescription and currently
              marketed — it does not include natural health products such as vitamins or Metamucil.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <BrandedBadge />
              <ProductCard
                product={results.branded}
                onPress={() => open(results.branded!.drug_code, results.branded!.display_name)}
              />
              {brandedOutsideFilters ? (
                <Text style={styles.outsideFilters}>
                  This is what you searched for, so it is shown even though it falls outside your
                  filters.
                </Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <SectionLabel>Alternatives</SectionLabel>
              {results.alternatives.length > 0 ? (
                <>
                  {/*
                    The badge counts only members that are genuinely CHEAPER on a REAL published
                    price. It used to compare generated numbers, which made "N lower-cost
                    alternatives" false on 138 of 231 brand searches. Now a comparison requires
                    both sides to carry a government price — which is rare, so the badge usually
                    reports the equivalence count and says nothing about cost. That is correct: we
                    know these are the same medicine, and we do not know what they cost.
                  */}
                  <AlternativeBadge
                    count={
                      results.branded!.benefit_price
                        ? results.alternatives.filter(
                            (a) =>
                              a.benefit_price &&
                              a.benefit_price.amountPerUnit < results.branded!.benefit_price!.amountPerUnit,
                          ).length
                        : 0
                    }
                    total={results.alternatives.length}
                  />
                  <Text style={styles.sectionNote}>
                    Same active ingredient and strength as {results.branded.display_name}, in the
                    same form and taken the same way.
                  </Text>
                  {/* Two columns once there is genuinely room for two readable cards side by
                      side; a plain stack below that, so the phone rendering is untouched. */}
                  <CardGrid>
                    {results.alternatives.map((p) => (
                      <ProductCard
                        key={p.drug_code}
                        product={p}
                        onPress={() => open(p.drug_code, p.display_name)}
                        flag={p.drug_code === cheapest?.drug_code ? 'Lowest published price' : undefined}
                      />
                    ))}
                  </CardGrid>
                </>
              ) : (
                <View style={styles.noAlts}>
                  <Text style={styles.noAltsTitle}>No alternatives listed</Text>
                  <Text style={styles.noAltsBody}>
                    {activeFilters > 0
                      ? 'No alternative matches your filters. Try widening the price range.'
                      : `Health Canada does not currently list another marketed non-prescription product with the same active ingredient and strength as ${results.branded.display_name} in this form. That is common for newer or single-source products.`}
                  </Text>
                </View>
              )}
            </View>

            {results.otherMatches.length > 0 ? (
              <View style={styles.section}>
                <SectionLabel>Other matches for “{submitted}”</SectionLabel>
                <Text style={styles.sectionNote}>
                  Different ingredient, strength or form — not a like-for-like swap.
                </Text>
                {results.otherMatches.map((p) => (
                  <Pressable
                    key={p.drug_code}
                    onPress={() => open(p.drug_code, p.display_name)}
                    style={({ pressed }) => [styles.otherRow, pressed && { backgroundColor: color.surfaceAlt }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.otherName} numberOfLines={1}>{p.display_name}</Text>
                      <Text style={styles.otherMeta} numberOfLines={1}>
                        {p.ingredient_label} · {titleish(p.form ?? '')}
                      </Text>
                    </View>
                    {p.benefit_price ? (
                      <Text style={styles.otherPrice}>
                        ${p.benefit_price.amountPerUnit.toFixed(4)}/{p.benefit_price.unit}
                      </Text>
                    ) : null}
                    <Icon name="chevronRight" size={16} color={color.inkTertiary} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        )}
        </>
        )}

        {!redFlag ? <Footer /> : null}
      </ScrollView>
      )}

      <FilterSheet
        visible={showFilters}
        filters={filters}
        onChange={setFilters}
        onClose={() => setShowFilters(false)}
      />
      <PriceExplainer visible={showPrices} onClose={() => setShowPrices(false)} />
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  // On a wide viewport the phone layout was rendering full-bleed — 1,374px cards at 1440px.
  // Hold it to a readable measure and put a ground behind it.
  screenWide: { backgroundColor: color.ground },
  body: { paddingHorizontal: space.lg, gap: space.xl, paddingTop: space.lg },
  bodyWide: { maxWidth: WIDE_MAX, alignSelf: 'center', width: '100%' },
  section: { gap: space.md },
  sectionNote: { ...type.small, color: color.inkSecondary, marginTop: -space.xs, maxWidth: 640 },
  outsideFilters: { ...type.small, color: color.inkTertiary, marginTop: -space.xs, maxWidth: 640 },
  otherRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.md,
    backgroundColor: color.surface,
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.md,
    paddingVertical: space.md, minHeight: 58,
  },
  otherName: { ...type.bodyStrong, color: color.ink },
  otherMeta: { ...type.small, color: color.inkTertiary, fontSize: 12 },
  otherPrice: { ...type.smallStrong, color: color.ink },
  empty: { gap: space.sm, paddingVertical: space.xl },
  emptyTitle: { ...type.title, color: color.ink },
  emptyBody: { ...type.body, color: color.inkSecondary, maxWidth: 640 },
  noAlts: {
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.lg,
    padding: space.lg, gap: space.xs, backgroundColor: color.surfaceAlt,
  },
  noAltsTitle: { ...type.bodyStrong, color: color.ink },
  noAltsBody: { ...type.small, color: color.inkSecondary, maxWidth: 640 },
  symptomTitle: { ...type.display, color: color.ink },
  symptomNote: { ...type.small, color: color.inkSecondary, maxWidth: 640 },
  classHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  className: { ...type.subtitle, color: color.ink, flexShrink: 1 },
  classRule: { flex: 1, height: 1, backgroundColor: color.line },
  classCount: {
    ...type.micro, color: color.onDark, backgroundColor: color.dark,
    borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: 'hidden',
  },
  classIngredients: { ...type.small, color: color.inkTertiary, marginTop: -space.xs },
  showAll: {
    minHeight: 44, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.pill,
    backgroundColor: color.surface, alignSelf: 'center', paddingHorizontal: space.xl,
  },
  showAllText: { ...type.smallStrong, color: color.ink },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
