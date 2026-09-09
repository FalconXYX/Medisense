/**
 * The camera screen — barcode scan, with OCR-style text entry as the graceful fallback.
 *
 * ADR-011 — THE HONEST SCOPE. There is no barcode-to-Canadian-drug database anywhere. Health
 * Canada removed every UPC from the DPD packaging file on 2025-05-01 (this build asserts it:
 * 0 non-empty UPCs in 58,239 rows). openFDA carries US barcodes only, and the free consumer
 * databases score 0/4 on Life Brand generics — precisely the products this app exists to surface.
 *
 * So the miss path is designed as a first-class flow rather than an error state. On no match the
 * screen switches to "type what the box says" IN PLACE, with no navigation transition, which is
 * what keeps the study's 13.34 s camera-search figure reachable.
 *
 * TWO MODES. Barcode is the fast path when the code happens to be in our table. LENS is the one
 * that generalises: it photographs the package and reads what is PRINTED on it, which every box
 * has, and ranks the catalogue against the recognised words. See src/lib/lens.ts.
 *
 * This is a modal, so unlike the rest of the app it does have its own dismiss control.
 */
import { useRef, useState, useMemo, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Fuse from 'fuse.js'
import { searchProducts, getProduct } from '../src/lib/repo'
import { lookupBarcode } from '../src/lib/barcode'
import { runLens, isLensAvailable, disposeLens, type LensResult } from '../src/lib/lens'
import { titleish } from '../src/components/ProductCard'
import { Icon } from '../src/components/Icon'
import { useLayout } from '../src/components/Shell'
import { radius, space, type, elevation, type Palette } from '../src/theme'
import { useTheme } from '../src/theme-context'
import type { Product } from '../src/lib/types'

type Mode = 'scanning' | 'looking-up' | 'matched' | 'missed' | 'lens-working' | 'lens-result'
type Lens = 'barcode' | 'lens'

export default function Scan() {
  const { color } = useTheme()
  const styles = useStyles()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isWide } = useLayout()
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<Mode>('scanning')
  const [code, setCode] = useState<string | null>(null)
  const [matches, setMatches] = useState<Product[]>([])
  const [typed, setTyped] = useState('')
  const [tool, setTool] = useState<Lens>('barcode')
  const [lens, setLens] = useState<LensResult | null>(null)
  const [lensError, setLensError] = useState<string | null>(null)
  const busy = useRef(false)
  const camera = useRef<CameraView>(null)

  // The OCR worker holds real memory; free it when the screen closes.
  useEffect(() => () => { void disposeLens() }, [])

  /**
   * Photograph the package and read it. Deliberately never navigates on its own — the result is a
   * shortlist the user picks from, because opening the wrong medicine is a safety problem.
   */
  const runLensCapture = async () => {
    if (busy.current) return
    busy.current = true
    setLensError(null)
    setMode('lens-working')
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.7, base64: false })
      if (!shot?.uri) throw new Error('The camera did not return an image.')
      const result = await runLens(shot.uri)
      setLens(result)
      setMode('lens-result')
    } catch (e) {
      setLensError(e instanceof Error ? e.message : 'Could not read the package.')
      setMode('lens-result')
    } finally {
      busy.current = false
    }
  }

  const onBarcode = async (r: BarcodeScanningResult) => {
    if (busy.current || mode !== 'scanning') return
    busy.current = true
    setCode(r.data)
    setMode('looking-up')

    const hit = await lookupBarcode(r.data)
    if (hit.drugCode) {
      const p = getProduct(hit.drugCode)
      if (p) { setMatches([p]); setMode('matched'); busy.current = false; return }
    }
    if (hit.textHint) {
      const found = fuzzy(hit.textHint)
      if (found.length) { setMatches(found); setMode('matched'); busy.current = false; return }
    }
    setMode('missed')
    busy.current = false
  }

  /**
   * Noisy input against the catalogue. Threshold 0.4 and ignoreLocation — the defaults (0.6,
   * position-sensitive) are far too loose for scanned or mistyped text. Results are shown as
   * "did you mean" options and never auto-navigated: silently opening the wrong medicine is a
   * safety problem, not a UX one.
   */
  const fuzzy = (text: string): Product[] => {
    const direct = searchProducts(text, 20)
    if (direct.length) return direct.slice(0, 5)
    const pool = searchProducts(text.split(/\s+/)[0] ?? text, 60)
    if (!pool.length) return []
    const fuse = new Fuse(pool, {
      keys: ['display_name', 'ingredient_label', 'company'],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 3,
    })
    return fuse.search(text).slice(0, 5).map((r) => r.item)
  }

  const reset = () => {
    setMode('scanning'); setCode(null); setMatches([]); setTyped(''); setLens(null); setLensError(null)
  }

  const open = (p: Product) => { router.dismiss(); router.push(`/product/${p.drug_code}`) }

  if (!permission) return <View style={styles.screen} />

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.centered, isWide && styles.groundWide, { paddingTop: insets.top }]}>
        {/* Bounded, not centred-in-a-void: unconstrained this was three sentences ruled across
            1,400px of empty white, which is what a permission prompt should never look like. */}
        <View style={[styles.permCard, elevation(color, 2)]}>
          <View style={styles.permIcon}>
            <Icon name="camera" size={26} color={color.ink} />
          </View>
          <Text style={styles.h}>Camera access</Text>
          <Text style={styles.p}>
            MediSense uses the camera to read the barcode on a medicine box. No photo or video is
            recorded or uploaded.
          </Text>
          <Text style={styles.pSmall}>
            If the code is not in our own list, the numbers alone are sent to openFDA and UPCitemdb
            to try to identify it. The image never leaves your device.
          </Text>
          <Pressable
            onPress={requestPermission}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>Allow camera</Text>
          </Pressable>
          <Pressable onPress={() => router.dismiss()} accessibilityRole="button" style={styles.linkBtn}>
            <Text style={styles.linkText}>Search by typing instead</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    // On a desktop the camera modal is held to a phone-shaped column on a ground. A 1440 x 600
    // viewfinder is not a better scanning experience, it is just a very large webcam.
    <View style={[styles.screen, isWide && styles.screenWide, { paddingTop: insets.top + space.sm }]}>
      <View style={isWide ? styles.frame : styles.frameFull}>
      <View style={styles.bar}>
        <Text style={styles.barTitle}>Scan a package</Text>
        <Pressable onPress={() => router.dismiss()} accessibilityRole="button" accessibilityLabel="Close"
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </View>

      {/* Mode switch. Labelled, not iconographic — the whole app's A4 fix list is about that. */}
      <View style={styles.tools}>
        {(['barcode', 'lens'] as Lens[]).map((t) => {
          const on = tool === t
          const disabled = t === 'lens' && !isLensAvailable
          return (
            <Pressable
              key={t}
              onPress={() => { if (!disabled) { setTool(t); reset() } }}
              disabled={disabled}
              accessibilityRole="tab"
              accessibilityState={{ selected: on, disabled }}
              accessibilityLabel={t === 'barcode' ? 'Scan a barcode' : 'Read the package with Lens'}
              style={({ pressed }) => [
                styles.tool, on && styles.toolOn, disabled && styles.toolOff, pressed && { opacity: 0.7 },
              ]}
            >
              <Icon
                name={t === 'barcode' ? 'barcode' : 'lens'}
                size={16}
                color={disabled ? color.inkTertiary : on ? color.onDark : color.ink}
              />
              <Text style={[styles.toolText, on && styles.toolTextOn, disabled && styles.toolTextOff]}>
                {t === 'barcode' ? 'Barcode' : 'Lens'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.viewfinder}>
        {mode === 'scanning' ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'upc_a', 'upc_e', 'ean8', 'code128'],
            }}
            onBarcodeScanned={tool === 'barcode' ? onBarcode : undefined}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.frozen]} />
        )}

        <View style={styles.brackets} pointerEvents="none">
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + space.lg }]}>
        {mode === 'scanning' && tool === 'barcode' ? (
          <Hint text="Hold the barcode on the package inside the frame. Unrecognised codes are looked up online; the image stays on your device." />
        ) : null}

        {mode === 'scanning' && tool === 'lens' ? (
          <View style={{ gap: space.sm }}>
            <Hint text="Fill the frame with the front of the package, then take a photo. The text is read on your device — the image is never uploaded." />
            <Pressable
              onPress={runLensCapture}
              accessibilityRole="button"
              accessibilityLabel="Take a photo and read the package"
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>Read this package</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'lens-working' ? (
          <View style={styles.busy}>
            <ActivityIndicator color={color.ink} />
            <Text style={styles.p}>Reading the package…</Text>
          </View>
        ) : null}

        {mode === 'lens-result' ? (
          <View style={{ gap: space.sm }}>
            {lensError ? (
              <>
                <Text style={styles.panelTitle}>Could not read it</Text>
                <Text style={styles.p}>{lensError}</Text>
              </>
            ) : lens && lens.candidates.length ? (
              <>
                <Text style={styles.panelTitle}>Did you mean…</Text>
                {lens.candidates.map((c) => (
                  <Pressable
                    key={c.product.drug_code}
                    onPress={() => open(c.product)}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.product.display_name}, ${Math.round(c.confidence * 100)} percent match`}
                    style={({ pressed }) => [styles.match, pressed && { backgroundColor: color.surfaceAlt }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchName}>{c.product.display_name}</Text>
                      <Text style={styles.matchMeta} numberOfLines={1}>
                        {c.product.ingredient_label} · {titleish(c.product.form ?? '')}
                      </Text>
                      {c.matched.length ? (
                        <Text style={styles.matchWhy} numberOfLines={1}>
                          read on the box: {c.matched.slice(0, 4).join(', ')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.confidence}>
                      <View style={[styles.confidenceFill, { width: `${Math.round(c.confidence * 100)}%` }]} />
                    </View>
                    <Icon name="chevronRight" size={16} color={color.inkTertiary} />
                  </Pressable>
                ))}
                <Text style={styles.lensNote}>
                  Read on your device in {(lens.ms / 1000).toFixed(1)}s. Nothing was uploaded. Check
                  the name and strength against the box before you rely on it.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.panelTitle}>Nothing recognised</Text>
                <Text style={styles.p}>
                  Try filling more of the frame with the brand name, or type it instead.
                </Text>
              </>
            )}
            <TextInput
              value={typed}
              onChangeText={setTyped}
              onSubmitEditing={() => {
                const found = fuzzy(typed.trim())
                if (found.length) { setMatches(found); setMode('matched') }
              }}
              placeholder="Or type the brand on the box"
              placeholderTextColor={color.inkTertiary}
              style={styles.input}
              autoCorrect={false}
              returnKeyType="search"
            />
            <Pressable onPress={reset} style={styles.linkBtn}>
              <Text style={styles.linkText}>Take another photo</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'looking-up' ? (
          <View style={styles.busy}>
            <ActivityIndicator color={color.ink} />
            <Text style={styles.p}>Looking up {code}…</Text>
          </View>
        ) : null}

        {mode === 'matched' ? (
          <View style={{ gap: space.sm }}>
            <Text style={styles.panelTitle}>
              {matches.length === 1 ? 'Found it' : 'Did you mean…'}
            </Text>
            {matches.map((p) => (
              <Pressable
                key={p.drug_code}
                onPress={() => open(p)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.match, pressed && { backgroundColor: color.surfaceAlt }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchName}>{p.display_name}</Text>
                  <Text style={styles.matchMeta} numberOfLines={1}>
                    {p.ingredient_label} · {titleish(p.form ?? '')}
                  </Text>
                </View>
                <Icon name="chevronRight" size={16} color={color.inkTertiary} />
              </Pressable>
            ))}
            <Pressable onPress={reset} style={styles.linkBtn}>
              <Text style={styles.linkText}>Scan something else</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'missed' ? (
          <View style={{ gap: space.sm }}>
            <Text style={styles.panelTitle}>That barcode isn&apos;t in our catalogue</Text>
            <Text style={styles.p}>
              Canadian drug packages don&apos;t have a public barcode registry — Health Canada
              removed barcode data in 2025 — so we can only recognise codes we&apos;ve recorded.
              Type what the box says instead.
            </Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              onSubmitEditing={() => {
                const found = fuzzy(typed.trim())
                if (found.length) { setMatches(found); setMode('matched') }
              }}
              placeholder="Brand or ingredient on the box"
              placeholderTextColor={color.inkTertiary}
              style={styles.input}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            <Pressable onPress={reset} style={styles.linkBtn}>
              <Text style={styles.linkText}>Try scanning again</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      </View>
    </View>
  )
}

function Hint({ text }: { text: string }) {
  const { color } = useTheme()
  const styles = useStyles()
  return (
    <View style={styles.hint}>
      <Icon name="info" size={14} color={color.inkTertiary} />
      <Text style={styles.hintText}>{text}</Text>
    </View>
  )
}

const makeStyles = (color: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  screenWide: { backgroundColor: color.ground, alignItems: 'center' },
  groundWide: { backgroundColor: color.ground },
  frameFull: { flex: 1, width: '100%' },
  frame: {
    flex: 1, width: '100%', maxWidth: 520, backgroundColor: color.bg,
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: color.line,
  },
  centered: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  permCard: {
    width: '100%', maxWidth: 460, alignItems: 'center', gap: space.md,
    backgroundColor: color.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: color.lineMid, padding: space.xl,
  },
  permIcon: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.surfaceAlt, marginBottom: space.xs,
  },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md,
  },
  barTitle: { ...type.subtitle, color: color.ink },
  close: {
    minHeight: 40, justifyContent: 'center', paddingHorizontal: space.lg,
    borderRadius: radius.pill, borderWidth: 1, borderColor: color.lineMid,
  },
  closeText: { ...type.smallStrong, color: color.ink },
  viewfinder: { flex: 1, backgroundColor: '#111', overflow: 'hidden' },
  frozen: { backgroundColor: '#111' },
  brackets: { ...StyleSheet.absoluteFillObject, margin: space.xxl },
  corner: { position: 'absolute', width: 44, height: 44, borderColor: '#fff' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  panel: {
    paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.sm,
    borderTopWidth: 1, borderTopColor: color.line, minHeight: 150,
    backgroundColor: color.surface,
  },
  panelTitle: { ...type.subtitle, color: color.ink },
  h: { ...type.title, color: color.ink, textAlign: 'center' },
  p: { ...type.body, color: color.inkSecondary, textAlign: 'center' },
  pSmall: { ...type.small, color: color.inkTertiary, textAlign: 'center', maxWidth: 320 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hint: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: color.surfaceAlt, borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: color.line,
  },
  hintText: { ...type.small, color: color.inkSecondary, flex: 1 },
  match: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.md,
    backgroundColor: color.surface, padding: space.md, minHeight: 62,
  },
  matchName: { ...type.bodyStrong, color: color.ink },
  matchMeta: { ...type.small, color: color.inkTertiary, fontSize: 12 },
  input: {
    borderWidth: 1, borderColor: color.lineMid, borderRadius: radius.pill,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg, minHeight: 48, ...type.body, color: color.ink,
  },
  cta: {
    backgroundColor: color.dark, borderRadius: radius.pill, minHeight: 50,
    paddingHorizontal: space.xxl, alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...type.bodyStrong, color: color.onDark },
  linkBtn: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  linkText: { ...type.smallStrong, color: color.ink, textDecorationLine: 'underline' },
  tools: {
    flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm,
  },
  tool: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: color.lineMid,
    backgroundColor: color.surface,
  },
  toolOn: { backgroundColor: color.dark, borderColor: color.dark },
  toolOff: { opacity: 0.45 },
  toolText: { ...type.smallStrong, color: color.ink },
  toolTextOn: { color: color.onDark },
  toolTextOff: { color: color.inkTertiary },
  matchWhy: { ...type.small, color: color.inkTertiary, fontSize: 11, fontStyle: 'italic' },
  confidence: {
    width: 42, height: 5, borderRadius: 3, backgroundColor: color.line, overflow: 'hidden',
  },
  confidenceFill: { height: 5, backgroundColor: color.accent },
  lensNote: { ...type.small, color: color.inkTertiary, fontSize: 11 },
})

/** Rebuilds the stylesheet when the palette changes (light <-> dark). */
function useStyles() {
  const { color } = useTheme()
  return useMemo(() => makeStyles(color), [color])
}
