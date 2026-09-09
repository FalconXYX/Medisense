import { useMemo } from 'react'
/**
 * Tab 1 — product information.
 *
 * Accordions in the order the design specifies: About this product (open by default),
 * Ingredients, Use, then Equivalency Explanation.
 *
 * WHAT THE LABEL PANEL MAY AND MAY NOT SAY. openFDA gives us US Drug Facts keyed by INGREDIENT, so
 * the text describes the ingredient, never this specific Canadian product. Rendering it as the
 * product's own directions was wrong in three separate ways at once: Infants' Tylenol (80 mg
 * drops) showed "in each gelcap, Acetaminophen 500 mg" and adult gelcap dosing; a three-ingredient
 * cold tablet showed only the acetaminophen liver warning and none of the drowsiness, blood
 * pressure or MAOI warnings; and a haemorrhoid ointment listed neomycin, a leading contact
 * allergen it does not contain. So:
 *   - dose and strength from a foreign label are NOT stored and NOT shown, at all;
 *   - warnings are shown ONLY when this product has one active ingredient AND the US label had the
 *     same single ingredient — otherwise the panel says to read the package;
 *   - the provenance line appears on every accordion the label feeds, not just the first.
 *
 * The equivalency copy is generated from real database fields, not written prose — every clause
 * traces to a column. ADR-006 governs what it may and may not claim.
 */
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Accordion, LabelText } from '../../../src/components/Accordion'
import { SavingNote } from '../../../src/components/Price'
import { titleish } from '../../../src/components/ProductCard'
import { getProduct, getGroup, getGroupMembers, getIngredientBases, getDrugFacts } from '../../../src/lib/repo'
import { useLayout, CONTENT_MAX } from '../../../src/components/Shell'
import { radius, space, type, type Palette } from '../../../src/theme'
import { useTheme } from '../../../src/theme-context'

export default function ProductInfo() {
  const styles = useStyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { isWide } = useLayout()
  const product = getProduct(Number(id))
  if (!product) return <Missing />

  const group = product.equivalence_key ? getGroup(product.equivalence_key) : null
  const members = product.equivalence_key ? getGroupMembers(product.equivalence_key) : []
  const anchor = group?.brand_anchor ? members.find((m) => m.drug_code === group.brand_anchor) : undefined
  const bases = getIngredientBases(product.drug_code)
  const facts = getDrugFacts(bases)
  const primary = facts[0]

  // Warnings may only be shown when they can actually be about THIS product.
  const singleIngredientProduct = bases.length === 1
  const canShowWarnings = Boolean(primary?.single_ingredient) && singleIngredientProduct
  const ingredientName = titleish(bases[0] ?? '')

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.body, isWide && styles.contained]}>
        <Accordion
          title="About this product"
          defaultOpen
          subtitle={primary?.purpose ?? product.atc_name ?? undefined}
        >
          {primary?.purpose ? <LabelText label="Purpose" value={primary.purpose} /> : null}
          {primary?.indications_and_usage ? (
            <LabelText label="Uses" value={primary.indications_and_usage} />
          ) : null}
          {!primary ? (
            <Text style={styles.body_}>
              Health Canada lists this product as {titleish(product.atc_name ?? 'a non-prescription medicine')}.
              Detailed label text is not available for this ingredient in the reference source.
            </Text>
          ) : null}
          {primary ? <Provenance ingredient={ingredientName} /> : null}
        </Accordion>

        <Accordion title="Ingredients" subtitle={product.ingredient_label ?? undefined}>
          {/* This product's own ingredients, from Health Canada — never a US label's. */}
          <LabelText label="Active ingredient" value={product.ingredient_label} />
          <Text style={styles.body_}>
            Non-medicinal ingredients — colour, coating, filler, flavour — can differ between this
            product and others with the same active ingredient. If you have an allergy or
            intolerance, check the carton and ask a pharmacist.
          </Text>
        </Accordion>

        <Accordion title="Use" subtitle="Dose and warnings">
          {/* Dose is never shown. We have no Canadian dosing data, and a US product's dose is not
              this product's dose — that is how an 80 mg infant suspension came to display
              "adults take 2 gelcaps every 6 hours". */}
          <View style={styles.doseBox}>
            <Text style={styles.doseTitle}>Read the dose on the package</Text>
            <Text style={styles.doseBody}>
              MediSense does not hold Canadian dosing information for this product, and will not
              show you another product&apos;s. The carton and the leaflet inside it are the
              authority. A pharmacist can talk you through it, free and without an appointment.
            </Text>
          </View>

          {canShowWarnings ? (
            <>
              <LabelText label="Warnings" value={primary?.warnings} />
              <LabelText label="Do not use" value={primary?.do_not_use} />
              <LabelText label="Ask a doctor" value={primary?.ask_doctor} />
              <LabelText label="Ask a doctor or pharmacist" value={primary?.ask_doctor_or_pharmacist} />
              <LabelText label="When using" value={primary?.when_using} />
              <LabelText label="Stop use" value={primary?.stop_use} />
              <LabelText label="Pregnancy or breastfeeding" value={primary?.pregnancy_or_breast_feeding} />
              <LabelText label="Keep out of reach of children" value={primary?.keep_out_of_reach_of_children} />
              <Provenance ingredient={ingredientName} />
            </>
          ) : (
            <Text style={styles.body_}>
              {bases.length > 1
                ? `This product contains ${bases.length} active ingredients. Warnings that cover only one of them would be incomplete, so we do not show any — read the warnings on the package.`
                : 'We do not have warning text we can attribute to this product specifically. Read the warnings on the package.'}
            </Text>
          )}
        </Accordion>

        <Accordion
          title="Equivalency explanation"
          defaultOpen
          subtitle={group?.has_alternatives ? `${members.length - 1} equivalent products` : 'No equivalents listed'}
        >
          <Equivalency
            product={product}
            group={group}
            memberCount={members.length}
            anchorName={anchor?.display_name}
          />
          <SavingNote ratioPct={product.odb_ratio_pct} citation={product.odb_citation} />
        </Accordion>

        <Text style={styles.disclaimer}>
          MediSense shows information from public drug records. It does not give medical advice and
          does not diagnose. Talk to a pharmacist or doctor before starting, stopping or switching a
          medicine.
        </Text>
      </ScrollView>
    </View>
  )
}

/**
 * Every sentence maps to a column. ADR-006: a shared Active Ingredient Group proves same
 * ingredient at the same strength — it does NOT mean Health Canada declared these two products
 * bioequivalent to one another, so that claim is never made here.
 */
function Equivalency({
  product, group, memberCount, anchorName,
}: {
  product: ReturnType<typeof getProduct>
  group: ReturnType<typeof getGroup>
  memberCount: number
  anchorName?: string
}) {
  const styles = useStyles()
  if (!product) return null
  if (!group) {
    return (
      <Text style={styles.body_}>
        Health Canada has not assigned this product an active ingredient group, so we cannot show
        equivalents for it.
      </Text>
    )
  }
  const others = memberCount - 1
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.body_}>
        <Text style={styles.b}>{product.display_name}</Text> (DIN {product.din}) contains{' '}
        <Text style={styles.b}>{group.ingredient_label}</Text>, as a{' '}
        {group.form.toLowerCase()} taken by the {group.route.toLowerCase()} route.
      </Text>
      <Text style={styles.body_}>
        Health Canada assigns it Active Ingredient Group{' '}
        <Text style={styles.b}>{group.ai_group_no}</Text> — the number given to products that share
        the same active ingredient at the same strength.
        {others > 0
          ? ` ${others} other marketed non-prescription ${others === 1 ? 'product shares' : 'products share'} that group in this same form and route${anchorName && anchorName !== product.display_name ? `, including ${anchorName}` : ''}.`
          : ' No other marketed non-prescription product currently shares that group in this form.'}
      </Text>
      <View style={styles.caveat}>
        <Text style={styles.caveatText}>
          Sharing this group means the same active ingredient at the same strength. It is not a
          finding that these specific products were tested against each other — many non-prescription
          medicines are approved against a Health Canada monograph rather than by comparison to
          another product.
        </Text>
      </View>
    </View>
  )
}

/** Where the label text came from. Repeated on every accordion it feeds, not just the first. */
function Provenance({ ingredient }: { ingredient: string }) {
  const styles = useStyles()
  return (
    <Text style={styles.provenance}>
      From US product labelling for {ingredient || 'this ingredient'}, shown for reference. It
      describes the ingredient, not this specific Canadian product.
    </Text>
  )
}

function Missing() {
  const styles = useStyles()
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: space.xl }]}>
      <Text style={type.title}>Product not found</Text>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  screen: { flex: 1 },
  contained: { maxWidth: CONTENT_MAX, alignSelf: 'center', width: '100%' },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  body_: { ...type.body, color: color.ink },
  b: { fontWeight: '700' },
  provenance: { ...type.small, color: color.inkSecondary, fontSize: 11, fontStyle: 'italic' },
  doseBox: {
    borderWidth: 1, borderColor: color.noticeLine, backgroundColor: color.noticeBg,
    borderRadius: radius.md, padding: space.lg, gap: 4,
  },
  doseTitle: { ...type.bodyStrong, color: color.noticeInk },
  doseBody: { ...type.small, color: color.noticeInk },
  caveat: {
    backgroundColor: color.surfaceAlt, borderRadius: radius.md, padding: space.lg,
    borderLeftWidth: 3, borderLeftColor: color.lineMid,
  },
  caveatText: { ...type.small, color: color.inkSecondary },
  disclaimer: { ...type.small, color: color.inkTertiary, fontSize: 12, marginTop: space.sm },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
