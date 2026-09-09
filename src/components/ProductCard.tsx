import { useMemo } from 'react'
/**
 * The result card. Mirrors the Figma layout — name, price, ACTIVE INGREDIENT in bold, purpose,
 * quantity — but with the study's fixes applied: a labelled badge instead of a bare checkmark, and
 * a visible press state so it reads as tappable.
 *
 * The rewrite is about hierarchy, not content. The old card set the name at 20pt and then ran
 * every other field at 13pt grey in a two-column label/value table, so scanning a list of them
 * meant reading each one. Now the three things a person actually compares — what it is, what it
 * costs, what is in it — are the only things set at full strength, and the rest recedes:
 *
 *     Advil Caplets                              Est. $22.99      ← name + price, one line each
 *     IBUPROFEN 200 MG                                            ← the equivalence key, boxed
 *     Pain reliever · Tablet, oral                                ← what it does, how it comes
 *     ✓ Health Canada listed · DIN 02241203        Haleon Inc.
 *
 * The price is right-aligned in its own column so a stack of cards can be compared down the edge,
 * which is the entire point of the screen.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { radius, space, type, elevation, type Palette } from '../theme'
import { useTheme } from '../theme-context'
import { BenefitPriceTag } from './Price'
import { HealthCanadaBadge } from './Badge'
import type { Product } from '../lib/types'

interface Props {
  product: Product
  onPress: () => void
  /** The branded product this one is equivalent to, when shown under Alternatives. */
  showBadge?: boolean
  /** Marks the cheapest card in a list. Carries a word, not just a colour (WCAG 1.4.1). */
  flag?: string
}

export function ProductCard({ product, onPress, showBadge = true, flag }: Props) {
  const { color } = useTheme()
  const styles = useStyles()
  // No accessibilityLabel on the container: setting one collapses the card into a single string
  // and deletes the dosage form, the route, the company and the Health Canada DIN from the
  // screen-reader experience. The children already read well in order.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, elevation(color, 1), pressed && styles.pressed]}
    >
      {flag ? (
        <View style={styles.flag}>
          <Text style={styles.flagText}>{flag}</Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>{product.display_name}</Text>
        {/* No price slot when nothing was published. An empty column is honest; a placeholder
            dash or a "—" invites the reader to assume a number exists somewhere. */}
        {product.benefit_price ? <BenefitPriceTag price={product.benefit_price} /> : null}
      </View>

      {/* The ingredient and strength are what makes two boxes the same medicine, so they are set
          as a single boxed token rather than as one row of a label/value table. This is the field
          the whole app exists to surface. */}
      <View style={styles.ingredientBox}>
        <Text style={styles.ingredient} numberOfLines={2}>
          {(product.ingredient_label ?? '—').toUpperCase()}
        </Text>
      </View>

      <Text style={styles.meta} numberOfLines={2}>
        {[
          product.purpose ? sentence(product.purpose) : null,
          product.form ? `${titleish(product.form)}, ${titleish(product.route ?? '').toLowerCase()}` : null,
        ].filter(Boolean).join(' · ')}
      </Text>

      <View style={styles.footer}>
        {showBadge ? <HealthCanadaBadge din={product.din} compact /> : <View />}
        <Text style={styles.company} numberOfLines={1}>{titleish(product.company)}</Text>
      </View>
    </Pressable>
  )
}

/** Drug Facts purpose lines arrive lower-case and sometimes run long; clip to one clause. */
export function sentence(s: string): string {
  const first = s.split(/[.;]/)[0].trim()
  return first.charAt(0).toUpperCase() + first.slice(1)
}

/** DPD shouts everything. Lower-case it for display but keep short tokens (MG, USP) upper. */
export function titleish(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(/\b(Mg|Ml|Usp|Bp|Hcl|Atc|Din)\b/g, (m) => m.toUpperCase())
}

const makeStyles = (color: Palette) => StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.lineMid,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    // Grows to the height of its grid row so a two-column layout has flush card bottoms.
    // flexGrow, never flex:1 — flex:1 sets flexBasis:0, which collapses the card to nothing in
    // the plain column case where the container's height comes from its content.
    flexGrow: 1,
  },
  pressed: { backgroundColor: color.surfaceAlt, borderColor: color.ink },
  flag: {
    alignSelf: 'flex-start',
    backgroundColor: color.verifiedBg,
    borderWidth: 1,
    borderColor: color.verifiedLine,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 3,
  },
  flagText: { ...type.micro, color: color.verifiedInk },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  name: { ...type.title, color: color.ink, flex: 1 },
  ingredientBox: {
    alignSelf: 'flex-start',
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  ingredient: { ...type.micro, color: color.ink, fontSize: 12, letterSpacing: 0.4 },
  meta: { ...type.small, color: color.inkSecondary },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: space.sm, marginTop: space.xs, flexWrap: 'wrap',
  },
  company: { ...type.small, color: color.inkTertiary, fontSize: 11 },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
