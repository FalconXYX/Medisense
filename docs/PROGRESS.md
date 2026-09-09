# Build progress

_Save-state. Updated as work lands._

## Done

### Phase 0 — scaffold ✅
Expo **SDK 54** (`expo@54.0.36`, RN 0.81.5, React 19.1.0, expo-router 6.0.24) — per ADR-002,
because this machine has Command Line Tools but no Xcode, and App Store Expo Go runs SDK 54.
Installed and version-locked by `expo install`: expo-camera 17.0.10, expo-location 19.0.8,
expo-clipboard 8.0.8, expo-sqlite 16.0.10, react-native-maps 1.20.1, async-storage 2.2.0,
nativewind 4.2.6 + tailwindcss 3.4.17, fuse.js 7.5.0.

### Phase 1 — data pipeline ✅ (the highest-risk phase, done first)

| Step | Script | Result |
|---|---|---|
| 1 | `1-fetch-dpd.ts` | 532,446 rows across 8 DPD tables (64 MB cached) |
| 2 | `2-build-catalogue.ts` | **838 products, 361 equivalence groups** (157 with alternatives) |
| 3 | `3-fetch-openfda.ts` | Drug Facts prose for **82 of 103** ingredients |
| 4 | `4-fetch-odb.ts` | **3 citable** brand:generic ratios from ODB Edition 43 |
| 5 | `5-fetch-pharmacies.ts` | **692 real Toronto pharmacies** from OpenStreetMap |
| 6 | `6-seed-prices.ts` | 838 base prices; store prices computed at runtime |
| 7 | `7-emit-sqlite.ts` | **`assets/medisense.db` — 1.04 MB**, FTS5 search |

**Funnel:** 58,239 register → 50,901 human → 11,450 marketed → 1,579 non-prescription →
838 after narrowing to medicine ATC classes (drops ~740 sunscreens, antiseptics and shampoos).

### What the build proved, first-hand

- **ADR-004 is real and load-bearing.** Grouping on `ai_group_no` alone would have produced
  **56 groups mixing route or dosage form**. The build now asserts no group spans either, and
  that every member is marketed non-prescription. It fails the build if that regresses.
- **The barcode dead-end is confirmed.** `packaging.upc` is empty in **0 of 58,239** rows.
  Asserted, so if Health Canada ever restores UPCs the build tells us.
- **ODB prices are as thin as the verifier said.** 2,551 pcg9 groups parsed (matching the
  verifier's independent count exactly); 31 touch our OTC catalogue; **3 citable ratios**.
  Dulcolax bisacodyl at **34.3%** reproduces the researched figure to the decimal. Everything
  else is generic-vs-generic because ODB omits `individualPrice` for `notABenefit="Y"` brands —
  so acetaminophen, the flagship, yields no brand saving. The app must say so.
- **Golden searches work.** Advil → Apo-Ibuprofen, Motrin, Jamp, Vita Health, Pharmascience.
  Tylenol → Novo-Gesic, Apo-Acetaminophen. Claritin → Apo-Loratadine, Allergy Remedy.
  Reactine and Pepcid AC correctly have **zero** alternatives (the singleton UI state is needed).

### Deviations from plan, and why

1. **DPD comes from the API dumps, not `allfiles.zip`.** The documented bulk extract is on
   www.canada.ca behind bot protection that kills the connection mid-stream (curl 92 /
   HTTP2 INTERNAL_ERROR) on every UA and protocol tried. `health-products.canada.ca` serves the
   same data as unfiltered JSON, no auth, `access-control-allow-origin: *`. Better anyway — it
   sidesteps the headerless-CSV column-order trap entirely.
2. **Per-pharmacy prices are computed, not stored.** 838 × 692 would be 405,319 bundle rows for
   numbers derivable in microseconds. `src/lib/pricing.ts` is a pure function shared by the build
   and the app, so they agree by construction and the DB stays at 1.04 MB.
3. **Overpass needed a fallback chain.** overpass-api.de returned 504 and private.coffee 500;
   maps.mail.ru served it. All three are tried in order.

### Data bugs found and fixed while building

- DPD writes `BASE (SALT FORM)` — passing it through rendered "POLYMYXIN B POLYMYXIN B 10000UNIT".
- Salt-stripping ate leading cations, turning Tums into "CARBONATE 750MG". Salts are now stripped
  only after the first token, so CALCIUM CARBONATE and SODIUM BICARBONATE survive.
- Accented French names (`ACÉTAMINOPHÈNE`) didn't fold and read as separate brands.
- The naive brand heuristic marked Sleep-Eze and Allergy Formula as *branded* — exactly the
  private-label products the Alternatives section exists to surface. Replaced with a three-signal
  ranking (known-brand list, innovator company, named-after-own-ingredient).

### Phases 2-6 — the app ✅

Running end to end in the browser with **zero console errors**. Screenshots of every screen are in
`docs/screens/`, captured from the running app.

| Screen | State |
|---|---|
| Onboarding (3 steps) | ✅ branded-vs-generic explainer, shown once |
| Landing | ✅ logo, search, Scan, chips, "What is a generic?", recognisable suggestions |
| What is a generic? | ✅ layered A→B→C copy, bioequivalence stated correctly, source links |
| Search results | ✅ Branded / Alternatives, real Advil → Apotex, Jamp, Vita Health, Pharmascience |
| Product info | ✅ four accordions, real openFDA label text, generated equivalency copy |
| How we checked | ✅ the ADR-005 page — states no pharmacist reviewed it, links the DPD record and AIG group |
| Map | ✅ tappable price markers on native; list fallback on web |
| Stores | ✅ real pharmacies, copy-address, Google Maps directions |
| How prices are estimated | ✅ formula, seed, sources |
| Camera scan | ✅ barcode chain with the OCR/type-it fallback as a designed flow |
| Filters | ✅ incl. the "Health Canada listed only" rename |
| Favourites + history | ✅ |

### Bugs found by driving the real app (Playwright + Chrome)

Each was invisible in code review and only showed up when clicked:

1. **`react-native-maps` broke the web bundle.** expo-router's `require.context` pulls in every
   route file, so a `map.web.tsx` sibling does not prevent `map.tsx` being bundled on web.
   Fixed by moving the implementations to `src/components/MapScreen{,.native}.tsx`, which Metro
   resolves by platform properly.
2. **expo-sqlite hung forever on web.** Its wa-sqlite worker needs SharedArrayBuffer, which needs
   COOP/COEP headers the dev server does not set. No error — the Suspense boundary just never
   resolved and the app sat on "Loading the medicine catalogue…" with a clean console. Replaced
   with a bundled JSON index (`src/lib/dataset.ts`), which is smaller (0.83 MB), needs no native
   module, and removed the loading state entirely.
3. **Tabs did not navigate.** Neither `navigation.navigate(routeName)` nor an imperative
   `router.replace` fired from inside a custom `tabBar` — a real mouse click left the URL
   unchanged. Fixed with expo-router `<Link>`, which also gives the web export shareable per-tab
   URLs.
4. **Every control in the product header was inert.** Rendering `ProductHeader` inside each of the
   four tab screens left copies in the tree; the one on top rendered as a plain `<div cursor:auto>`
   rather than an interactive element, so Save and Search silently did nothing while identical
   Pressables elsewhere worked. Hoisted into the tab layout — one instance, persistent across tabs,
   which is what the Figma shows anyway.
5. **`AsyncStorage.setItem` never settles on web.** Awaiting it left the favourite toggle
   permanently unresponsive. Writes are now fire-and-forget behind a session cache, and reads are
   raced against a timeout.
6. **Tab labels collided.** The `<a>` that `<Link>` renders is the flex child, so column sizing had
   to move onto the Link — with it on the inner Pressable all four bunched to the left.
7. **"Purpose: Ibuprofen".** The card was showing the ATC class name, which is just the ingredient
   again. Now uses the label's own purpose line — "Pain reliever/fever reducer".
8. **Searching "tylenol" landed on Infants' Tylenol.** Every product containing the brand word
   scores identically, so the tie-break was arbitrary — and it put the shopper in a 3-member group
   instead of a 15-member one. The anchor now prefers the mainstream formulation, using equivalence
   group size as the signal (the more products Health Canada lists as equivalent, the more
   mainstream the product), unless the query itself says infant/children/junior.
   Now: Tylenol → Tylenol Extra Strength with 20 alternatives.
9. **Landing suggested Senokot and Lacri-Lube.** Suggestions were ordered by `drug_code`, which
   surfaces the oldest DINs. Now ordered by brand recognition and restricted to groups that
   actually have alternatives, so a suggestion always demonstrates the point.

### Phase 7 — symptoms and safety gates ✅

22 hand-curated symptoms in `build/data/symptoms.ts`, resolved and VALIDATED against the real
catalogue by `build/9-build-symptoms.ts`, which fails the build if any row resolves to zero
products. 2,443 product links.

Curation errors the validator caught, which would have shipped silently:
- **lidocaine under "sore throat"** — every lidocaine product in the Canadian OTC catalogue is a
  topical wound antibiotic (ATC D06). It would have offered Polysporin for a sore throat.
- **doxylamine under "trouble sleeping"** — all 23 Canadian doxylamine products are multi-ingredient
  cold-and-flu combinations, so it would have recommended NyQuil as a sleep aid.
- **phenylephrine as a first-line decongestant** — only ever appears in combination products here,
  so it was demoted to rank 3.
- The six ingredients the research flagged (docosanol, meclizine, attapulgite, dyclonine,
  terbinafine, adapalene) are confirmed absent from Canadian OTC and are excluded. "Cold sores" is
  therefore not offered at all rather than offered empty.

Products are sorted single-ingredient first, then adult formulations before paediatric/night-time
variants — otherwise "headache" answered with Children's Tylenol Chewables out of 289 matches.

Safety gates, all verified in the browser:
| Query | Result |
|---|---|
| `chest pain`, `coughing blood`, `worst headache of my life` | **hard stop** — no products, Call 911, Ontario Poison Centre. No "continue anyway" |
| `cough for my baby` | **hard block** — Health Canada's under-6 cough/cold decision |
| `Headache`, `heartburn` | symptom flow, grouped by medicine class, with the duration caution |
| `Advil` | normal product search, unaffected |

Note "worst headache of my life" correctly red-flags rather than matching the Headache symptom —
the gate is checked before any product lookup.

### Phase 8 — web ✅

`npx expo export --platform web` produces a 2.07 MB single-page bundle in `dist/`. Verified running
standalone behind an SPA-fallback server: landing, deep links into any product tab, symptom search
and the red-flag screen all work with no console errors.

**The map now works on web too.** react-native-maps compiles to `UnimplementedView` there, so the
web build has its own implementation in `src/components/MapScreen.tsx` (Metro resolves
`.native.tsx` on device). It uses **Leaflet** with OpenStreetMap raster tiles — free, keyless, no
Google Cloud billing account. Real tiles, 18 tappable price pills with the nearest in black,
click-to-open pharmacy sheet with copy-address and directions, and the ODbL attribution control.
The tiles are desaturated in CSS to match the monochrome design.

MapLibre GL with OpenFreeMap vector tiles was tried first and abandoned: it loads its style and
sources but never fires `load` and paints nothing, and **the identical failure reproduces in a bare
CDN page with no bundler involved** — so it is MapLibre's WebGL/worker path, not this app. Shipping
a map that could not be verified was the worse option.

### Audit ✅

A 20-agent audit (10 auditors + 10 adversarial verifiers, 3.3M tokens, 1,241 tool calls) confirmed
**158 findings, 12 of them critical**. All 12 critical and most high findings are fixed and guarded
by build-time assertions. Full write-up in `docs/AUDIT.md`.

The catalogue grew from 838 to **1,024 products** in the process — the ATC allowlist had been
dropping Aspirin 81 mg, Canesten, Robaxacet, Diflucan One and every anti-itch cream.

### Interface work ✅

**Responsive.** The web build was rendering the phone layout full-bleed — at 1440px a product card
was 1,374px wide with the price stranded 1,200px from the name it belongs to. Content is now held
to a 680px measure and centred, on a page ground so the column reads as a surface. Below 700px
nothing changed, so the phone build is untouched. Fixed along the way: the product tab bar laid its
glyph and label out SIDE BY SIDE, because the `<a>` that expo-router's `Link asChild` renders does
not inherit React Native's column default. On a phone it happened to wrap and looked right.

**Dark mode.** Two full palettes in `src/theme.ts`, a context in `src/theme-context.tsx` that
follows the system by default with a persisted override, and an Auto / Light / Dark control on the
landing screen. Every component was migrated from a module-level `StyleSheet.create` to a
`makeStyles(palette)` factory so a theme change re-renders rather than needing a reload. Contrast
was computed for both palettes, not eyeballed — the light one had already shipped a 2.81:1 grey
carrying the medical disclaimer.

**Web affordances.** `src/components/WebStyles.tsx` injects what React Native has no concept of:
pointer cursors on role-based buttons, a visible `:focus-visible` ring for keyboard users, a hover
lift, and `prefers-reduced-motion` support.

### Lens ✅ (prototype)

Recognises a medicine from what is **printed on the package**, not from a barcode — which is the
input that actually generalises, since Health Canada deleted every UPC in 2025 and no free service
maps a Canadian OTC barcode to a product.

Capture → OCR → score the catalogue against the recognised words. Brand words weigh heaviest, then
ingredients, then a strength like "200 mg", which is the strongest disambiguator on a box. The
result is a ranked shortlist that **shows its working** ("read on the box: ibuprofen, 200MG") and
never navigates on its own — opening the wrong medicine is a safety problem, not a UX one.

Verified end to end: a rendered Advil package → Tesseract read
`"ibuprofen tablets USP 200 mg Pain Reliever / Fever Reducer 72 Caplets"` → the matcher returned
Apo-Ibuprofen 200MG, Ibuprofen 200 MG, Ibuprofen Tablets 200 MG.

| | |
|---|---|
| Web | Tesseract as WASM, **on-device** — the image never leaves the browser |
| Native (Expo Go) | No on-device OCR exists without a development build, so the Lens tab reports that honestly and the screen stays on barcode + typing |

Known limits: white-on-dark brand text (Advil's blue box) is missed without preprocessing — the
ingredient and strength still carry the match. The English model (~2 MB) is fetched once on first
use. `lens.web.ts` imports `lens-core`, never `./lens`: on web Metro resolves that back to itself,
and the cycle silently disabled the whole feature the first time.

## Next (search already matches symptom text
      through the openFDA label index; the closed picker and the red-flag gates are not built)
- [ ] a11y sweep and the study's four timed tasks re-run
- [ ] Seed `src/lib/barcodes.seed.ts` from real packages (deliberately empty — a wrong barcode
      mapping on a medicine app is a safety problem, not a data-quality one)
- [ ] Run on a physical phone via Expo Go (SDK 54, so this needs no Xcode)

### Build gate

`npm run data:verify` asserts the invariants that make the app *wrong* rather than ugly, and exits
non-zero if any break:

```
▸ ADR-004 — equivalence is ingredient ∩ route ∩ form ∩ non-prescription
  ✓ no equivalence group spans a route or dosage form
  ✓ every product has a DIN
  ✓ every product has a price
▸ ADR-007 — every price is either cited or flagged as an estimate
  ✓ no product claims a saving without a ratio
▸ Golden searches
  ✓ "advil"    -> Advil Caplets            with 10 alternatives
  ✓ "tylenol"  -> Tylenol Extra Strength   with 20 alternatives
  ✓ "claritin" -> Claritin Allergy         with  4 alternatives
  ✓ "benadryl" -> Extra Strength Benadryl  with 13 alternatives
  ✓ "ibuprofen"-> Advil Caplets            with 10 alternatives
▸ Runtime dataset matches the database
  ✓ product / pharmacy / group counts match
```

## Design system

The interface is built from tokens rather than per-file stylesheets. `src/theme.ts` holds two
palettes plus `space`, `radius`, `type` and `elevation(palette, level)`; every component is a
`makeStyles(palette)` factory read through a `useStyles()` hook, so a theme change re-resolves the
whole tree including its shadows.

| File | What it owns |
|---|---|
| `src/theme.ts` | Both palettes, the type scale, spacing, radii, palette-aware elevation |
| `src/theme-context.tsx` | System / light / dark, persisted |
| `src/components/Icon.tsx` | Every icon in the app. Semantic names → Ionicons + MaterialCommunityIcons. No Unicode glyphs anywhere |
| `src/components/ui.tsx` | `Card`, `SectionLabel`, `ActionTile`, `Button`, `Pill` |
| `src/components/Shell.tsx` | `useLayout()`, the two measures (720 reading / 1080 grid), `Contained`, `CardGrid` |
| `src/components/AppBar.tsx` | Application chrome — one row on desktop, stacked on a phone |
| `src/components/Sheet.tsx` | The one modal container: full-screen on a phone, a centred dialog on a desktop |
| `src/components/Brand.tsx` | The mark and the wordmark, drawn from Views |
| `src/components/Footer.tsx` | Data sources and the licence attributions three of them require |
| `src/components/WebStyles.tsx` | Cursors, focus ring, hover, scrollbar, font stack, reduced motion |

The rationale is in ADR-012 (design system), ADR-013 (the two measures) and ADR-014 (the
`Link asChild` styling rule, which is a correctness constraint, not a preference).

## Running it

```
npm run data:all     # rebuild the catalogue from source (steps 1-7)
npm run data:verify  # the build gate above
npm start            # Expo dev server — press w for web, or scan with Expo Go
```
