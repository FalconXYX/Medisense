/**
 * The product card pinned at the top of all four detail tabs, matching the Figma.
 * Carries the favourite toggle and the search-bar route home (there is no back button).
 *
 * On a desktop it becomes a full-width band with its own surface and a rule under it, so the four
 * tabs below read as views OF this product rather than as four unrelated pages that happen to
 * start with the same paragraph.
 */
import { useCallback, useState, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { goHome } from '../lib/nav'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BenefitPriceBlock, NoPublishedPrice } from './Price'
import { titleish } from './ProductCard'
import { Icon } from './Icon'
import { favourites } from '../lib/store'
import { useLayout, CONTENT_MAX } from './Shell'
import { radius, space, type, elevation, type Palette } from '../theme'
import { useTheme } from '../theme-context'
import type { Product } from '../lib/types'

export function ProductHeader({ product }: { product: Product }) {
  const { color } = useTheme()
  const styles = useStyles()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isWide } = useLayout()
  const [fav, setFav] = useState(false)

  useFocusEffect(
    useCallback(() => {
      favourites.has(product.drug_code).then(setFav)
    }, [product.drug_code]),
  )

  return (
    <View style={[styles.wrap, elevation(color, 1), { paddingTop: insets.top + space.sm }]}>
      <View style={isWide ? styles.inner : undefined}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => goHome(router)}
            accessibilityRole="button"
            accessibilityLabel="Back to search"
            style={({ pressed }) => [styles.home, pressed && { opacity: 0.6 }]}
          >
            <Icon name="search" size={15} color={color.ink} />
            <Text style={styles.homeText}>Search</Text>
          </Pressable>

          <Pressable
            onPress={async () => setFav(await favourites.toggle(product.drug_code))}
            accessibilityRole="button"
            accessibilityState={{ selected: fav }}
            accessibilityLabel={fav ? 'Remove from favourites' : 'Save to favourites'}
            style={({ pressed }) => [styles.fav, fav && styles.favOn, pressed && { opacity: 0.6 }]}
          >
            <Icon
              name={fav ? 'heartOn' : 'heart'}
              size={15}
              color={fav ? color.onDark : color.ink}
            />
            <Text style={[styles.favText, fav && styles.favTextOn]}>{fav ? 'Saved' : 'Save'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1, gap: space.sm }}>
              <Text style={styles.name} numberOfLines={3}>{product.display_name}</Text>
              <View style={styles.ingredientBox}>
                <Text style={styles.ingredient} numberOfLines={2}>
                  {(product.ingredient_label ?? '—').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.meta} numberOfLines={2}>
            {titleish(product.form ?? '')} · {titleish(product.route ?? '').toLowerCase()} ·{' '}
            {titleish(product.company)}
          </Text>

          {product.benefit_price
            ? <BenefitPriceBlock price={product.benefit_price} />
            : <NoPublishedPrice product={product} />}
        </View>
      </View>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg, paddingBottom: space.lg,
    borderBottomWidth: 1, borderBottomColor: color.line,
    backgroundColor: color.surface, gap: space.md, zIndex: 2,
  },
  inner: { width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center', gap: space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  home: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.pill,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg, minHeight: 40,
  },
  homeText: { ...type.smallStrong, color: color.ink },
  fav: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.pill,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg, minHeight: 40,
  },
  favOn: { backgroundColor: color.dark, borderColor: color.dark },
  favText: { ...type.smallStrong, color: color.ink },
  favTextOn: { color: color.onDark },
  card: { gap: space.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.lg },
  name: { ...type.display, color: color.ink },
  ingredientBox: {
    alignSelf: 'flex-start',
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  ingredient: { ...type.micro, color: color.ink, fontSize: 12, letterSpacing: 0.4 },
  meta: { ...type.small, color: color.inkTertiary },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
