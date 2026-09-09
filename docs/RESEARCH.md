# MediSense — Feasibility Research

Generated 2026-08-30 by a 12-agent research workflow: 6 parallel researchers, each followed by an
adversarial verifier told to refute its findings. 1,262,489 tokens, 719 tool calls.

Researchers downloaded and joined the real datasets (Health Canada `allfiles.zip`, the Notice of
Compliance dumps, the ODB Formulary XML, OpenStreetMap Overpass) rather than answering from memory.
**Verifier corrections override the research sections below them** — several central claims were
materially wrong and are corrected in Part 3.

- Part 1 — Verdicts and recommendations, per dimension
- Part 2 — All verified findings with sources
- Part 3 — Adversarial corrections (READ THESE; they override Part 1)

Raw agent transcripts: `~/.claude/projects/-Users-parthjain-Documents-Code-Medisense/97d5c648-5d27-4b36-ba2d-10fa281a7416/subagents/workflows/wf_4fa4c6df-bf2/`

---

# Part 1 — Verdicts and recommendations



## drug-data

**Verdict:** FEASIBLE_FREE — Health Canada DPD (`ai_group_no`) + Health Canada NOC (`noc_crp_product_name`) give real, authoritative, free, no-auth Canadian brand→generic equivalence for ~272 OTC ingredient groups; openFDA fills in Drug Facts prose and barcodes; only retail store-brand names and prices must be synthesized.

### Summary
Health Canada's Drug Product Database (DPD) is fully sufficient and free, and it contains a field the design doc's authors almost certainly didn't know about: `ai_group_no`, an "Active Ingredient Group Number" that Health Canada assigns to every product sharing the same active-ingredient set at the same strength. Grouping marketed human OTC products by `ai_group_no` produces exactly the screen the spec asks for — ADVIL CAPLETS (DIN 01933531) and APO-IBUPROFEN, MOTRIN, JAMP/Vita Health/Pharmascience/Apotex ibuprofen 200 mg all land in group 0108883004. I downloaded the whole DPD bulk extract (allfiles.zip, 1.5 MB compressed / 12 MB across 12 pipe-free CSV files) and ran the join end to end: 13,384 marketed products, 11,497 human, 1,589 human OTC, 639 `ai_group_no` groups of which 272 have 2+ members and 155 have 3+. Separately, Health Canada's Notice of Compliance (NOC) API supplies the *authoritative* brand→generic link the DPD lacks: `noc_on_submission_type = "Abbreviated New Drug Submission (ANDS)"` plus `noc_crp_product_name` = the Canadian Reference Product the generic proved bioequivalence against (e.g. Apotex LORATADINE → CRP "CLARITIN"; Vita Health IBUPROFEN TABLETS 200 MG → CRP "ADVIL"). That pair is the literal, citable substance of the "Equivalency Explanation" accordion. openFDA supplies the OTC Drug Facts prose (purpose, indications_and_usage, warnings, dosage_and_administration) that DPD does not carry, plus UPCs for barcode scanning — because DPD stripped every UPC from its packaging file as of May 1, 2025 (I confirmed 0 non-empty UPC values in both package.txt and package_ia.txt). RxNorm/RxNav can map brand→generic via SBD→SCD but is US-only and has no Reactine, no Buckley's, so it is not a viable primary.

### Recommendation
BUILD A SEEDED LOCAL DATABASE FROM DPD + NOC. Do not query Health Canada live at request time — the API cannot filter by ai_group_no, so the equivalence query is impossible online.

ONE-TIME BUILD SCRIPT (runs in about 60 seconds, ~35 MB of downloads):
1. GET https://www.canada.ca/content/dam/hc-sc/documents/services/drug-product-database/allfiles.zip (1.5 MB). Unzip 12 headerless quoted-CSV files.
2. Load drug.txt, ingred.txt, schedule.txt, status.txt, form.txt, route.txt, comp.txt, ther.txt into SQLite keyed on DRUG_CODE, using the column orders listed in the findings.
3. Filter to the OTC universe: CLASS='Human' AND status.CURRENT_STATUS_FLAG='Y' AND status.STATUS='MARKETED' AND schedule.SCHEDULE='NON-PRESCRIPTION DRUGS'. → 1,589 products. Optionally narrow by ATC prefix (N02, R06, R05, M01, M02, A02, A03, A04, A06, A07) to drop the ~1,000 sunscreens and dandruff shampoos, leaving roughly 500–600 real medicines.
4. GET https://health-products.canada.ca/api/notice-of-compliance/drugproduct/?lang=en&type=json (10 MB, 77,626 rows) → build DIN → [noc_number].
5. GET https://health-products.canada.ca/api/notice-of-compliance/noticeofcompliancemain/?lang=en&type=json (23 MB, 37,868 rows, ~29 s) → keep the 1,825 rows where noc_product_type='Nonprescription Pharmaceutical'.
6. For each OTC product, join DIN → noc_number → NOC main. If noc_on_submission_type contains 'Abbreviated New Drug Submission', mark is_generic = true and store reference_brand = normalized(noc_crp_product_name) + reference_company = noc_crp_company_name + noc_date. Otherwise mark is_generic = false.
7. Build the equivalence index: GROUP BY ai_group_no over the OTC set. Within each group, the branded product shown at the top is the one that is (a) not ANDS-derived and (b) is named as a CRP by at least one group member — falling back to an innovator-company whitelist (Haleon, Kenvue, Bayer, Procter & Gamble, Church & Dwight, Reckitt, Prestige/Medtech, GSK Consumer). Everything else in the group, re-filtered to the same route_of_administration_name and to schedule='NON-PRESCRIPTION DRUGS', becomes the Alternatives list.

DATA MODEL: products(drug_code PK, din, brand_name, brand_name_fr, descriptor, company_name, ai_group_no, number_of_ais, class_name, schedule, status, atc_number, atc_name, is_generic, reference_brand, reference_company, noc_date, price_cad) + ingredients(drug_code, ingredient_name, ingredient_inn, strength, strength_unit) + forms(drug_code, form) + routes(drug_code, route). Ship it as a bundled SQLite file — the whole OTC slice is well under 2 MB — so the app works offline and search is instant. Refresh monthly (the extract was last updated 2026-08-04).

THE EQUIVALENCY EXPLANATION TEXT (FR1) writes itself from real fields, and this is the strongest part of the design:
"IBUPROFEN CAPLETS 200 MG (DIN 02368080, Vita Health Products Inc.) contains the same active ingredient, ibuprofen 200 mg, in the same dosage form (tablet) by the same route (oral) as ADVIL CAPLETS (DIN 01933531, Haleon Canada ULC). Health Canada assigned both products the same Active Ingredient Group Number, 0108883004. This product was authorized through an Abbreviated New Drug Submission, in which the manufacturer demonstrated bioequivalence to the Canadian Reference Product ADVIL. Non-medicinal ingredients, colour, shape and flavour may differ."
Every clause there is a database field, not a claim you invented. That is what makes the Expert Verification tab (FR5) defensible: cite the DPD page https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=13452, the NOC record, and the ANDS/CRP pair.

SUPPLEMENT WITH openFDA FOR PROSE AND BARCODES — do not use it for equivalence. At build time, for each seeded product query https://api.fda.gov/drug/label.json?search=openfda.generic_name:"<inn>"+AND+openfda.product_type:"HUMAN OTC DRUG"&limit=1 and cache purpose, indications_and_usage, warnings, do_not_use, dosage_and_administration, when_using, stop_use. That fills the product-info and usage accordions in tab 1 and gives you the symptom-search corpus (index indications_and_usage + purpose + the ATC class name for FR4's symptom search — "headache", "heartburn", "runny nose" all appear verbatim in those fields). Free at 1,000 req/day without a key; get the free key for 120,000/day. CC0, no attribution required, but label the section "US product labelling, shown for reference" since it is not the Canadian monograph.

BARCODE (FR4): DPD is a dead end — every UPC was removed on 2025-05-01. Use openFDA's openfda.upc (16,718 of 56,618 OTC records carry one) as a best-effort scan-to-product lookup, and for the demo hard-code the UPCs of your 15 seed products by physically reading them off packages. Do not promise general Canadian barcode coverage; no free authoritative Canadian OTC barcode registry exists.

WHAT YOU MUST SYNTHESIZE, AND SAY SO IN THE README: (a) prices in CAD — no free Canadian OTC retail price feed exists; generate plausible prices where generics sit 30–60% below the brand, which is what the ascending-price sort and price-range filter need; (b) retailer store-brand labels (Life Brand, Personnelle, Kirkland, no name, Exact) — map them onto the real contract-manufacturer DINs that already exist (Vita Health, Juno OTC, LNK International, Sigma Life Sciences, Angita, Guardian Drug, CRLS make these products in reality, so the mapping is realistic even though Health Canada does not publish it); (c) the pharmacist's written opinion for FR5 — write 15 short paragraphs yourself and attribute them to a fictional named pharmacist with a visible disclaimer.

FALLBACK IF THE NOC JOIN PROVES TOO FIDDLY: ship on ai_group_no alone plus a hand-curated 15-brand innovator whitelist. That still produces correct, real Alternatives lists for all 15 seed drugs; you lose only the "demonstrated bioequivalence to <CRP>" sentence, which you would replace with the weaker but still true "Health Canada assigns both products the same Active Ingredient Group Number."

### Risks
- The DPD API silently ignores unknown query parameters rather than erroring. ai_group_no=... and NOC's din=/brandname= all return the full unfiltered dataset. If a developer writes a filter that looks right and does not check the row count, they will ship code that appears to work and quietly returns everything.
- Prescription products live inside the same ai_group_no as their OTC counterparts. NEXIUM 24HR (OTC) sits in group 0145162001 with 12 prescription esomeprazole products; PEPCID AC (OTC) sits with two prescription FAMOTIDINE OMEGA injectables. Failing to re-filter group members on schedule='NON-PRESCRIPTION DRUGS' means the app recommends prescription drugs as OTC alternatives — a genuine safety issue, not just a bug.
- Dosage form is not constrained within a group: ACET 325 is a suppository in the same group as fifteen acetaminophen 325 mg oral tablets. Without a route/form filter the app will offer a suppository as an alternative to a caplet.
- 367 of 639 OTC ingredient groups are singletons. Reactine 5 mg, Nexium 24HR, Voltaren Emulgel and Polysporin Antibiotic Ointment have no cross-company alternative at all. If the UI assumes alternatives always exist, four of the fifteen obvious demo searches produce a broken screen.
- Brand-vs-generic is genuinely absent from DPD and the naive heuristic fails badly — it catches only 215 of 1,589 OTC products and misses every private-label trade name (Allergy Formula, 24 Hour Allergy Remedy, Allertin, Sleep-Eze, ZzzQuil, Anti-Nauseant, Diarrhea Relief), which are precisely the cheap alternatives the app exists to surface. The NOC join fixes this for 563 OTC products; outside that set you are guessing.
- Motrin and Advil share ai_group_no 0108883004, so a rule of 'first result is the brand, everything else is a generic' will render Motrin — a major brand — under 'Alternatives'. Any innovator-detection scheme must handle multiple brands per group.
- noc_crp_product_name is uncontrolled free text with real typos in the source data ('ADVIL IBOPROFEN TABLETS') and comma-joined multi-values ('ADVIL LIQUI-GELS, ADVIL EXTRA STRENGTH LIQUI-GELS'). Matching it back to a DPD brand_name needs normalization and fuzzy matching; expect a tail of unmatched records.
- No barcode data exists on the Canadian side at all since 2025-05-01. FR4's barcode scan cannot be built against Health Canada data — only against openFDA's partial US UPCs (29% coverage) or hand-entered demo codes.
- Roughly two-thirds of the 1,589 'OTC' products are sunscreens, anti-dandruff shampoos and topical cosmetics. An unfiltered seed will look like a sunscreen catalogue rather than a medicine finder.
- Metamucil, Nicorette, Halls, melatonin, most vitamins and plain Tums are Natural Health Products with NPNs and are entirely absent from DPD. Users will search for them. The LNHPD API exists but its productlicence endpoint has no brand-name search parameter, so you cannot cheaply fill the gap.
- DPD imposes no documented rate limit and I observed no throttling over 30 requests, but that is not a guarantee. A mobile app fanning out per-product calls at request time could get blocked with no warning and no Retry-After header. The bulk extract exists for exactly this reason.
- Reproducing store-brand names (Life Brand, Kirkland, Personnelle) and prices is fabrication of commercial data. It is fine for a class project, but the seeded records must be visibly labelled as demo data in the UI and README, not just in a code comment — otherwise a screen showing a pharmacist checkmark next to an invented price reads as an authoritative claim about a real product.


## mobile-stack

**Verdict:** FEASIBLE_FREE — Expo SDK 57 + Expo Go + bundled SQLite FTS5 + Supabase free tier + EAS Hosting free tier delivers all 5 functional requirements at $0, with the single caveat that testing on a physical iPhone requires a local Xcode build (free Apple ID, 7-day cert) because App Store Expo Go is stuck on SDK 54.

### Summary
Expo SDK 57 (released 2026-06-30, currently expo@57.0.18) is the right foundation: React Native 0.86.3, React 19.2.3, New Architecture mandatory. The decisive discovery is that every native capability MediSense needs — expo-camera barcode scanning, expo-location, expo-clipboard, expo-image, expo-sqlite, and react-native-maps — is bundled in Expo Go, so the whole app can be built without a development build, provided you avoid three specific packages (expo-maps, react-native-mmkv, react-native-unistyles). The second decisive discovery cuts the other way: as of the May 4 2026 Expo changelog, Expo Go on the iOS App Store is still pinned to SDK 54 and newer versions are stuck awaiting Apple approval, so a physical iPhone requires either a local Xcode build (the only free path) or an Android device / iOS Simulator instead. On the PWA question, the crux is narrower than expected: expo-camera's web implementation already falls back to the `barcode-detector` ZXing-WASM polyfill when `BarcodeDetector` is absent, so barcode scanning genuinely works in iOS Safari on the web export — meaning Expo gives you the native app AND the shareable web link from one codebase, which Next.js cannot reciprocate. The real losses on web are the map tab (`react-native-maps` compiles to `UnimplementedView` on web) and iOS standalone-PWA camera permission re-prompting. Backend: this app is read-mostly reference data, so ship a prebuilt SQLite FTS5 index in the app bundle and use Supabase's free tier only as the authoring store plus a key-hiding Edge Function proxy.

### Recommendation
SHIP EXPO SDK 57, NOT NEXT.JS. The decision hinges on one verified fact: expo-camera's web build already falls back to the `barcode-detector` ZXing-WASM polyfill, so `<CameraView onBarcodeScanned>` scans EAN-13/UPC-A identically on iOS native, Android native, and iOS Safari. Expo therefore gives you both the native app and the shareable web link from one codebase, while a Next.js PWA gives you only the link and still has to hand-roll the same polyfill. Next.js wins nothing here except deploy simplicity.

THE STACK (exact versions):
- expo@57.0.18 (must be >= 57.0.17 for the Hermes memory + startup fixes), RN 0.86.3, React 19.2.3. Init: `npx create-expo-app@latest medisense --template default@sdk-57`. New Architecture is on and cannot be disabled.
- Routing: expo-router@57.0.17 with `experiments.typedRoutes: true`. Root `_layout.tsx` = `<Stack screenOptions={{ headerShown: false }}>` — that alone deletes the back button and the nav bar. Structure:
  app/_layout.tsx | app/index.tsx (home: search + history) | app/search.tsx (Branded card + Alternatives, filter/sort) | app/scan.tsx (camera) | app/product/[id]/_layout.tsx + index.tsx + verified.tsx + map.tsx + directions.tsx
- The 4 tabs: `app/product/[id]/_layout.tsx` uses the headless `expo-router/ui` navigator with `<TabList>` rendered ABOVE `<TabSlot/>`, giving a top segmented control, URL-addressable tabs on web, and zero chrome. Use `asChild` on TabTrigger to render your own black-and-white pill buttons. (It's flagged experimental; fallback is plain `useState` + a Reanimated-animated `<View>` row, which costs you the per-tab URL.) "Search bar returns you home" = `router.dismissAll(); router.replace('/')`.
- Native modules, all Expo-Go-compatible: expo-camera@57.0.4 (barcode + photo capture for OCR), expo-location@57.0.14, react-native-maps@1.27.2 (NOT expo-maps — you need `<Marker>` children to draw the price on the marker), expo-clipboard@57.0.1 (copy address), expo-haptics@57.0.2, expo-image@57.0.3, expo-sqlite@57.0.2.
- Directions button: `Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&destination_place_id=<id>')` — one universal link that works on iOS, Android and web, no SDK needed.
- Animation: react-native-reanimated@4.5.1 + react-native-worklets@0.10.1 + react-native-gesture-handler@2.32.0, installed ONLY via `npx expo install` (npm latest 4.6.0 demands worklets 0.12.x and will break the pin). Accordions: `Animated.View` with `layout={LinearTransition}` plus a rotating chevron; Reanimated 4's CSS-transition API keeps this working on web.
- Styling: nativewind@4.2.6 + tailwindcss@3.4.19 (`v3-lts`). Pure babel/metro transform, so it stays Expo-Go-safe and renders identically through react-native-web. Do NOT use Unistyles (nitro-modules → dev build) and do NOT jump to NativeWind v5 preview. A black-and-white theme is ~8 tokens; StyleSheet would also be fine, but NativeWind pays for itself on the web target.

DATA + BACKEND — bundle the index, don't call a server on the hot path:
The 42.51s search-task figure is a latency-and-affordance problem, so make search local and instant. Ship a prebuilt `assets/medisense.db` (SQLite with FTS5, which expo-sqlite enables by default) mounted via `<SQLiteProvider databaseName="medisense.db" assetSource={{ assetId: require('../assets/medisense.db') }}>`. Every symptom / brand / ingredient / barcode lookup is then a sub-50ms local query with zero network, zero cold start, and full offline behaviour. Supabase Postgres (free tier) is the AUTHORING store; a Node build script (better-sqlite3) exports it to the .db asset, which you commit. Supabase is touched at runtime only for (a) a price-delta refresh, (b) the Google Places / OCR proxy as an Edge Function — which is also how you keep the Places key out of the client bundle. This design is immune to Supabase's 1-week free-tier pause: if the DB is asleep, the app still works completely, it just shows stale prices.
Note the legitimate exception: the Google Maps SDK for Android key DOES ship in the app (restricted by package name + SHA-1 fingerprint) — that's the documented, safe pattern. Only the Places Web Service key needs proxying.

SCHEMA (Postgres, mirrored into SQLite):
ingredient(id, inn_name, atc_code) | product(id, din, npn, gtin, brand_name, manufacturer, is_branded, dosage_form, strength_text, package_size, image_url) | product_ingredient(product_id, ingredient_id, strength_mg, is_active) | equivalence_group(id, signature) — normalized active-ingredient + strength + form key | product_equivalence(product_id, group_id, role: 'brand'|'generic') | equivalency_note(group_id, body_md, differences_md, updated_at) — powers the expandable Equivalency Explanation | symptom(id, label, synonyms[]) | symptom_ingredient(symptom_id, ingredient_id, rank) | pharmacy(id, name, chain, address, city, province, postal_code, lat, lng, google_place_id, phone) | price(id, product_id, pharmacy_id, price_cad numeric(6,2), observed_at, source) | verification(id, group_id|product_id, pharmacist_name, credentials, licence_number, opinion_md, verified_at, status) | reference_link(verification_id, title, url, publisher) | search_history(LOCAL SQLite only — id, query, kind, ts, product_id).
Plus a `product_fts` FTS5 virtual table over brand_name + generic_name + ingredient names + symptom labels, and a unique index on gtin for the barcode path. Results = `ORDER BY min_price ASC`, filters map to `WHERE verified = 1`, `WHERE is_branded = 1`, `WHERE price BETWEEN ? AND ?` — requirement 2 and 4 fall out of the schema.

CACHING: @tanstack/react-query@5.102.8 + @tanstack/react-query-persist-client for the only two things that are actually remote (price refresh, nearby pharmacies), persisted through `expo-sqlite/kv-store` — an AsyncStorage-API-compatible store with synchronous `getItemSync`/`setItemSync`. Skip react-native-mmkv entirely: it forces a development build and buys you nothing that kv-store doesn't already give you, since your real index is SQLite.

DEV LOOP (given App Store Expo Go is stuck on SDK 54):
Daily: `npx expo start` → iOS Simulator (Expo Go for the simulator is downloadable for any SDK via Expo CLI) + `--web` in a browser. Physical Android: install the SDK 57 Expo Go APK via Expo CLI, or `eas build --profile preview` (`distribution: 'internal'`) for an APK link — 15 free Android builds/month. Physical iPhone with no Apple Developer account: `npx expo run:ios --device` locally (Xcode, free Apple ID, 7-day cert) — Expo's docs state this is the ONLY way. Do not plan around `eas go`; it needs the $99/yr membership.

SHAREABLE LINK: `npx expo export --platform web && eas deploy` with `web.output: 'single'` → a free expo.app URL (100k requests/mo, 5 aliases, no custom domain on Free). What breaks on web and needs a `.web.tsx` sibling: the map tab (react-native-maps compiles to `UnimplementedView` — implement `map.web.tsx` with the Google Maps JS API or a Static Maps image), and expo-sqlite (web support is alpha and needs COOP/COEP, which fights the jsDelivr WASM fetch — instead ship the same dataset as a gzipped JSON blob behind an identical repository interface in `db.web.ts`). Camera and barcode scanning DO work on the web build, including iOS Safari — demo it in a Safari tab, not from the home screen, to dodge the WebKit PWA camera re-prompt bug. Self-host the ZXing .wasm via `prepareZXingModule({ overrides: { locateFile } })` so the demo has no CDN dependency.

FALLBACK PATH: if the headless `expo-router/ui` Tabs proves too rough (it is marked experimental), swap `product/[id]/_layout.tsx` for local state + a Reanimated tab strip — a 40-line change, no other file affected. If Supabase's inactivity pause is annoying even for authoring, the entire backend collapses to a single Cloudflare Worker (hono@4.13.5) on the free tier — 100,000 requests per DAY, static assets free and unlimited — with the drug data as a committed SQLite/D1 file; you lose the dashboard, you lose nothing else.

### Risks
- iPhone testing is the biggest practical risk. App Store Expo Go has been pinned to SDK 54 since at least May 2026 with SDK 55, 56 and 57 all 'still waiting on approval' and no timeline given. If the developer has no Mac/Xcode, there is NO free way to run SDK 57 on a physical iPhone: `eas go` needs the $99/yr Apple Developer Program, and the TestFlight external beta group is at capacity. Mitigation: the environment reports darwin, so Xcode is presumably available — but confirm before committing.
- `expo-router/ui` headless Tabs is explicitly labelled EXPERIMENTAL in the Expo docs. It is the cleanest expression of the 4-tab-with-no-bottom-bar design, but it could regress across SDK bumps. Keep the tab layout isolated in one file so the fallback (local state + animated strip) is a single-file swap.
- expo-maps looks like the 'blessed' choice and is a trap for this specific design: its markers accept only image references (via expo-image's useImage), never React children, so you physically cannot render '$8.99' on a marker without pre-rendering an image per price. It is also alpha, absent from Expo Go, iOS 17+ only, and Apple-Maps-only on iOS. Committing to it would require rebuilding the map tab.
- On the web export the map tab renders nothing at all — react-native-maps' web entry is literally `react-native-web/dist/modules/UnimplementedView`. If the shareable link is meant to demo all four tabs, budget real time for a separate `map.web.tsx` (Google Maps JS API loader, its own key, its own restrictions).
- Cross-origin-isolation conflict on the web build: expo-sqlite's web (alpha) support needs COOP/COEP for SharedArrayBuffer, while the barcode polyfill fetches its .wasm cross-origin from jsDelivr by default. Enabling one plausibly breaks the other. I did not empirically verify the interaction. Avoid it by not using expo-sqlite on web and by self-hosting the ZXing wasm.
- Reanimated/worklets version drift: npm latest reanimated 4.6.0 requires worklets 0.12.x, but SDK 57 pins 4.5.1/0.10.1. A stray `npm install react-native-reanimated` (instead of `npx expo install`) silently produces a mismatched pair. Also, SDK 56 and early SDK 57 shipped a Hermes V1 regression that badly inflated memory in any app importing reanimated — pin expo >= 57.0.17.
- EAS Hosting Free allows only 10 CPU-ms and 10 subrequests PER REQUEST (paid plans get 30,000 and 1,000). An Expo Router API route that proxies Google Places may or may not fit; I could not verify empirically. Cloudflare Workers Free (100k req/day, 10ms CPU, free static assets) or a Supabase Edge Function (500k invocations/mo) are safer homes for the key-hiding proxy.
- Supabase Free pauses a project after 1 week of inactivity and allows only 2 active projects. For a portfolio piece that sits idle between showings, a cold demo would hit a paused database. The bundled-SQLite architecture is specifically designed to make this a non-event, but any runtime feature you push to Supabase reintroduces the risk.
- On-device OCR is the only requirement that cannot be met inside Expo Go — every ML Kit / Apple Vision wrapper is a custom native module. Routing OCR to a server keeps you on Expo Go but adds a network round-trip and an API cost to a core stated feature. If on-device OCR becomes a hard requirement, the whole project moves to a development build and the iPhone-testing problem above gets worse.
- NativeWind 4.2.6 was published 2026-06-22, days before SDK 57 shipped, and I found no published compatibility matrix asserting it is tested against RN 0.86. It is a build-time transform (low native-breakage surface) and the maintainers are actively prepping v5, but treat 'works on SDK 57' as probable rather than proven — validate with a throwaway project before building on it.
- Sharing via Expo Go is dead for third parties: since 2026-05-12, Expo Go loads EAS Update projects only for owners/org members, across ALL Expo Go versions. Any plan that assumed 'send a QR to a recruiter' must be replaced by the web deployment or a store testing track.
- The Fly.io and Railway free-tier figures come from 2026 third-party pricing round-ups, not from vendor pages I fetched. Directionally certain (both removed their free tiers), but the exact trial terms are unverified.


## pharmacy-price

**Verdict:** FEASIBLE_WITH_SYNTHETIC_DATA — pharmacy locations are 100% real and free (OSM/Overpass, 701 Toronto pharmacies verified live), and the branded-vs-generic price *relationship* is real and free (ODB Formulary XML, per-DIN unit prices, OTC products included), but the per-pharmacy retail shelf price shown on each map marker does not exist in any public source and must be modelled from the ODB base price with a documented, disclosed generation rule.

### Summary
Pharmacy locations are a solved, free problem: OpenStreetMap via Overpass API returns 701 pharmacies inside the City of Toronto boundary (verified live, 2026-08-31), with 91 within 2 km of Yonge & Dundas, ~57% carrying brand tags (Shoppers Drug Mart, Rexall, IDA, Pharmasave) and 55% carrying housenumber+street. Google Places API (New) searchNearby works with includedTypes: ["pharmacy"], but requires a billing account and costs $32.00/1,000 after only 5,000 free calls/month — and the "Places - Nearby Search" free-credit model was replaced by per-SKU caps in March 2025. Critically, the mobile "Maps SDK" SKU (6DE1-4D9C-5B67) is Unlimited/free, so rendering a Google map on iOS/Android costs nothing; only the Places lookups bill. On price: NO public API returns retail shelf prices at Canadian pharmacies — Loblaw/Shoppers, Rexall, Walmart.ca and Costco.ca have no public product-price API, and Walmart's developer APIs are seller-facing only. HOWEVER, the biggest find of this research is that the Ontario Drug Benefit Formulary/CDI XML extract IS a real, free, downloadable government price file keyed by DIN, it DOES contain OTC products (34 drugs flagged selfMed="Y", plus ibuprofen, acetaminophen, loratadine, cetirizine, famotidine, docusate, senna, bisacodyl), and its real branded-vs-generic ratios match the pCPA Tiered Pricing Framework exactly (Motrin 400mg $0.1871/tab vs Apo-Ibuprofen $0.0468/tab = precisely 25.0%). So the "generic is cheaper" claim can be backed by real government data; only the per-pharmacy variation on the map markers must be synthesized, and that synthesis has a citable, honest rule.

### Recommendation
MAP TAB — build it with react-native-maps 1.29.0, Apple Maps on iOS (zero config, zero cost) and PROVIDER_GOOGLE on Android (Maps SDK SKU 6DE1-4D9C-5B67 is Unlimited/free, so the map itself never bills; you still need a billing-enabled Cloud project and an Android-restricted key with a SHA-1 fingerprint). Add "plugins": ["react-native-maps"] to app.json and use an EAS development build — this will not run in Expo Go. Do NOT use expo-maps: it is still alpha and its markers are image-only, which cannot render a price label. If you want to avoid Google Cloud entirely, the fallback is @maplibre/maplibre-react-native 11.3.7 with OpenFreeMap's "positron" style (https://tiles.openfreemap.org/styles/positron — no key, no limits, and its grey-and-white cartography matches the black-and-white brief better than either native provider), using <MarkerView> for the tappable price pills.

MARKERS — the design's white-price-marker / black-nearest-marker is a direct fit for react-native-maps' children API:
<Marker coordinate={p.coord} onPress={() => open(p)} tracksViewChanges={tracking} anchor={{x:0.5,y:1}}>
  <View style={[styles.pill, p.isNearest && styles.pillNearest]}>
    <Text style={[styles.price, p.isNearest && styles.priceNearest]}>{`Est. $${p.price.toFixed(2)}`}</Text>
  </View>
</Marker>
Start tracksViewChanges={true}, then flip it to false in a setTimeout/onLayout after the first paint — leaving it true with 90 markers tanks the frame rate, and setting it false too early makes the pills render blank on iOS. Render the user's blue pin with <Marker.Animated> or the built-in showsUserLocation, and get the fix from expo-location 57.0.14.

PHARMACY LOCATIONS — use OpenStreetMap, not Google Places. Run the Overpass query once at build time against the City of Toronto boundary (701 pharmacies, verified live), convert to GeoJSON, and ship it in the bundle. This costs $0, needs no billing account, has no rate limit at runtime, gives you real brands (26 Shoppers, 14 Rexall, 4 IDA, 3 Pharmasave downtown), and makes the demo deterministic and offline-capable. Skip Google Places: $32.00/1,000 after only 5,000 free calls, mandatory billing account, and it buys you nothing OSM doesn't already have for this use case. Skip ODHF entirely — I downloaded it and confirmed it contains zero pharmacies. Skip Toronto Open Data — the CKAN search returns 0 results. Skip the OCP register — CSV export only between 5 p.m. and midnight, no coordinates. Put a tappable "© OpenStreetMap" credit in the map's bottom corner (it may auto-collapse on map interaction, but must stay reachable — and with no nav bar, the corner credit is your only place for it).

PRICE — this is the honest part, and it is better news than expected. Do NOT invent prices from nothing. Build a three-layer model where two layers are real:
  Layer 1 (REAL, cited): ship the ODB Formulary Edition 43 XML extract (https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml, 3.6 MB, createDate 2026-08-26, OGL-ON-1.0). Pin the file — do not fetch at runtime, and never use the legacy health.gov.on.ca URL, which currently has an expired TLS cert and returns 502. Parse pcg2 → pcg6 → genericName(name = active ingredient) → pcgGroup → pcg9(strength, dosageForm, itemNumber) → drug(id = DIN, name, manufacturerId, individualPrice, amountMOHLTCPays, lccNote). Join drug id → Health Canada DPD /api/drug/drugproduct/?din= → /api/drug/schedule/?id= and keep only schedule_name "NON-PRESCRIPTION DRUGS". You get 713 pcg9 groups with a genuine branded-vs-generic price spread, and 34 products explicitly flagged selfMed="Y". Seed your catalogue from ~30 of these (ibuprofen, acetaminophen, loratadine, cetirizine, famotidine, docusate, senna, bisacodyl, dimenhydrinate, clotrimazole).
  Layer 2 (REAL, cited): the branded-vs-generic ratio is not invented — it is the pCPA Tiered Pricing Framework (Tier 1 = 85% or 75%→55%, Tier 2 = 50%, Tier 3 = 25% oral solids / 35% other), and the ODB file matches it to within a rounding error (Motrin 400mg $0.1871 vs Apo-Ibuprofen $0.0468 = exactly 25.0%; Dulcolax supp $1.2267 vs Jamp bisacodyl $0.4206 = 34.3%). Compute the discount from the real numbers and cite the framework in the Equivalency Explanation accordion. Handle the Senokot case (generic at 100% of brand) by showing "no saving on this product" rather than forcing a fake discount.
  Layer 3 (SYNTHESIZED, disclosed): only the per-pharmacy shelf price is invented. Rule: packPrice = individualPrice × packSize(curated table, since DPD packaging is empty) × 1.08 (the ODB Reg. 201/96 8% dispenser mark-up) × retailMultiplier, then per-store variance = packPrice × (1 + jitter), where jitter comes from a deterministic seeded PRNG — mulberry32 seeded with an FNV-1a hash of `${din}:${osmId}` — clamped to ±12%, plus a small fixed per-banner offset. Determinism is non-negotiable: the same pharmacy must show the same price on every launch or the demo looks broken and dishonest. Store the generated table as a committed JSON file with the seed and the formula in a header comment, so it is reproducible and reviewable.

REQUIRED UI DISCLOSURE (do not ship without these — the app's whole claim is "this is cheaper", and an undisclosed fake price on a health app is the one thing that turns a good project into an irresponsible one):
  1. Every price string is prefixed "Est." — on the map markers, in the results list, and on the product detail tabs. Never a bare "$4.99" next to a real chain's name.
  2. A persistent, non-dismissible one-line banner on the map tab: "Estimated prices — not live retail prices. Based on Ontario Drug Benefit Formulary unit prices (Edition 43, 26 Aug 2026)."
  3. A "How prices are estimated" screen reachable from an ⓘ next to any price, showing the actual formula, the seed, the ODB source link, the pCPA TPF link, and the sentence "MediSense does not have access to any pharmacy's real shelf prices. No Canadian pharmacy publishes them."
  4. Show the ODB createDate as an explicit "price basis date" on the product detail page.
  5. Frame savings comparatively, never absolutely: "generics of this ingredient list at about 25% of the brand price under Ontario's formulary" — which is true and cited — rather than "you will save $6.42", which is not.
  6. Since the design has no back button, the ⓘ disclosure sheet must be a modal that dismisses to where it was opened, not a navigation push.

### Risks
- The map tab's single most misleading element is the per-pharmacy price label, and it is the one number with no real source. If the disclosure is weak, a grader or a user could reasonably read this as a health app fabricating prices for real, named businesses (Shoppers Drug Mart, Rexall) pulled from OSM. Mitigate with the 'Est.' prefix everywhere plus the persistent banner — or, if you want to remove the risk entirely, replace the OSM brand names with generic labels ('Pharmacy A') on the price markers while keeping real coordinates.
- ODB individualPrice is a per-UNIT wholesale benefit price (e.g. $0.0114 per acetaminophen tablet), not a shelf price. Multiplying by a curated pack size and a markup produces a plausible number, but it is structurally a different quantity from what a shopper pays — a 100-count bottle of store-brand acetaminophen retails around $5-8 while 100 x $0.0114 x 1.08 is $1.23. Your retailMultiplier is doing a lot of load-bearing work; pick it by spot-checking a handful of real shelf prices manually and document that you did.
- The ODB extract's brand records frequently have NO individualPrice at all (7,751 prices across 8,668 drugs; Claritin, Atasol, Maalox, Betadine and several Motrin strengths are priceless). Requirement 1 puts a BRANDED drug at the top of every result — so for many ingredients your headline product has no price to show. Plan a fallback: either derive the brand price by inverting the TPF tier from the generic, or show 'brand price not listed in the ODB Formulary' honestly.
- The ontario.ca XML URL is date-stamped per monthly edition (.../2026-08/...-2026-08-27.xml) and will 404 when Edition 43's next monthly update lands. Do not fetch it at runtime. The 'stable' health.gov.on.ca URL that both data.ontario.ca and open.canada.ca still advertise is already broken — expired TLS certificate, HTTP 502.
- Overpass fair-use guidance for a distributed application is roughly 100 queries and 10 MB per day. A live per-user radius query will work for a demo and will not work if the app is ever shared. Bake the 701-pharmacy GeoJSON at build time.
- OSM coverage is uneven: only 50 of 91 downtown pharmacies had housenumber+street, and only 27 had opening_hours. Tab 4 (address + copy-address + directions) will hit records with no street address. Fall back to reverse-geocoding the coordinate, or to passing raw lat,lng to the directions URL, which both Google and Apple accept.
- react-native-maps custom-children markers are a known performance and rendering trap: tracksViewChanges left true with dozens of markers destroys the frame rate, and set false too early renders blank pills on iOS. Budget time for the two-phase toggle.
- expo-maps being alpha means any tutorial or LLM suggestion you follow may be for a broken API surface; and if you did pick it, its image-only markers cannot render a price label without pre-rasterising every price. Do not let a well-meaning refactor swap react-native-maps for expo-maps.
- Google Places, if you use it despite the recommendation, requires a billing account with a real credit card even to consume the 5,000 free Nearby Search calls, and there is no Essentials tier for Nearby Search — the floor is $32.00/1,000. A misconfigured retry loop is a genuine financial risk on a student account.
- Stadia Maps' free tier forbids commercial use. If this project ever goes into a portfolio that's monetised or into an app store with any paid element, that tier is no longer compliant. OpenFreeMap has no such restriction and is the safer default.
- CARTO's terms were updated 26 August 2026 to require an API key and to allow watermarking of unauthenticated tiles — code copied from older tutorials that hits basemaps.cartocdn.com keyless is now on the watermarked path.
- Scraping Shoppers Drug Mart, Loblaws, Rexall, Walmart.ca or Costco.ca for prices would almost certainly breach their Terms of Use regardless of what robots.txt permits, and doing it in a submitted academic project is a reputational risk out of all proportion to the benefit. Every 'API' offering this data (Apify, RealDataAPI, SerpApi, Actowiz) is a paid third-party scraper reselling the same exposure.


## symptom-search

**Verdict:** FEASIBLE_FREE — every data source needed is free and openly licensed (openFDA is CC0 public domain; Health Canada DPD and LNHPD are Open Government Licence – Canada; no API keys required), but the symptom→drug mapping itself must be hand-curated and frozen at build time, not queried live from any classification API.

### Summary
Symptom search is feasible and is actually the best-supported of the four search inputs — but not by the route you'd expect. There is no free, safe, machine-readable "symptom → OTC drug" dataset that can be queried at runtime: RxClass `may_treat` exists and is free but is clinically scoped to all of medicine, not self-care, and returns actively dangerous results (Headache → octopamine, acetylcholine, belladonna alkaloids, butalbital, and NOT acetaminophen or ibuprofen; Fever → ceftazidime, meropenem, ciprofloxacin; Cough → codeine, hydrocodone, cocaine). Health Canada's DPD `therapeuticclass` endpoint returns only `tc_atc_number` + `tc_atc` (ATC — no AHFS at all), and ATC is an anatomical/chemical taxonomy, not an indication one. The DPD API contains no indication or symptom text anywhere. What does work: openFDA `/drug/label.json` full-text search over `indications_and_usage` on the ~50,000 US OTC Drug Facts labels, faceted by `count=openfda.generic_name.exact`, which yields a clean, ranked, empirically-grounded symptom → ingredient list for every symptom I tested (25/25). I also found that openFDA carries the FDA OTC monograph number M001–M032 in `openfda.application_number`, making the whole monograph taxonomy machine-readable and countable. The correct architecture is to run openFDA offline as an evidence generator, freeze the result into a hand-curated 22-symptom table cited to Health Canada labelling standards and FDA monographs, and resolve it to Canadian products through DPD ingredient names — a pipeline I ran end-to-end against 2,840 marketed Canadian non-prescription DINs.

### Recommendation
BUILD A FROZEN, HAND-CURATED SYMPTOM TABLE. Use openFDA offline as the evidence generator, Health Canada labelling standards as the citation, and DPD as the runtime product resolver. Do not call any classification API at request time.

=== 1. SCHEMA (SQLite/Postgres, ~5 tables, ships in the app bundle) ===

symptom(
  id TEXT PK,                    -- 'headache'
  label TEXT,                    -- 'Headache'
  synonyms TEXT[],               -- ['head ache','migraine','head pain','sore head'] -> drives fuzzy match
  mesh_id TEXT NULL,             -- 'D006261', optional cross-ref only
  body_area TEXT,                -- for the picker grid: head, chest, stomach, skin, eyes, sleep
  triage_level INT,              -- 0 = self-care ok, 1 = show soft caution, 2 = HARD interstitial
  disclaimer_key TEXT
)

symptom_ingredient(
  symptom_id TEXT FK,
  ingredient_name TEXT,          -- MUST be the DPD-normalized uppercase form, e.g. 'ACETAMINOPHEN'
  ingredient_class TEXT,         -- 'Analgesic / antipyretic'
  rank INT,                      -- 1 = first-line; drives result ordering
  atc_prefix TEXT,               -- 'N02BE' — QA cross-check against DPD therapeuticclass
  fda_monograph TEXT,            -- 'M013' — badge + cross-check against openfda.application_number
  source_type TEXT,              -- 'HC_LABELLING_STANDARD' | 'HC_CATEGORY_IV' | 'FDA_MONOGRAPH'
  source_title TEXT,             -- 'Acetaminophen Labelling Standard [2016-09-15]'
  source_url TEXT,               -- the exact canada.ca or accessdata.fda.gov URL
  evidence_label_count INT       -- the openFDA count, e.g. 955 — provenance, shown in the equivalency accordion
)

product(drug_code PK, din, brand_name, company_name, schedule_name, status, ai_group_no, atc_code, atc_name, is_branded BOOL)
product_ingredient(drug_code FK, ingredient_name, strength, strength_unit)
red_flag(id, symptom_id NULL, trigger_type, question_text, action, source_url)

=== 2. THE 22-SYMPTOM TAXONOMY (ingredient classes + citation per row) ===
Format: SYMPTOM -> ingredient class [Canadian OTC ingredients] | ATC | FDA monograph | HC source

 1. Headache -> analgesic/antipyretic [acetaminophen; ibuprofen; ASA; naproxen sodium] | N02BE, N02BA, M01AE | M013 | HC Acetaminophen LS [2016-09-15] + Acetylsalicylic Acid LS [2013-10-17]
 2. Fever -> antipyretic [acetaminophen; ibuprofen] | N02BE01, M01AE01 | M013 | HC Acetaminophen LS
 3. Muscle / joint pain -> oral analgesic + topical counterirritant/NSAID [ibuprofen; naproxen; menthol; camphor; methyl salicylate; trolamine salicylate; diclofenac topical] | M01AE, M02AC, M02AX | M013 + M017 | HC Triethanolamine Salicylate (Trolamine) LS [1995-09-13] + HC Topical Anaesthetic/Analgesic/Antipruritic LS [2015-07-29]
 4. Menstrual cramps -> NSAID / analgesic [ibuprofen; naproxen sodium; acetaminophen] | M01AE, N02BE | M013 + M027 | HC Acetaminophen LS
 5. Sore throat -> topical anaesthetic lozenge/spray [benzocaine; menthol; amylmetacresol; dyclonine; lidocaine] | R02AA, R02AD | M012 | HC Category IV: Throat Lozenges
 6. Nasal congestion -> decongestant, oral + topical [pseudoephedrine; phenylephrine; xylometazoline; oxymetazoline] | R01BA, R01AA | M012 | HC Topical Nasal Decongestants LS [2014-05-30] + HC Non-prescription Oral Adult Nasal Decongestant LS
 7. Runny nose / sneezing / allergies -> antihistamine [loratadine; cetirizine; fexofenadine; diphenhydramine; chlorpheniramine] | R06AX, R06AE, R06AA | M012 | HC Adult Cough, Cold and Flu LS [2025-04-01]
 8. Cough -> antitussive + expectorant [dextromethorphan; guaifenesin] | R05DA09, R05CA03 | M012 | HC Non-prescription Oral Adult Antitussive Cough and Cold LS
 9. Heartburn / acid reflux -> antacid, H2RA, PPI [calcium carbonate; Mg hydroxide; Al hydroxide; famotidine; omeprazole; esomeprazole] | A02AC, A02BA, A02BC | M001 | HC Antacids LS [1994-07-24]
10. Indigestion / upset stomach -> antacid + bismuth [calcium carbonate; bismuth subsalicylate; sodium bicarbonate] | A02A, A07BB | M001 | HC Bismuth Subsalicylate LS [1996-05-17]
11. Gas / bloating -> antiflatulent [simethicone] | A03AX13 | M002 | HC Antiflatulents LS [1996-07-19]
12. Nausea / motion sickness -> antiemetic antihistamine [dimenhydrinate; meclizine] | R06AA02, R06AE05 | M009 | HC Dimenhydrinate LS [1994-12-01]
13. Diarrhea -> antidiarrheal [loperamide; bismuth subsalicylate; attapulgite] | A07DA03, A07BB | M008 | HC Bismuth Subsalicylate LS
14. Constipation -> laxatives, 5 classes [bulk: psyllium; stimulant: sennosides, bisacodyl; osmotic: PEG 3350, Mg hydroxide, lactulose; softener: docusate; lubricant: mineral oil] | A06AC, A06AB, A06AD, A06AA | M007 | HC Laxatives LS family (Bulk Forming [2012-07-09], Stimulant [1997-10-03], Stool Softener [2015-07-28], Lubricant, General, Lactulose)
15. Insomnia -> nighttime sleep aid antihistamine [diphenhydramine; doxylamine] | R06AA02, R06AA09 | M010 | HC Sleep Aids LS [1993-07-12]
16. Itchy skin / rash -> topical corticosteroid + antipruritic [hydrocortisone 0.5%; calamine; pramoxine; colloidal oatmeal] | D07AA02, D04AB, D02AB | M017 | HC Topical Anaesthetic/Analgesic/Antipruritic LS [2015-07-29]
17. Minor cuts / scrapes -> antiseptic + first-aid antibiotic [povidone-iodine; benzalkonium; chlorhexidine; hydrogen peroxide; bacitracin/polymyxin B] | D08AG, D08AJ, D06AX | M003 + M004 | HC Topical Antibiotics LS [1992-11-19] + HC Category IV: Antiseptic Skin Cleansers
18. Dry eyes -> ocular lubricant [carboxymethylcellulose Na; hypromellose; polyvinyl alcohol; PEG 400; glycerin] | S01XA20 | M018 | FDA M018 Ophthalmic (no HC LS — flag as FDA-sourced)
19. Hemorrhoids -> anorectal vasoconstrictor / protectant / anaesthetic [phenylephrine; pramoxine; witch hazel (hamamelis); zinc sulfate] | C05AX, C05AD | M015 | HC Anorectal Drug Products LS [1994-09-01]
20. Cold sores -> antiviral / protectant [docosanol 10%; benzocaine; petrolatum + sunscreen] | D06BB11 | M016 | FDA M016 Skin Protectant (no HC LS — flag as FDA-sourced)
21. Athlete's foot -> topical antifungal [tolnaftate; clotrimazole; miconazole nitrate; terbinafine; undecylenic acid] | D01AE, D01AC | M005 | HC Antifungals (topical) LS [1995-01-30] + HC Category IV: Athlete's Foot Treatments
22. Acne -> topical acne agent [benzoyl peroxide; salicylic acid; sulfur; adapalene] | D10AE01, D10AF | M006 | HC Category IV: Acne Therapy
(+ optional 23rd: Dandruff -> pyrithione zinc, ketoconazole, selenium sulfide, coal tar | D11AX12 | M032 | HC Category IV: Anti-Dandruff Products — it has 75 marketed Canadian products, more than half the list.)

=== 3. HOW TO BUILD IT (one build-time script, ~150 lines) ===
Step A. For each of the 22 symptoms, run the verified openFDA query with 3-6 phrase variants each (e.g. 'headache'; for fever use 'reduces fever' not 'fever' — bare 'fever' matches warning text), faceting count=openfda.generic_name.exact. Cache the JSON. This is ~100 requests, well inside the 1,000/day unauthenticated limit; get a free api_key anyway.
Step B. Split multi-ingredient generic_name strings on comma/'and', normalize salts (HCL/HBR/hydrochloride/sodium/maleate/nitrate → base), and keep any ingredient appearing in >=10 labels. This produces the candidate ingredient set.
Step C. A HUMAN reviews every row against the matching Health Canada Labelling Standard or Category IV Monograph and writes source_url. Drop anything not corroborated (this is what removes the homeopathic noise — Anamirta cocculus, Chelidonium majus, Arsenic trioxide, Tobacco leaf — and US-only ingredients). Budget: one afternoon for 22 symptoms.
Step D. Bulk-load DPD once (four full-dump calls, ~33 MB total): drugproduct, activeingredient, schedule, status, therapeuticclass. Filter schedule_name == 'NON-PRESCRIPTION DRUGS' AND schedule_name != 'HOMEOPATHIC' AND status IN ('Marketed','Approved').
Step E. Join symptom_ingredient.ingredient_name to product_ingredient.ingredient_name with a substring match (DPD uses forms like 'ACETAMINOPHEN', 'PSEUDOEPHEDRINE HYDROCHLORIDE'). QA gate: assert the matched product's DPD atc_code starts with the row's atc_prefix; log every mismatch for human review. This catches curation errors automatically.
Step F. Refresh monthly (DPD's own cadence) via CI, not from the phone.

=== 4. RANKING (satisfies FR2 'ascending by price' without dropping clinical sense) ===
Two-tier, never one flat price sort:
  Tier 1 — Branded anchor: within the symptom's rank=1 ingredient class, the highest-recognition brand (one product, top of screen, per FR1/FR4).
  Tier 2 — 'Alternatives': every product sharing that ingredient + strength + route (DPD ai_group_no is the exact equivalence key — it is Health Canada's own active-ingredient-group identifier and is far more reliable than string matching), sorted price ASCENDING.
  Tier 3 — 'Other options for this symptom': products from rank=2..n ingredient classes, collapsed under a separate header so a laxative-class switch is never presented as a price-equivalent swap.
Never let price sorting mix ingredient classes — showing a $3 antihistamine above a $9 decongestant for 'nasal congestion' is a clinical error dressed as a bargain. Sort within class; group across class.

=== 5. SAFETY INTERSTITIALS (three tiers, gate BEFORE the product list) ===
TIER 2 — HARD BLOCK, no products shown, full-screen: chest pain / pressure / tightness; difficulty breathing; sudden severe headache ('worst of my life') or headache with stiff neck/confusion/photophobia; sudden severe abdominal pain; coughing or vomiting blood; blood in stool or black stools; fainting; new one-sided weakness or slurred speech; suspected poisoning or overdose. Screen shows: 'These symptoms need urgent medical attention. Call 911 or go to an emergency department.' + Ontario Poison Centre 1-800-268-9017. No 'continue anyway' button.
TIER 1 — SOFT GATE, one tap to continue, shown as an accordion above results: infant/child under 6 for any cough/cold symptom (Health Canada 2008-12-18 decision — HARD block this one specifically for symptoms 6,7,8); pregnancy or breastfeeding; symptom duration past the monograph threshold, which you take verbatim from the label rather than inventing: pain >10 days, fever >3 days, antacid symptoms >2 weeks, diarrhea >2 days, cough >7 days, sudden bowel-habit change >2 weeks; age 65+; 'are you taking other medicines?'. Copy: 'A pharmacist can help with this — every pharmacy in your results has one.' This turns the safety gate into a feature that ties into the map screen (FR-map) rather than a nag.
TIER 0 — persistent footer on every symptom-search result: 'MediSense shows products whose approved Canadian label lists this symptom. It does not diagnose. Talk to a pharmacist or doctor before starting any medicine.' Plus, on the product detail tab 1, render the label's own do_not_use / ask_doctor / stop_use / pregnancy_or_breast_feeding text verbatim as accordions — do not paraphrase, do not summarize.

=== 6. THE LINE YOU MUST NOT CROSS ===
ALLOWED (this is display of drug labelling, Health Canada SaMD exclusion criteria 2+3): 'Products whose approved label lists "headache" as a use.' Result cards say 'Label lists: headache, muscular aches, fever.' The equivalency accordion cites the Health Canada Labelling Standard by title, date and URL.
FORBIDDEN: naming a condition the user did not type ('you may have a migraine', 'this looks like GERD'); ranking by 'effectiveness' or 'best for you'; personalizing on age/weight/history; a dose calculator (Apple guideline 1.4.2 requires manufacturer/hospital/university/regulator provenance); any free-text symptom box fed to an LLM that then infers a condition. Keep the input a CLOSED PICKER of the 22 symptoms plus synonym matching — a closed vocabulary is both the safety control and the reason the feature is buildable at all.
One-line framing to put in the report: the app is a product finder indexed by label text, not a symptom checker. That sentence is what keeps it out of medical-device territory.

=== FALLBACK PATH (if openFDA is unreachable or the curation budget vanishes) ===
Ship the 22-row table hand-written straight from the 23 Health Canada Labelling Standards + 8 Category IV Monographs — it is roughly 90 ingredient rows and needs no API at all. openFDA then adds only the evidence_label_count provenance column and the verbatim warning text, both of which degrade gracefully. The app still works fully offline against the bundled DPD extract; symptom search never needs a network call at runtime.

### Risks
- openFDA is US data. Ingredients differ across the border: oral phenylephrine is under FDA proposal for removal from M012 while it remains marketed in Canada; ranitidine is withdrawn; several US OTC ingredients (e.g. certain doses of naproxen, some antihistamines) have different Canadian schedules. Every openFDA-derived ingredient MUST be re-validated against DPD schedule_name == 'NON-PRESCRIPTION DRUGS' before it ships, or the app will show Canadians products they cannot buy.
- Only 2,840 DPD products are simultaneously 'Marketed' and 'NON-PRESCRIPTION DRUGS'. My cold-sore bucket returned ZERO and heartburn only 13 — several everyday Canadian OTC categories are licensed as Natural Health Products (NPN, in LNHPD) rather than DINs, so a DIN-only corpus will have visible holes. Mitigation: relax the status filter to include 'Approved', match on ai_group_no, and consider ingesting the LNHPD /productlicence/ + /medicinalingredient/ endpoints for the gap categories.
- RxClass may_treat is the obvious-looking answer and a future contributor will reach for it. Its Headache result contains octopamine, acetylcholine and belladonna alkaloids and omits acetaminophen entirely; its Cough result contains codeine and cocaine. If anyone wires it up live, the app ships clinically wrong and potentially harmful results. Write an explicit ADR banning runtime use of MEDRT may_treat.
- openFDA free-text phrase search is brittle in both directions. Bare 'fever' matches warning text ('fever gets worse or lasts more than 3 days') as often as indication text, inflating counts; conversely 'runny nose' misses labels that say 'rhinorrhea'. Each symptom needs several hand-tuned phrase variants and a human reviewing the facet output, or the frozen table encodes silent errors.
- Homeopathic and traditional products contaminate the openFDA facets (Anamirta cocculus seed and Tobacco Leaf under motion sickness; Arsenic trioxide under diarrhea; Chelidonium majus under nausea). DPD's HOMEOPATHIC schedule value (5,571 products) filters these cleanly on the Canadian side, but only if that filter is actually applied — forget it and the app recommends arsenic for diarrhea.
- openfda.application_number monograph values are dirty: stray 'M', 'M20', 'M334', 'M009.50', 'M505G(a)(3)'. Validate against the canonical M001–M032 list from the Federal Register or the monograph badge will show nonsense.
- canada.ca blocks automated fetching (403 / connection reset) for the individual Labelling Standard and Category IV monograph sub-pages, though the index pages are reachable. The per-symptom citations therefore have to be gathered by hand in a browser rather than scripted, and I could not verify the exact permitted indication wording for most individual standards — only the titles, dates and URLs.
- App Store review risk is real, not theoretical. Apple guideline 1.4.1 says medical apps 'that could be used for diagnosing or treating patients may be reviewed with greater scrutiny' and requires a reminder to check with a doctor. A free-text symptom box, an LLM-inferred condition, or a dose calculator (1.4.2, which demands manufacturer/hospital/university/regulator provenance) would each be a plausible rejection. The closed 22-symptom picker plus verbatim label text is the low-risk design.
- The DPD API publishes no rate limit, no terms and no API key requirement, and the four full-dump calls total ~33 MB. There is nothing stopping Health Canada from throttling or changing this without notice, and the documentation gives no SLA. Bulk-load at build time in CI and ship the extract with the app; never let the phone hit DPD directly.
- Health Canada's SaMD exclusion criteria are from a guidance document (and Health Canada explicitly says they 'should not be interpreted as a rigid set of exclusion factors'), not from the Regulations. For a course project this is fine; for anything shipped commercially it is a legal question, not an engineering one, and the four criteria are a design constraint rather than a safe harbour.
- I could not verify the exact wording of Health Canada's SaMD exclusion criteria from the primary canada.ca page (403 on every fetch attempt) — the four criteria are quoted from secondary reporting of that guidance. Confirm against the official page in a browser before citing it in the write-up.


## barcode-ocr

**Verdict:** FEASIBLE_WITH_SYNTHETIC_DATA — camera capture, on-device barcode decoding and on-device OCR are all free and production-ready in Expo SDK 57; but no free or paid API reliably maps a Canadian OTC barcode to a drug product, so the UPC→product mapping must live in our own seeded `product_barcodes` table.

### Summary
Barcode scanning (the camera capture) is trivially feasible and free; barcode *resolution* to a Canadian OTC drug is the thing that does not exist. I downloaded the entire Health Canada DPD packaging dataset (58,239 records) and confirmed the `upc` field is empty in 100% of rows — as is the 2017 bulk `package.txt` (4 junk values / 15,804). openFDA is the only free API with real barcode data (`openfda.upc`, 16,718 of 56,618 OTC products) but it is US-only: I confirmed a real Canadian Tylenol UPC returns NOT_FOUND there. UPCitemdb's keyless trial tier found 2 of 6 Canadian national-brand drug UPCs and 0 of 4 Shoppers "Life Brand" generic UPCs — i.e. 0% coverage of exactly the products MediSense's "Alternatives" section is about. The NDC→GTIN trick is real and I verified it arithmetically (3 + 10-digit NDC + GS1 check digit = 300450449108 = real Tylenol Extra Strength UPC), but Canada has no NDC so it never applies to a Canadian package. OCR, by contrast, is solidly feasible: `expo-mlkit-ocr@0.2.7` gives on-device ML Kit v2 text recognition in a dev build, with Google Cloud Vision (1,000 free units/month, API-key auth verified live) as the Expo Go fallback.

### Recommendation
BUILD THIS.

**Stack (Expo SDK 57 / expo 57.0.18 / React Native 0.86):**
- Barcode: `expo-camera@57.0.4` `<CameraView onBarcodeScanned={fn} barcodeScannerSettings={{barcodeTypes:['ean13','upc_a','upc_e','ean8','code128']}} />`. Works in Expo Go, on device, and on web. Do NOT use `expo-barcode-scanner` (removed in SDK 52).
- OCR: `expo-mlkit-ocr@0.2.7` (MIT) in an EAS dev build — `recognizeText(uri)` → `{text, blocks[{text, boundingBox, lines[{elements}]}]}`, plus `isSupported()`. Requires `expo-build-properties` with iOS `deploymentTarget: "16.0"`.
- OCR fallback that survives Expo Go: `POST https://vision.googleapis.com/v1/images:annotate?key=API_KEY` (API-key auth verified live). 1,000 units/month free.
- Fuzzy match: `fuse.js@7.5.0` client-side over the local catalog; `pg_trgm` server-side for the same query.

**Barcode resolution — 5-step chain, each step cheap:**
1. Local `product_barcodes(upc PRIMARY KEY, product_id, source, verified_at)` lookup. Normalize first: strip to digits, if 13 chars with leading `0` also try the 12-char form and vice-versa (openFDA stores 13-digit zero-padded; expo-camera on iOS already strips iOS's synthetic leading zero — see risks).
2. If the code is 12 digits starting with `3`: decode `ndc10 = code[1:11]`, query `https://api.fda.gov/drug/ndc.json?search=openfda.upc:"0<code>"` (note the zero-pad — searching the raw 12-digit form returns NOT_FOUND, I verified this). Use the returned `active_ingredients[].name` + `strength` to join into our Canadian catalog by ingredient, not by brand.
3. `https://api.upcitemdb.com/prod/trial/lookup?upc=<code>` — no key, 100/day. Take `items[0].title`/`brand`, fuzzy-match into our catalog. Expect ~20% hit rate on Canadian drugs.
4. Miss → auto-switch the same camera screen into OCR mode with the prompt "Point at the brand name" (this is the graceful degradation, and it keeps the 13.34s budget because no screen transition is needed).
5. Miss → manual search prefilled with whatever OCR produced, plus a "link this barcode to this product" affordance so the table self-heals as the app is used.

**Seeding the barcode table (the actual work, ~4-6 hours):**
- Shoppers Drug Mart product URLs embed the real 12-digit UPC as `variantCode`: `.../p/BB_062600142290?variantCode=062600142290` (Tylenol ES), `BB_057800974116` (Life Brand Acetaminophen 500mg). Prefix `062600` = Kenvue/McNeil Canada, `057800` = Loblaw/Shoppers Life Brand. Harvest these via search-result URLs — direct page fetches are Akamai-403'd (verified).
- Bulk-pull openFDA once: `search=product_type:"HUMAN OTC DRUG" AND _exists_:openfda.upc` (16,718 records) with a free API key for the 120,000/day limit, to cover US-labeled packages a Toronto student might actually be holding.
- For the demo, generate printable EAN-13/UPC-A labels for your ~50 seeded products with `bwip-js@4.11.4` or `jsbarcode@3.12.3` and tape them to real boxes. This makes the 13.34s usability number reproducible on stage without depending on a lookup API.

**OCR → drug name matching:**
Take the `blocks[]` sorted by `boundingBox.width * height` descending — the physically largest text block on an OTC box is almost always the brand name. Uppercase it, strip non-alphanumerics, then run Fuse.js with `{keys:['brand_name','generic_name','active_ingredient'], threshold:0.4, ignoreLocation:true, minMatchCharLength:3, includeScore:true}` (defaults are 0.6/false, which is too loose and too position-sensitive for OCR noise). Present the top 3 as a "Did you mean?" chip row rather than auto-navigating — a wrong auto-navigation on a medicine app is a safety problem, and the chip row costs ~1s. Server-side mirror: `SELECT ... WHERE brand_name % $1 ORDER BY similarity(brand_name,$1) DESC LIMIT 3` with `CREATE INDEX ON products USING GIN (brand_name gin_trgm_ops)` and `SET pg_trgm.similarity_threshold = 0.3`.

**Web build:** works with no extra effort. expo-camera 57 hard-depends on `barcode-detector@^3.0.0` (ZXing-wasm 3.1.3) and dynamically imports it whenever `globalThis.BarcodeDetector` is undefined, which covers iOS Safari, Firefox and Chrome-on-Windows where the native API is absent.

### Risks
- The core risk is honest scope: there is no barcode→Canadian-drug database, so the barcode feature is only as good as the table you seed. Demo it against products you seeded and it works in ~1s; point it at a random box from a Toronto pharmacy shelf and it will miss most of the time. Budget the seeding time and design the miss path as a first-class flow, not an error state.
- Canadian store-brand generics — the entire point of the 'Alternatives' section — have 0% coverage in every free barcode database I tested (0/4 in UPCitemdb, 0/5 in Open Food Facts). Paying for Go-UPC at $74.95/month would not fix this; those databases are built from US retail feeds.
- On-device OCR requires an EAS development build. That kills the Expo Go demo path for camera search unless you also wire the Google Cloud Vision fallback. Plan the build early — a first EAS iOS build plus the deploymentTarget 16.0 requirement is where this schedule usually slips.
- expo-camera's scanFromURLAsync only decodes QR on iOS. If the design doc's camera screen implies 'take a photo, then we read the barcode', that is impossible on iPhone. Barcode must be a live preview scan; only OCR can work from a captured still.
- The leading-zero handling on iOS UPC-A is subtle: AVFoundation adds one, expo-camera strips it, and a well-intentioned 'normalize by stripping leading zeros' in your own code will corrupt genuinely zero-prefixed UPCs like Life Brand's 057800 range. Test both 12- and 13-digit lookups against a real Life Brand box on a real iPhone before trusting the numbers.
- expo-camera has a history of the iOS barcode scanner silently not working when ZXingObjC fails to link (expo/expo#44491, SDK 55, worsened by expo-build-properties useFrameworks:"static"). It is fixed, but if you add any library that forces static frameworks, re-verify scanning on a physical iOS device rather than assuming.
- A Google Cloud Vision API key shipped in a React Native bundle is extractable. Restrict it to the Vision API and to your iOS bundle ID / Android package + SHA-1, or proxy it through your own backend. An unrestricted key found in a public repo can run up real charges past the 1,000 free units.
- openFDA's zero-padded 13-digit storage of openfda.upc is an easy silent-failure: querying the natural 12-digit form returns NOT_FOUND rather than an error, so the integration looks like 'no coverage' when it is actually a formatting bug.
- The NDC-in-GTIN decode has an expiry date. FDA's 12-digit NDC transition cannot be embedded in a GTIN-12/14 and moves the NDC into GS1 Application Identifier (75), which retail UPC-A symbols cannot carry. Treat the '3'-prefix decode as a bonus heuristic, never as the primary path.
- RxNav approximateTerm is excellent at typo tolerance but is built on RxNorm, a US vocabulary. Canadian-only brands and Canadian store brands will not resolve, and it can return a plausible-looking wrong US product — which is why OCR results should be presented as 'Did you mean?' options rather than auto-navigating on a medicine app.
- Exact USD pricing for UPCitemdb's DEV/PRO plans and Barcode Lookup's plans could not be retrieved (docs page omits prices; barcodelookup.com returns 403/404). If a paid tier ends up in the plan, get a real quote before committing.


## trust-safety

**Verdict:** FEASIBLE_FREE — every authoritative source needed is free, linkable, and reusable under OGL-Canada 2.0 / canada.ca non-commercial terms; the only thing that must NOT be built is the fabricated pharmacist credential, and replacing it with source attribution is strictly cheaper and strictly more usable.

### Summary
The "Pharmacist Verified" badge cannot ship as designed. Beyond the ethics, Ontario's Pharmacy Act, 1991, s. 10 restricts the title "pharmacist" and s. 12 makes contravention an offence punishable by a fine up to $25,000 (first offence), and the Open Government Licence – Canada 2.0 explicitly forbids using Health Canada data "in a way that suggests any official status or that the Information Provider endorses you." The fix is not to soften the badge — it is to swap the claim from WHO checked to WHAT WAS CHECKED, which is also the fix for the usability finding, because "Health Canada listed · DIN 01933531" is self-explanatory in a way "pharmacist verified" never was. Health Canada hands you the entire feature for free: every DPD product page carries an Active Ingredient Group (AIG) number and a "Same active ingredient group number" link, i.e. Health Canada's own canonical "here are the equivalents" query, deep-linkable per product and per group. The persuasive number for the equivalency panel is real and I have it verbatim from the governing guidance: Health Canada requires the 90% confidence interval of AUC_T to fall within 80.0%–125.0% and the relative mean Cmax within 80.0%–125.0% (note: Canada does NOT put a CI on Cmax — the FDA does; getting this wrong is the most common way this fact is misstated). One correction to the brief: HONcode was permanently discontinued on 15 December 2022 and healthonnet.org no longer resolves — do not design toward it.

### Recommendation
ADOPT THE HYBRID, BUT DROP THE WORD "PHARMACIST" FROM THE BADGE ENTIRELY.

Option (c) is right in spirit but must be executed as (a): the badge asserts a source, not a reviewer. Three reasons, in order of force: (1) legal — Pharmacy Act (Ontario) s. 10(2) "No person other than a member shall hold himself or herself out as a person who is qualified to practise in Ontario as a pharmacist", s. 12 fine up to $25,000; (2) licensing — OGL-Canada 2.0 non-endorsement clause forbids implying official status; (3) usability — the study participant literally could not define "pharmacist verified", and NN/g's finding is that third-party citations beat self-assertion. Option (b) ("clearly labelled sample data") is the fallback only if the team insists on the persona; it degrades the feature to decoration and users skim past "sample data" labels.

=== BADGE (replaces green check; also replaces the red octagon and satisfies the team's own fix list) ===
Two badges, both with a permanently visible text label (NN/g: "Icon labels should be visible at all times, without any interaction from the user"; do NOT put the label behind hover — it "fails to translate well on touch devices"). Shape, not colour, carries meaning (WCAG 2.2 SC 1.4.1). Minimum 24x24 CSS px tap target (SC 2.5.8) — this also fixes the map pins.

Badge A, on every product with a DIN:
  [doc-with-check glyph]  Health Canada listed · DIN 01933531
Badge B, on every alternative:
  [two-pills glyph]  Same ingredient + strength as Advil

=== TAB 2 COPY (verbatim, ship this) ===
Title: How we checked this

  MediSense is a student project. No pharmacist has reviewed this page, and we do not employ any.
  What we checked, automatically, against Health Canada's public records:

  ✓ Listed by Health Canada
    ADVIL CAPLETS is in the Drug Product Database with DIN 01933531. Status: Marketed.
    Schedule: non-prescription. [View the Health Canada record →]

  ✓ Same active ingredient and strength
    Health Canada puts this product in active ingredient group 0108883004 — the same group as
    Advil Caplets. Health Canada assigns this number to products that have "the same active
    ingredient(s) and ingredient strength(s)".
    [See every product Health Canada puts in this group →]

  ✓ Manufacturer's monograph on file
    Health Canada holds the product monograph, last updated 2025-05-22. [Open it (PDF) →]

  Checked 30 August 2026. Prices on this page are illustrative and are not from a pharmacy.

  ── Want an actual pharmacist? ──
  Every pharmacy in Ontario has one on duty. Talking to them is free and needs no appointment.
  [Find a pharmacy near me →]

=== RENAME THE FILTER ===
FR4's "pharmacist-verified only" becomes "Health Canada listed only" — honest, and it is a real filter (product has a DIN and current status Marketed). "Name-brand only" stays.

=== "WHAT IS A GENERIC?" BUTTON + ONBOARDING ===
Same copy pool as the equivalency accordion below, layered A→B→C. NHS: 4 in 10 adults struggle with public health content and 6 in 10 struggle with content containing numbers — so the 80–125% figure lives at layer C, never on the card.

=== ONE ACCURACY TRAP YOU MUST NOT WALK INTO ===
The AIG number proves same active ingredient at the same strength (±−2%/+10% strength tolerance). It does NOT mean Health Canada declared those two specific products bioequivalent to each other, and many OTC drugs are approved via a Category IV Monograph rather than an ANDS with a bioequivalence study at all. So write "same active ingredient at the same strength" as the product-specific claim, and present the 80–125% rule as general context on how Canada approves generics — never as "Health Canada found these two bioequivalent."

=== ONBOARDING/TOUR IMPLEMENTATION ===
Build the 5-step coach-mark tour in-house (~150 lines): ref + measureInWindow() → absolutely positioned overlay → four opaque Views forming a frame around the hole (zero deps, perfect for a B&W theme) or a react-native-svg <Mask>. Every third-party option is either stale or 0.x, and RN 0.82+ is New-Architecture-only so a stale library is a real risk. If a library is mandated: react-native-spotlight-tour 4.0.0 (MIT, repo pushed 2026-08-17) but spike open issue #202 first — "Tooltip not rendering on iOS with Expo 54 + New Architecture (Fabric)", open since 2026-01-06. Use @react-native-async-storage/async-storage 3.1.1 for the has-seen-onboarding flag.

### Risks
- THE AIG OVERCLAIM — the most likely way this feature becomes dishonest by accident. A shared Active Ingredient Group number proves same active ingredient at the same strength (with a stated −2%/+10% strength tolerance). It does NOT mean Health Canada declared those two specific products bioequivalent to one another. Worse, many OTC products are authorised via a Category IV Monograph rather than an ANDS with a comparative bioavailability study, so for some pairs no bioequivalence study exists at all. Copy must say "same active ingredient at the same strength" for the specific pair, and present the 80–125% rule as general context about how Canada approves generics. Writing "Health Canada confirmed these are bioequivalent" would replace one fabricated credential with another.
- The 80–125% asymmetry is easy to get wrong and a pharmacy-literate marker will catch it. In Canada only AUC_T carries the 90% confidence interval; Cmax is the relative mean (point estimate) within 80.0–125.0%. The FDA applies the 90% CI to both. If the app cites Health Canada while stating the FDA rule, the single most persuasive fact in the product becomes the single most embarrassing error. Cite one jurisdiction per sentence.
- Health Canada's best consumer-facing page ("The Safety and Effectiveness of Generic Drugs") was updated April 2012, with page details dated 2017-05-04. NN/g's research says experts specifically scan for dates and abandon content that looks stale. Show the source date in the citation rather than hiding it — an honestly dated 2012 government page beats an undated one — and lead with the 2018-revised bioequivalence guidance where recency matters.
- Deep-linking DPD by internal drug_code (e.g. code=13452) rather than by DIN couples the app to an undocumented internal identifier that Health Canada does not guarantee is stable. Store the DIN as the durable key, resolve drug_code at fetch time via /api/drug/drugproduct/?din=..., and treat a broken monograph PDF link as a caught error, not a rendered dead link — NN/g: "Typos, broken links, and other mistakes quickly degrade credibility."
- Legal exposure is small but not zero and it is asymmetric: I am not a lawyer, the Pharmacy Act s.10 provisions govern a person using the title rather than an app label, and no case law was found applying them to software. But the downside of shipping the fake badge (a regulatory complaint against a student, on a public portfolio) massively outweighs the cost of the alternative label — which is better UX anyway. Do not treat this as a judgment call to litigate.
- The dominant tour libraries are stale relative to a New-Architecture-only runtime. react-native-copilot (16k weekly downloads) has not been pushed since 2024-12-17 with 124 open issues; the best-maintained option, react-native-spotlight-tour, has an unresolved Fabric tooltip bug (#202) on iOS + Expo 54. The Fabric-native alternative, guideway, is 0.4.1 with 25 weekly downloads — an API that can break and a bus factor of roughly one. Budget for the hand-rolled overlay rather than discovering the bug at demo time.
- A guided tour is not a substitute for a self-explanatory interface and can mask the real defect. The study participant's complaint ("I don't know exactly what pharmacist-verified means") is a labelling failure; a tour that explains a bad label leaves the bad label in place for every session after the first. Fix the label first, then add the tour — and make it re-runnable from the info button, since users forget and there is no nav bar to rediscover it from.
- MedlinePlus drug monographs are ASHP-copyrighted and licensed for use on MedlinePlus only; A.D.A.M. encyclopedia content likewise. Scraping either into the app's "useful links" panel as text would be an infringement even though the surrounding MedlinePlus pages are public domain. Link out; never paste.
- Prices are the app's other honesty problem, and it is adjacent to mine: a fabricated price on a map pin is the same class of error as a fabricated credential, but with more direct consumer consequence. The "prices are illustrative" line must sit on the map and result screens where prices actually appear, not only in an About page nobody opens.
- The "pharmacist verified only" filter is specified in FR4 and a marker may check that it exists. Renaming it to "Health Canada listed only" preserves the mechanic and the demo, but flag the rename explicitly in the project write-up as a deliberate, reasoned deviation from the design document — otherwise it reads as an unimplemented requirement rather than an ethical correction.


---

# Part 2 — Verified findings



## drug-data


### DPD read-only API base URI, no auth, no API key, CORS wide open
*confidence: high*

Base: https://health-products.canada.ca/api/drug/ (French mirror: https://produits-sante.canada.ca/api/medicament/). Verified live response headers: `access-control-allow-origin: *`, `content-type: application/json; charset=utf-8`, `cache-control: no-cache`, server nginx. No Authorization header, no api_key param, no signup. Every request in my testing returned 200. Format via `?type=json|xml`, language via `?lang=en|fr`.

**Source:** https://health-products.canada.ca/api/documentation/dpd-documentation-en.html + live curl -D against https://health-products.canada.ca/api/drug/drugproduct/?lang=en&type=json&id=13766


### All 11 DPD endpoints and their exact JSON field names
*confidence: high*

/api/drug/drugproduct/ → drug_code, class_name, drug_identification_number, brand_name, descriptor, number_of_ais, ai_group_no, company_name, last_update_date. Params: id, din, brandname, status, lang, type.
/api/drug/activeingredient/ → dosage_unit, dosage_value, drug_code, ingredient_name, strength, strength_unit. Params: id, ingredientname, lang, type.
/api/drug/company/ → city_name, company_code, company_name, company_type, country_name, post_office_box, postal_code, province_name, street_name, suite_number. Params: id, lang, type.
/api/drug/form/ → drug_code, pharmaceutical_form_code, pharmaceutical_form_name. Params: id, active, lang, type.
/api/drug/route/ → drug_code, route_of_administration_code, route_of_administration_name. Params: id, active, lang, type.
/api/drug/schedule/ → drug_code, schedule_name. Params: id, active, lang, type.
/api/drug/status/ → drug_code, status, history_date, original_market_date, external_status_code, expiration_date, lot_number. Params: id, lang, type.
/api/drug/packaging/ → drug_code, upc, package_size_unit, package_type, package_size, product_information. Params: id, type (NO lang).
/api/drug/pharmaceuticalstd/ → drug_code, pharmaceutical_std. Params: id, type.
/api/drug/therapeuticclass/ → drug_code, tc_atc_number, tc_atc. Params: id, lang, type.
/api/drug/veterinaryspecies/ → drug_code, vet_species_name. Params: id, lang, type.

**Source:** https://health-products.canada.ca/api/documentation/dpd-documentation-en.html (fetched and parsed in full) + live verification of every endpoint against drug_code 13452


### drug_code is the universal join key across every DPD table
*confidence: high*

Every endpoint except /company/ takes `?id=<drug_code>` and returns rows keyed on drug_code. In the bulk extract the relationship diagram states 'All extract files are connected via the QRYM_DRUG_PRODUCT file.' drug_code is Oracle NUMBER(8). DIN (drug_identification_number, VARCHAR2(29), zero-padded 8 chars e.g. "01933531") is the public-facing identifier; drug_code is the internal PK. /company/ is the exception — it keys on company_code, and DPD does NOT expose company_code on the drugproduct object, only company_name as a denormalized string.

**Source:** https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-product-database/read-file-drug-product-database-data-extract.html + live endpoint testing


### ai_group_no is the equivalence key — the single most important field for this project
*confidence: high*

`ai_group_no` (VARCHAR2(10), documented only as 'The Active Ingredient Group Number') is assigned by Health Canada to the exact combination of active ingredient(s) + strength. Verified: ai_group_no=0108883004 contains 18 marketed human products — ADVIL CAPLETS/TABLETS/LIQUI-GELS/MINI-GELS (Haleon), MOTRIN 200MG + MOTRIN LIQUID GELS (Kenvue), APO-IBUPROFEN + IBUPROFEN + IBUPROFEN LIQUID GEL CAPSULES (Apotex), IBUPROFEN 200 MG (Jamp), IBUPROFEN TABLETS/CAPLETS 200 MG + IBUPROFEN LIQUID CAPSULES (Vita Health), IBUPROFEN TABLETS/CAPLETS/LIQUID GELS (Pharmascience), IBUPROFEN MINI LIQUID CAPSULES (Juno OTC). ai_group_no=0102009002 = acetaminophen 500 mg, 24 members incl. TYLENOL EXTRA STRENGTH + APO-ACETAMINOPHEN EXTRA STRENGTH + NOVO-GESIC FORTE. ai_group_no=0122686001 = cetirizine HCl 10 mg, 12 members incl. REACTINE + APO-CETIRIZINE + JAMP-CETIRIZINE + NAT-CETIRIZINE. NOTE the first 7 digits are a shared ingredient stem and the last 3 are the strength discriminator: 0108883001/002/003/004/005/007/008 are ibuprofen 300/400/600/200/100/40 mg etc.

**Source:** Computed from the DPD bulk extract drug.txt + ingred.txt (downloaded 2026-08-31, last-modified 2026-08-04); cross-checked live against https://health-products.canada.ca/api/drug/drugproduct/?brandname=advil&status=2


### CRITICAL LIMITATION: there is NO ai_group_no query parameter — the API silently ignores it
*confidence: high*

GET /api/drug/drugproduct/?lang=en&type=json&ai_group_no=0108883004 returns the FULL unfiltered product list starting at drug_code 225 (PLACIDYL). Unknown params are dropped, not rejected. Consequence: you CANNOT do the 'find equivalents' query over the live API in one call. You must either (a) seed a local index from the bulk extract — the recommended path — or (b) walk /activeingredient/?ingredientname=X (e.g. cetirizine → 68 rows with drug_code+strength+strength_unit), filter client-side on strength, then issue one /drugproduct/?id= + /schedule/?id= + /form/?id= per candidate. For ibuprofen that is 209 ingredient rows → ~330 follow-up calls. Unusable on mobile.

**Source:** Live test of https://health-products.canada.ca/api/drug/drugproduct/?lang=en&type=json&ai_group_no=0108883004


### OTC filter: the schedule value is "NON-PRESCRIPTION DRUGS", NOT "OTC" — the documentation is misleading
*confidence: high*

The API guide's prose lists a schedule called 'OTC (over the counter drugs that do not appear on a schedule or are not recommended to appear on any schedule)'. The actual value returned by both the live API and the bulk extract is `NON-PRESCRIPTION DRUGS`. Live: GET /api/drug/schedule/?lang=en&type=json&id=13452 → [{"drug_code":13452,"schedule_name":"NON-PRESCRIPTION DRUGS"}]. Full distinct value set from schedule.txt (13,952 rows): PRESCRIPTION 8967, NON-PRESCRIPTION DRUGS 2844, SCHEDULE D 867, ETHICAL 622, NARCOTICS (CDSA I) 283, TARGETED SUBSTANCES (CDSA IV) 100, CONTROLLED DRUGS (CDSA I) 96, SCHEDULE C 58, CONTROLLED DRUGS (CDSA III) 55, CONTROLLED DRUGS (CDSA IV) 43, NARCOTICS (CDSA II) 9, PRESCRIPTION RECOMMENDED 8. ALSO CONTRARY TO THE DOCS: zero marketed human products have no schedule row — every one of the 11,497 is scheduled, so 'unscheduled = OTC' is not a real case. ETHICAL (622) means non-prescription but professional-use-only (MRI contrast, hemodialysis solutions, nitroglycerine) — EXCLUDE it from a consumer OTC app.

**Source:** Live https://health-products.canada.ca/api/drug/schedule/?lang=en&type=json&id=13452 + computed over dpd/schedule.txt from allfiles.zip


### Exact filter to the OTC universe, with counts
*confidence: high*

class_name == "Human" (excludes Veterinary/Disinfectant/Radiopharmaceutical) AND current status == MARKETED AND schedule_name == "NON-PRESCRIPTION DRUGS". Counts from the 2026-08-04 extract: 13,384 rows in drug.txt (marketed file) → 11,497 Human → 1,589 Human OTC. Of those 1,589: 746 single-ingredient, 843 combination products; 147 distinct active-ingredient names; 1,587 carry an ATC code. Status API param values: 1=Approved, 2=Marketed, 3=Cancelled Pre Market, 4=Cancelled Post Market, 6=Dormant, 9=Cancelled (Unreturned Annual), 10=Cancelled (Safety Issue), 11=Authorized By Interim Order, 12=Authorization By Interim Order Revoked, 13=Restricted Access, 14=Authorization By Interim Order Expired, 15=Cancelled (Transitioned to Biocides). `?status=2` DOES work on /drugproduct/ (brandname=advil returns 48 rows unfiltered, 25 with status=2).

**Source:** Computed over dpd/drug.txt+schedule.txt+status.txt; status codes from https://health-products.canada.ca/api/documentation/dpd-documentation-en.html; status=2 verified live


### WARNING: the OTC set is dominated by sunscreens, not medicines
*confidence: high*

Top active ingredients among the 1,589 human OTC products: OCTISALATE 430, AVOBENZONE 416, OCTOCRYLENE 397, HOMOSALATE 359, then ACETAMINOPHEN 227, DEXTROMETHORPHAN HBr 133, PSEUDOEPHEDRINE HCl 105, OCTINOXATE 102, DIPHENHYDRAMINE HCl 80, PYRITHIONE ZINC 68, IBUPROFEN 66, GUAIFENESIN 66. Roughly half the 'OTC' rows are sunscreens and anti-dandruff shampoos. For a medicine-finder demo you should exclude ATC classes D02/D11/D01AE (dermatologicals) or whitelist by ATC prefix (N02 analgesics, R06 antihistamines, R05 cough/cold, A02 antacids, A07 antidiarrheals, M01/M02 NSAIDs, A03/A04 antiemetics).

**Source:** Computed over dpd/ingred.txt + ther.txt for the OTC subset


### DPD bulk extract: exact URLs, sizes, licence
*confidence: high*

ALL FILES (marketed only): https://www.canada.ca/content/dam/hc-sc/documents/services/drug-product-database/allfiles.zip — verified 200, content-type application/zip, last-modified Tue 04 Aug 2026 15:38:38 GMT, 1,500,321 bytes. Variants: allfiles_ap.zip (approved), allfiles_ia.zip (cancelled/inactive), allfiles_dr.zip (dormant), same directory. Contents (12 UTF-8 quoted-CSV files, no header row, ~12 MB uncompressed): drug.txt 13,384 rows, ingred.txt 19,479, schedule.txt 13,952, status.txt 49,298, form.txt 13,669, route.txt 15,955, comp.txt 13,384, ther.txt 13,206, package.txt 7,764, pharm.txt, vet.txt, biosimilar.txt. Per-table zips also exist: drug.zip, ingred.zip, schedule.zip, status.zip, form.zip, route.zip, package.zip, comp.zip, ther.zip, pharm.zip, vet.zip, biosimilar.zip, inactive.zip — each with _ap/_ia/_dr variants, same /content/dam/hc-sc/documents/services/drug-product-database/ path. Licence: Open Government Licence – Canada. Index page: https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-product-database/what-data-extract-drug-product-database.html

**Source:** https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-product-database/what-data-extract-drug-product-database.html + curl -I and actual download + https://open.canada.ca/data/en/dataset/bf55e42a-63cb-4556-bfd8-44f26e5a36fe (Licence: Open Government Licence - Canada)


### Bulk extract column order (files have NO header row) — you need this to parse
*confidence: high*

drug.txt (QRYM_DRUG_PRODUCT): DRUG_CODE, PRODUCT_CATEGORIZATION, CLASS, DRUG_IDENTIFICATION_NUMBER, BRAND_NAME, DESCRIPTOR, PEDIATRIC_FLAG, ACCESSION_NUMBER, NUMBER_OF_AIS, LAST_UPDATE_DATE, AI_GROUP_NO, CLASS_F, BRAND_NAME_F, DESCRIPTOR_F.
ingred.txt (QRYM_ACTIVE_INGREDIENTS): DRUG_CODE, ACTIVE_INGREDIENT_CODE, INGREDIENT, INGREDIENT_SUPPLIED_IND, STRENGTH, STRENGTH_UNIT, STRENGTH_TYPE, DOSAGE_VALUE, BASE, DOSAGE_UNIT, NOTES, INGREDIENT_F, STRENGTH_UNIT_F, STRENGTH_TYPE_F, DOSAGE_UNIT_F.
schedule.txt: DRUG_CODE, SCHEDULE, SCHEDULE_F.
status.txt: DRUG_CODE, CURRENT_STATUS_FLAG, STATUS, HISTORY_DATE, STATUS_F, LOT_NUMBER, EXPIRATION_DATE — this is a HISTORY table (49,298 rows for 13,384 drugs); you MUST filter CURRENT_STATUS_FLAG='Y' to get the one live status.
form.txt: DRUG_CODE, PHARM_FORM_CODE, PHARMACEUTICAL_FORM, PHARMACEUTICAL_FORM_F.
route.txt: DRUG_CODE, ROUTE_OF_ADMINISTRATION_CODE, ROUTE_OF_ADMINISTRATION, ROUTE_OF_ADMINISTRATION_F.
comp.txt: DRUG_CODE, MFR_CODE, COMPANY_CODE, COMPANY_NAME, COMPANY_TYPE, ADDRESS_MAILING_FLAG, ADDRESS_BILLING_FLAG, ADDRESS_NOTIFICATION_FLAG, ADDRESS_OTHER, SUITE_NUMBER, STREET_NAME, CITY_NAME, PROVINCE, COUNTRY, POSTAL_CODE, POST_OFFICE_BOX, PROVINCE_F, COUNTRY_F — filter COMPANY_TYPE='DIN_OWNER'.
ther.txt: DRUG_CODE, TC_ATC_NUMBER, TC_ATC, TC_AHFS_NUMBER, TC_AHFS, TC_ATC_F, TC_AHFS_F.
package.txt: DRUG_CODE, UPC, PACKAGE_SIZE_UNIT, PACKAGE_TYPE, PACKAGE_SIZE, PRODUCT_INFORMATION, PACKAGE_SIZE_UNIT_F, PACKAGE_TYPE_F.

**Source:** https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-product-database/read-file-drug-product-database-data-extract.html + verified against the actual downloaded files


### CRITICAL: DPD has NO brand-vs-generic flag. There is no field, anywhere
*confidence: high*

drug.txt/drugproduct exposes only brand_name, company_name, class_name, descriptor, ai_group_no, number_of_ais. Nothing distinguishes an innovator brand from a generic. I tested the obvious heuristic (brand_name contains its own INN ingredient name, OR brand_name starts with a manufacturer prefix: APO-, TEVA-, PMS-, PMSC-, JAMP, RIVA-, SANDOZ, MINT-, AURO-, MAR-, NAT-, TARO-, MYL-, SIVEM, PDP-, ODAN, ACH-, AG-, GLN-). It classifies only 215 of 1,589 OTC products as generic. It misses every private-label OTC trade name — ALLERGY FORMULA (Vita Health), 24 HOUR ALLERGY REMEDY, ALLERTIN, SLEEP-EZE, ZZZQUIL, TRAVEL TABS, ANTI-NAUSEANT, DIARRHEA RELIEF, ACID CONTROLLER, TAMINOL, ASAPHEN, ENTROPHEN, RIVASA — all of which are exactly the 'cheaper alternative' the app is supposed to surface. Only 49 ai_group_no groups have both a heuristic-brand and a heuristic-generic. This heuristic is NOT good enough; use the NOC database instead (next finding).

**Source:** Computed over the 1,589-product OTC subset of the DPD extract


### SOLUTION — Health Canada Notice of Compliance (NOC) API gives the AUTHORITATIVE brand→generic link
*confidence: high*

Base URI: https://health-products.canada.ca/api/notice-of-compliance/ . Endpoints: /noticeofcompliancemain/, /drugproduct/, /medicinalingredient/, /dosageform/, /route/, /product/, /vetspecies/ — each with ?id=, ?lang=en|fr, ?type=json|xml.
/drugproduct/ fields: noc_number, noc_br_brand_id, noc_br_brandname, noc_br_din, noc_br_product_id. This maps DIN → noc_number.
/noticeofcompliancemain/ fields: noc_number, noc_date, noc_manufacturer_name, noc_status_with_conditions, noc_on_submission_type, noc_is_suppliment, noc_submission_class, noc_is_admin, noc_product_type, noc_crp_product_name, noc_crp_company_name, noc_crp_country_name, noc_active_status, noc_reason_supplement, noc_reason_submission, noc_therapeutic_class, noc_last_update_date.
The two decisive fields: noc_on_submission_type == "Abbreviated New Drug Submission (ANDS)" means Health Canada certified this product as a GENERIC; noc_crp_product_name is the Canadian Reference Product — the branded drug it demonstrated bioequivalence to. noc_product_type == "Nonprescription Pharmaceutical" is an independent OTC filter.
Verified examples: noc_number 2374 → APOTEX / ANDS / Nonprescription / noc_crp_product_name="CLARITIN", noc_crp_company_name="SCHERING CANADA INC.". noc_number 7595 → VITA HEALTH PRODUCTS / ANDS / Nonprescription / CRP="ADVIL", CRP company="WHITEHALL-ROBINS INC.". noc_number 9753 → PENDOPHARM / ANDS / CRP="MOTRIN", CRP company="MCNEIL CONSUMER HEALTHCARE".

**Source:** https://health-products.canada.ca/api/documentation/noc-documentation-en.html + live calls to /noticeofcompliancemain/?lang=en&type=json&id={2374,7595,9753,12286,16852,24445}


### NOC dataset size and OTC coverage — and its two query limitations
*confidence: high*

Full dumps (omit ?id= to get everything, no pagination): /drugproduct/?lang=en&type=json → 77,626 rows / 9,952,950 bytes. /noticeofcompliancemain/?lang=en&type=json → 37,868 rows / 22,963,882 bytes / 28.7 s wall time. noc_product_type distribution: Prescription Pharmaceutical 28,221; Biologic 4,546; Veterinary 2,947; Nonprescription Pharmaceutical 1,825; Radiopharmaceutical 329. Of the 1,825 OTC NOC records: NDS 668, SNDS 564, SANDS 317, ANDS 276; 563 carry a non-empty noc_crp_product_name spanning 160 distinct reference brands. Most-referenced OTC CRPs: REACTINE 49, ASPIRIN 81 MG 28, ZANTAC 27, ROBAX PLATINUM 21, DIFLUCAN ONE 21, CLARITIN 16, AERIUS 16, ALEVE 14, PLAN B 10, ADVIL LIQUI-GELS 9, MOTRIN 8, MAXIMUM STRENGTH PEPCID AC 7. LIMITATION 1: /drugproduct/ ignores both ?din= and ?brandname= — I passed din=02439689 and got the full 77k-row dump back. Only ?id= (= noc_number) filters. LIMITATION 2: noc_crp_product_name is FREE TEXT and inconsistent — 'ASPIRIN 81 MG' vs 'ASPIRIN 81MG', 'ADVIL LIQUI-GELS, ADVIL EXTRA STRENGTH LIQUI-GELS', 'ADVIL IBOPROFEN TABLETS' (typo in the source). It requires normalization (uppercase, strip strength/dosage-form suffixes, split on comma/slash, fuzzy-match to a DPD brand_name).

**Source:** Live full-dump downloads of both NOC endpoints on 2026-08-31, then computed


### DPD has NO barcodes any more — UPC was removed May 1, 2025
*confidence: high*

The packaging documentation states verbatim: 'upc — The Universal Product Code. As of May 1, 2025, UPC values have been removed from the packaging file' and 'package_size / package_size_unit / package_type — As of May 1, 2025 this information will now appear in the product_information field.' Confirmed empirically: 0 of 7,764 rows in package.txt (marketed) and 0 rows in package_ia.txt (cancelled) contain any digit in the UPC column. Live check: /api/drug/packaging/?type=json&id=103945 → {"drug_code":103945,"upc":"","package_size_unit":"","package_type":"","package_size":"","product_information":""}. Consequence for FR4: DPD cannot resolve a scanned Canadian barcode. Note also that the doc's sample product_information value ('Pharmachoice [100 Capsule Bottle]/Rexall [100 Capsule Bottle]') suggested retailer names live in that field — in the current extract they do not; the 7,764 non-empty values are almost entirely bare package sizes like "100/500", "500ML", "25ML". Zero occurrences of LIFE BRAND, PERSONNELLE, KIRKLAND, NO NAME, EXACT, REXALL, PHARMACHOICE, COMPLIMENTS, EQUATE.

**Source:** https://health-products.canada.ca/api/documentation/dpd-documentation-en.html (Packaging section) + string scan over dpd/package.txt and package_ia.zip + live /packaging/ call


### DPD rate limits: none documented, none observed
*confidence: medium*

Neither the API guide nor the GC API Store listing states a rate limit, quota, or throttle. Empirical burst test: 30 sequential GETs to /api/drug/drugproduct/?id=13400..13429 → all HTTP 200, 19.7 s total (~1.5 req/s, ~0.65 s median latency). No 429, no Retry-After, no X-RateLimit-* headers on any response. This is NOT proof of an unlimited API — treat it as undocumented and be polite. The bulk extract exists precisely so you don't hammer the API.

**Source:** Live burst test against https://health-products.canada.ca/api/drug/drugproduct/ on 2026-08-31 + absence of any limit statement in the API guide


### DPD deep-link URL for the 'authoritative reference links' in the pharmacist-verification tab
*confidence: high*

https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code={drug_code} — verified HTTP 200 for code=13452 (Advil Caplets). Use `lang=fra` for French. This is the public Health Canada product page and is the correct citation to put behind the green checkmark, alongside https://health-products.canada.ca/api/documentation/dpd-documentation-en.html and the ANDS/CRP record.

**Source:** Live HEAD/GET against https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=13452


### openFDA endpoints, rate limits, licence, and the fields you actually want
*confidence: high*

Base https://api.fda.gov. /drug/ndc.json fields: product_ndc, generic_name, brand_name, brand_name_base, labeler_name, active_ingredients[{name,strength}], packaging[{package_ndc,description,marketing_start_date,sample}], dosage_form, route[], product_type, marketing_category, application_number, finished, listing_expiration_date, spl_id, openfda{rxcui[], unii[], upc[], spl_set_id[], manufacturer_name[], is_original_packager[], pharm_class_epc/moa/cs[], nui[]}. /drug/label.json section fields (OTC Drug Facts): purpose, indications_and_usage, active_ingredient, inactive_ingredient, warnings, do_not_use, ask_doctor, ask_doctor_or_pharmacist, when_using, stop_use, pregnancy_or_breast_feeding, keep_out_of_reach_of_children, dosage_and_administration, package_label_principal_display_panel, spl_product_data_elements, effective_time, set_id, version, id, plus an openfda block.
RATE LIMITS (verbatim from the docs): without a key '240 requests per minute, per IP address. 1,000 requests per day, per IP address'; with a free key '240 requests per minute, per key. 120,000 requests per day, per key'. 'The key is free of charge.' Pass as &api_key=. CORS: access-control-allow-origin: * (verified live). Licence: CC0 1.0 Universal public domain, no attribution required.
SCALE: search=product_type:"HUMAN OTC DRUG" → 56,618 records; of those, 16,718 have openfda.upc (29.5%) — a usable US barcode source. marketing_category is the brand/generic flag DPD lacks: for OTC ibuprofen, ANDA 908 (generic), NDA 72 (brand), OTC MONOGRAPH DRUG 15. Data last_updated 2026-08-28.

**Source:** Live api.fda.gov queries + https://open.fda.gov/apis/authentication/ + https://open.fda.gov/license/


### RxNorm / RxNav can map brand→generic but is US-only and misses Canadian brands
*confidence: high*

Base https://rxnav.nlm.nih.gov/REST/. Free, NO API key. Rate limit: 'no more than 20 requests per second' per IP. NLM recommends caching results 12–24 h. Attribution string required: 'This product uses publicly available data from the U.S. National Library of Medicine (NLM)... NLM is not responsible for the product and does not endorse or recommend this or any other product.'
Brand→generic mechanics, verified live: GET /REST/rxcui.json?name=Advil → 153010 (BN). GET /REST/drugs.json?name=Advil → conceptGroup tty=SBD with 6 members incl. rxcui 153008 'ibuprofen 200 MG Oral Tablet [Advil]'. GET /REST/rxcui/153008/related.json?tty=SCD → rxcui 310965 'ibuprofen 200 MG Oral Tablet'. Equivalently /REST/rxcui/153008/related.json?rela=tradename_of → the same SCD. Term types: SBD = branded drug (ingredient+strength+form+brand), SCD = clinical drug (the generic), BN = brand name, IN/PIN = ingredient, GPCK/BPCK = generic/branded packs. Relations: has_tradename (SCD→SBD), tradename_of (SBD→SCD), consists_of (SCD→SCDC components), contains (packs).
CANADIAN COVERAGE GAP, verified: /REST/rxcui.json?name=Reactine → {"idGroup":{}} (nothing). Buckley's → nothing. Tylenol 202433, Claritin 203576, Benadryl 203457, Polysporin 54955 do resolve. RxNorm covers US OTC well (it ingests the FDA SPL/NDC feed) but has no notion of a DIN, no Canadian pricing, no Canadian schedule, and no Canadian-only brands. Do NOT use it as the primary source for a Toronto app.

**Source:** Live rxnav.nlm.nih.gov calls + https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html


### Many familiar Canadian 'OTC' products are NOT in DPD at all — they are Natural Health Products
*confidence: high*

Zero hits in the marketed human OTC set for: METAMUCIL, NICORETTE, HALLS, MELATONIN, ZANTAC (withdrawn 2019–20 over NDMA; its successor is famotidine/Pepcid AC), ZYRTEC (the Canadian name is Reactine). TUMS returns only 1 DIN (TUMS CHEWY BITES WITH GAS RELIEF); plain Tums calcium carbonate is an NHP. These live in the Licensed Natural Health Products Database (LNHPD), base URI https://health-products.canada.ca/api/natural-licences/ with endpoints /productlicence/, /medicinalingredient/, /nonmedicinalingredient/, /ingredientsource/, /ingredientsubmission/, /productdose/, /productpurpose/, /productrisk/, /productroute/. IMPORTANT LIMITATION: /productlicence/ accepts only ?id= (licence number), ?lang=, ?type= — there is NO brandname search parameter (I confirmed ?brandname=metamucil returns empty). NHP products carry an NPN, not a DIN. Scope your app to DIN-bearing drugs and say so, or accept an empty-state for NHP searches.

**Source:** Search over the DPD OTC subset + https://health-products.canada.ca/api/documentation/lnhpd-documentation-en.html + live /api/natural-licences/productlicence/ test


### Store brands (Life Brand, Personnelle, Kirkland, no name, Exact) do NOT exist in any Health Canada dataset
*confidence: high*

The DIN owner recorded in DPD is the contract manufacturer, never the retailer. The real manufacturers behind Canadian private-label OTC are, verified from comp.txt: VITA HEALTH PRODUCTS INC (80 OTC DINs), PHARMASCIENCE INC (36), JAMP PHARMA CORPORATION (29), JUNO OTC INC (28), APOTEX INC (26), LNK INTERNATIONAL INC., SIGMA LIFE SCIENCES INC., ANGITA PHARMA INC., GUARDIAN DRUG COMPANY INC, CELLCHEM PHARMACEUTICALS INC., LABORATOIRES TRIANON INC., LABORATOIRE RIVA INC., CRLS, GRANULES INDIA LIMITED, PERRIGO INTERNATIONAL. Top OTC DIN owners overall: KENVUE CANADA INC. 153, PROCTER & GAMBLE INC 114, HALEON CANADA ULC 84, VITA HEALTH 80, BAYER INC 53. The retailer label on the shelf (Life Brand = Shoppers Drug Mart, Personnelle = Jean Coutu/Uniprix, Exact = Pharmasave/Rexall, no name = Loblaw, Kirkland = Costco) is a commercial packaging relationship that Health Canada does not publish. This mapping MUST be hand-curated or synthesized for the demo.

**Source:** Computed over dpd/comp.txt for the OTC subset + null result of the store-brand string scan over package.txt


### Equivalence pitfalls found in real data
*confidence: high*

1) STRENGTH UNITS are heterogeneous: MG, MCG, UNIT, % (Voltaren = DICLOFENAC DIETHYLAMINE 1.16 %; Polysporin = POLYMYXIN B 10000 UNIT). Never compare strengths numerically across units.
2) SALT FORMS are embedded in parentheses in ingredient_name: 'ESOMEPRAZOLE (ESOMEPRAZOLE MAGNESIUM TRIHYDRATE)', 'POLYMYXIN B (POLYMYXIN B SULFATE)', 'MOLYBDENUM (MOLYBDENUM PROTEINATE)'. Per the docs the strength refers to the ACTIVE MOIETY, not the salt. Strip the parenthetical to get the INN; ai_group_no already handles this correctly.
3) COMBINATION PRODUCTS are the majority: 843 of 1,589 OTC products have 2+ actives. ai_group_no handles them (Advil Cold and Sinus = 0222394001, pseudoephedrine 30 + ibuprofen 200), but the ingredient array order is NOT stable — sort before comparing.
4) A GROUP CAN MIX Rx AND OTC. ai_group_no 0145162001 (esomeprazole 20 mg) contains NEXIUM 24HR (NON-PRESCRIPTION, Haleon) alongside NEXIUM-20MG, APO-ESOMEPRAZOLE, TEVA-ESOMEPRAZOLE and 9 more that are all PRESCRIPTION. You MUST re-filter members by schedule, or you will show a prescription drug as an OTC 'alternative'. Same trap in ai_group_no 0118722003 (famotidine 10 mg): PEPCID AC is OTC, the two FAMOTIDINE OMEGA solutions are Rx.
5) DOSAGE FORM VARIES WITHIN A GROUP. ai_group_no 0102009001 (acetaminophen 325 mg) contains ACET 325 as a SUPPOSITORY next to 15 oral tablets. Group by ai_group_no but display/filter by pharmaceutical_form_name and route_of_administration_name — the spec's 'equivalent' promise breaks if you offer a suppository as an alternative to a caplet.
6) SINGLETON GROUPS ARE COMMON: 367 of 639 OTC groups have exactly one member. REACTINE 5 mg (0122686002), NEXIUM 24HR, POLYSPORIN ANTIBIOTIC OINTMENT and VOLTAREN EMULGEL all have no cross-company alternative. Design a real 'no generic alternative exists' empty state — do not assume every product has one.
7) FRENCH/ACCENTED brand names appear in the English feed: 'ACÉTAMINOPHÈNE CAPLET 500' (Riva), 'PRO-AAS EC - 80'. Normalize with NFD + diacritic strip for search.
8) BRAND CROSS-REFERENCES: Motrin and Advil share ai_group_no 0108883004, so a naive 'top result = brand, rest = generics' will list Motrin (also a brand) under Alternatives. Rank by an innovator whitelist, not by position.

**Source:** All computed directly from the 2026-08-04 DPD extract joins


### Explicitly unverified
- The exact semantics Health Canada uses to assign ai_group_no are not documented anywhere I could find — the API guide defines it only as 'The Active Ingredient Group Number'. My conclusion that it encodes ingredient-set + strength (with the first ~7 digits as an ingredient stem and the last 3 as a strength discriminator) is inferred from consistent behaviour across ibuprofen, acetaminophen, cetirizine, loratadine, ASA, diphenhydramine, dimenhydrinate, loperamide, naproxen and bismuth subsalicylate groups. It is empirically solid but not officially specified, so an edge case could behave differently.
- Whether DPD enforces any rate limit above the ~1.5 req/s I tested. 30 requests is a small sample; I did not attempt a high-concurrency burst.
- The canonical DPD Terms and Conditions page. The extract page links to https://healthycanadians.gc.ca/important-eng.php#a6 which I did not fetch; the direct .../drug-product-database/terms-conditions.html URL returns 404. The Open Government Licence – Canada designation comes from the open.canada.ca dataset record for the DPD, which I did verify.
- The complete enumeration of class_name values. I confirmed 'Human' in the data and the docs mention veterinary, disinfectant and radiopharmaceutical (Schedule C) products, but I did not enumerate the exact string values for the non-human classes.
- Whether the DPD extract is regenerated on a fixed schedule. Files were last-modified 2026-08-04 and the page footer shows the same date, suggesting monthly, but no refresh cadence is stated.
- The full LNHPD product licence field list and whether an LNHPD bulk extract exists — I confirmed the base URI and the nine endpoint names and that productlicence has no brandname parameter, but did not download or profile the dataset.
- Real Canadian retail prices for any of the 15 seed products, and the actual retailer↔manufacturer private-label relationships (whether Life Brand ibuprofen is in fact made by Vita Health rather than another contract manufacturer). These are commercial facts I could not verify from any public source.
- openFDA label coverage for the specific Canadian brands in the seed list — I verified the field structure against an Advil query but did not confirm that every one of the 15 seed ingredients returns a usable OTC label.


## mobile-stack


### Expo SDK 57 is the current stable SDK: React Native 0.86.3, React 19.2.3
*confidence: high*

npm dist-tag `latest` for `expo` = 57.0.18 (published 2026-08-28). SDK 57 released 2026-06-30. bundledNativeModules.json for expo@57.0.18 pins: react-native 0.86.3, react 19.2.3, react-dom 19.2.3, react-native-web ~0.21.0. CRITICAL: use expo@57.0.17 or later — 57.0.9 fixed a Hermes V1 memory regression that drastically increased memory in apps importing react-native-worklets/reanimated (expo/expo#46519), and 57.0.17 (RN 0.86.3) fixed a dev-mode startup-time regression (expo/expo#48298). Init command: `npx create-expo-app@latest my-app --template default@sdk-57`

**Source:** https://registry.npmjs.org/expo (dist-tags + bundledNativeModules.json from tarball), https://expo.dev/changelog/sdk-57


### Release cadence changed in 2026 to interleaved non-breaking releases
*confidence: high*

SDK 55 = 2026-02-25 (RN 0.83), SDK 56 = 2026-05-20 (RN 0.85), SDK 57 = 2026-06-30 (RN 0.86). Expo historically shipped 3 majors/year; SDK 57 is an experiment in shipping RN's ~every-second non-breaking release almost immediately as an optional `npx expo install expo@latest --fix` upgrade. SDK maintenance window stays ~1 year (SDK 54 gets critical fixes until the Sept/Oct 2026 release). SDK 58 canaries already exist (58.0.0-canary-20260812).

**Source:** https://expo.dev/changelog/sdk-57 + npm publish timestamps


### BLOCKER FOR iPHONE TESTING: App Store Expo Go is stuck on SDK 54
*confidence: high*

Expo changelog 2026-05-04: 'As of May 4th, a version of Expo Go for SDK 55 is still waiting for approval on the Apple App Store... we cannot provide a timeline. In the meantime, Expo Go for SDK 54 will continue to be available on both the App Store and Play Store.' The SDK 57 changelog (2026-06-30) repeats: 'We'd like to release a new version for SDK 57, but we're still waiting on approval.' Workarounds: `eas go` builds your own Expo Go to TestFlight but REQUIRES a paid Apple Developer Program membership; the TestFlight External Beta group is at capacity. Expo Go for SDK 57 IS available via Expo CLI for Android devices, Android emulators, and the iOS Simulator. No newer changelog entry exists on this topic (latest changelog entries: Aug 20, Aug 13, Jul 20 2026).

**Source:** https://expo.dev/changelog/expo-go-and-app-store-may-2026, https://expo.dev/changelog/sdk-57, https://expo.dev/changelog


### EVERY package MediSense needs runs in Expo Go — no development build required
*confidence: high*

Expo docs frontmatter `platforms` arrays (which list 'expo-go' when bundled): expo-camera ['android*','ios*','web','expo-go']; expo-location ['android','ios','web','expo-go']; expo-clipboard ['android','ios','web','expo-go']; expo-image ['android','ios','tvos','web','expo-go']; expo-sqlite ['android','ios','macos','tvos','web','expo-go']; react-native-maps ['android','ios','expo-go'] with explicit `inExpoGo: true`. Reanimated/worklets/gesture-handler/safe-area-context/screens are bundled in Expo Go by definition. NativeWind v4 is babel+metro only (no native module). CONTRAST — these force a development build: expo-maps (platforms ['ios','android'], no expo-go), react-native-mmkv (native module), react-native-unistyles v3 (peer-depends on react-native-nitro-modules), and any on-device OCR module.

**Source:** https://raw.githubusercontent.com/expo/expo/main/docs/pages/versions/unversioned/sdk/{camera,location,clipboard,image,sqlite,maps,map-view}.mdx


### Use react-native-maps, NOT expo-maps — expo-maps cannot render price labels on markers
*confidence: high*

The design requires white markers WITH THE PRICE shown on the marker. expo-maps takes markers as a data array where `GoogleMaps.Marker.icon` / `AppleMaps.Annotation.icon` 'expects an image reference, such as the value returned by the useImage hook from expo-image. It does not accept an image source directly' — no arbitrary React children. react-native-maps `<Marker>` accepts arbitrary React children (a `<View><Text>$8.99</Text></View>`), which is exactly what's needed. Additional expo-maps constraints: alpha status, not in Expo Go, iOS 17+ minimum (iOS 18+ for marker tap callbacks), and Apple Maps ONLY on iOS ('While Google provides a Google Maps SDK for iOS, Expo Maps supports it exclusively on Android').

**Source:** https://raw.githubusercontent.com/expo/expo/main/docs/pages/versions/unversioned/sdk/maps.mdx


### react-native-maps renders NOTHING on web — the map tab needs a .web.tsx implementation
*confidence: high*

src/MapView.web.ts in react-native-maps master is literally two lines: `export {default} from 'react-native-web/dist/modules/UnimplementedView';`. So on `expo export -p web`, the map tab is a blank box unless you write a platform-specific `MapTab.web.tsx` (Google Maps JS API, Leaflet, or a Google Static Maps image). SDK 57 pins react-native-maps 1.27.2 in bundledNativeModules; npm latest is 1.29.0 (2026-06-28) which added iOS Fabric support for GoogleMaps Marker/Polygon. Peers: react-native >= 0.76.0, react >= 18.3.1.

**Source:** https://raw.githubusercontent.com/react-native-maps/react-native-maps/master/src/MapView.web.ts, https://api.github.com/repos/react-native-maps/react-native-maps/releases


### THE CRUX: expo-camera barcode scanning DOES work on iOS Safari via the web export
*confidence: high*

expo-camera@57.0.4 declares `"dependencies": {"barcode-detector": "^3.0.0"}`. Its web scanner (packages/expo-camera/src/web/WebBarcodeScanner.ts) does: `const NativeBarcodeDetector = globalThis.BarcodeDetector; if (typeof NativeBarcodeDetector !== 'undefined') { ...use native... } const { BarcodeDetector } = await import('barcode-detector'); ...` — i.e. it silently falls back to the ZXing-WASM polyfill when the browser lacks the API. barcode-detector@3.2.2 (MIT, Sec-ant/barcode-detector) depends on zxing-wasm@3.1.3. Supported formats map to aztec, codabar, code_39, code_93, code_128, data_matrix, ean_8, ean_13, itf, pdf417, qr_code, upc_a, upc_e — EAN-13/UPC-A being what you need for Canadian OTC drug packaging. `<CameraView onBarcodeScanned barcodeScannerSettings={{barcodeTypes:['ean13','upc_a','ean8','upc_e']}}>` is therefore the SAME code path on iOS native, Android native, and iOS Safari web.

**Source:** https://raw.githubusercontent.com/expo/expo/main/packages/expo-camera/src/web/WebBarcodeScanner.ts, https://registry.npmjs.org/expo-camera/57.0.4, https://registry.npmjs.org/barcode-detector


### Native BarcodeDetector is unusable on iOS Safari — confirming the polyfill is load-bearing
*confidence: high*

caniuse mdn-api_barcodedetector_detect: Safari desktop 3.1–26.5 not supported, 26.6–27+ 'disabled by default'; Safari on iOS 3.2–26.5 not supported, 26.6 onward 'disabled by default' (i.e. behind Settings > Safari > Advanced > Feature Flags > Shape Detection API); Chrome for Android 151 fully supported; Samsung Internet 13.0+ supported; Firefox never. Global support 76.34%. Reports also indicate the flag-gated implementation has been broken since iOS 18. So any browser-based scanner on iPhone MUST ship a WASM polyfill — which expo-camera does automatically and a hand-rolled Next.js PWA does not.

**Source:** https://caniuse.com/mdn-api_barcodedetector_detect


### zxing-wasm fetches its .wasm from jsDelivr CDN by default — self-host it for the demo
*confidence: high*

zxing-wasm README, 'Configuring .wasm Serving': 'To provide a smooth development experience, the serve path is automatically assigned a jsDelivr CDN URL upon build.' Default is `https://fastly.jsdelivr.net/npm/zxing-wasm@${ZXING_WASM_VERSION}/dist/${match[1]}/${path}`. Override with `prepareZXingModule({ overrides: { locateFile: (path, prefix) => ... } })` before the first read. This matters because (a) a third-party CDN hit at scan time adds latency and a CSP/offline dependency, and (b) it interacts badly with cross-origin isolation headers.

**Source:** https://raw.githubusercontent.com/Sec-ant/zxing-wasm/main/README.md


### expo-router/ui headless Tabs is the exact primitive for the 4-tab product detail screen with no bottom bar
*confidence: high*

expo-router offers THREE tab layouts: JavaScript tabs (React Navigation bottom tabs), Native tabs (platform tab bar), and Custom tabs via the `expo-router/ui` submodule — `Tabs`, `TabList`, `TabTrigger`, `TabSlot`. All render unstyled `<View>`s except TabTrigger (a `<Pressable>`), and `TabSlot` 'can be nested inside other components within Tabs but cannot be within the TabList'. Putting `<TabList>` ABOVE `<TabSlot/>` renders the tab strip at the TOP — exactly the design. `asChild` forwards props to a custom component. `reset` prop ('always'|'onLongPress'|'never') controls nested-stack reset. Marked EXPERIMENTAL in the docs. Tabs remain URL-addressable, which is a real win for the web demo link. expo-router version for SDK 57: ~57.0.17.

**Source:** https://docs.expo.dev/router/advanced/custom-tabs.md


### Typed routes are still opt-in/beta, not default
*confidence: high*

Expo docs (latest): 'Expo Router supports generating TypeScript types automatically with Expo CLI... This feature is currently in beta and is not enabled by default.' Enable with `{"expo":{"experiments":{"typedRoutes": true}}}` plus `npx expo customize tsconfig.json`. The Expo Router quick-start template turns it on already. Constraint worth knowing: 'Statically typed routes do not support relative paths' — use absolute hrefs, and dynamic routes must use the object form `href={{pathname:'/product/[id]', params:{id}}}`.

**Source:** https://docs.expo.dev/router/reference/typed-routes/


### NativeWind 4.2.6 is the stable styling choice; v5 is still preview; Unistyles forces a dev build
*confidence: high*

nativewind dist-tags: latest = 4.2.6 (2026-06-22), preview = 5.0.0-preview.4 (2026-05-15), nightly. v4 peer-depends only on `tailwindcss: '>3.3.0'` — install tailwindcss@^3.4.17 (latest v3 = 3.4.19, dist-tag `v3-lts`) plus react-native-reanimated and react-native-safe-area-context. Setup: `babel-preset-expo` with `{jsxImportSource:'nativewind'}` + `'nativewind/babel'`, `withNativeWind(config,{input:'./global.css'})` in metro.config.js, `"web":{"bundler":"metro"}`, and a `nativewind-env.d.ts` triple-slash reference. v5 moves to Tailwind v4 CSS-first config and was still preview as of mid-2026. react-native-unistyles@3.3.0 peer-depends on `react-native-nitro-modules` → native module → no Expo Go. NativeWind is a pure build-time transform and works identically on react-native-web, which matters for the shared web demo.

**Source:** https://registry.npmjs.org/nativewind, https://www.nativewind.dev/docs/getting-started/installation, https://registry.npmjs.org/react-native-unistyles/3.3.0


### Reanimated version-pinning gotcha: do NOT install @latest
*confidence: high*

SDK 57's bundledNativeModules pins react-native-reanimated 4.5.1, react-native-worklets 0.10.1, react-native-gesture-handler ~2.32.0. But npm latest is reanimated 4.6.0, whose peerDependencies are `react-native: '0.83 - 0.87'` AND `react-native-worklets: '0.12.x'` (npm latest worklets = 0.12.1). Installing reanimated@latest without also moving worklets breaks the pairing. Always use `npx expo install react-native-reanimated`, never `npm install`. SDK 57 itself bumped reanimated 4.3→4.5, worklets 0.8→0.10, gesture-handler 2.31→2.32. Reanimated 4.x supports web (all functionality implemented in pure JS, lower efficiency) and adds CSS Animations/Transitions APIs — ideal for the accordion expand/collapse and press states across native + web.

**Source:** https://registry.npmjs.org/react-native-reanimated/4.6.0, expo@57.0.18 bundledNativeModules.json, https://docs.swmansion.com/react-native-reanimated/docs/guides/web-support/


### expo-sqlite ships FTS5 ON BY DEFAULT and supports a bundled .db asset
*confidence: high*

Config plugin property `enableFTS` defaults to `true` — 'Whether to enable the FTS3, FTS4 and FTS5 extensions.' Other flags: useSQLCipher (false), useLibSQL (false), withSQLiteVecExtension (false). Bundled database: `<SQLiteProvider databaseName="test.db" assetSource={{ assetId: require('./assets/test.db') }}>`. Also ships `expo-sqlite/kv-store` — 'a drop-in replacement for @react-native-async-storage/async-storage' backed by SQLite, with SYNCHRONOUS APIs (`Storage.getItemSync`, `Storage.setItemSync`) that AsyncStorage lacks — and `expo-sqlite/localStorage/install` for a web-compatible localStorage shim. A built-in DevTools inspector (Shift+M in Expo CLI) lets you browse/query the DB.

**Source:** https://docs.expo.dev/versions/latest/sdk/sqlite.md


### expo-sqlite on WEB is alpha and requires COOP/COEP headers — a real conflict with the WASM barcode polyfill
*confidence: medium*

Docs: 'Web support is in alpha and may be unstable.' It requires Metro config for .wasm files AND `Cross-Origin-Embedder-Policy` + `Cross-Origin-Opener-Policy` headers to enable SharedArrayBuffer (configurable on EAS Hosting via the expo-router plugin `headers`, e.g. COEP: credentialless). Risk: cross-origin isolation interferes with fetching the zxing .wasm from jsDelivr, so on web you would need to self-host the ZXing wasm via `prepareZXingModule`, or avoid expo-sqlite on web entirely.

**Source:** https://docs.expo.dev/versions/latest/sdk/sqlite.md


### EAS Build free tier: 15 Android + 15 iOS builds/month, 45-min timeout, low-priority queue
*confidence: high*

Expo Free plan ($0): 15 Android and 15 iOS builds, low-priority queue (90+ min waits possible at peak), 45-minute build timeout, 1 concurrency, 25 projects, unlimited members, submit to app stores, EAS Update to 1K MAUs with 100 GiB edge bandwidth and 20 GiB storage, 60 CI/CD Workflow minutes, 100K Observe events, Expo MCP Server (fair use). Paid: Starter $19/mo ($45 build credit), Production $199/mo ($225 credit). Pay-per-build overage: Android medium $1 / large $2, iOS medium $2 / large $4.

**Source:** https://expo.dev/pricing.md


### EAS Hosting free tier is real and usable for the shareable web demo, but has a punishing per-request CPU cap
*confidence: high*

Hosting on Free: 100,000 requests/month, 1,000,000 CPU-ms/month, 1 GB storage, 5 aliases, 7-day log retention, 30-day preview-deployment retention, NO custom domain. Critically, Free allows only 10 CPU-ms PER REQUEST and 10 subrequests (paid plans get 30,000 CPU-ms and 1,000 subrequests). Static asset serving is fine; a heavy Expo Router API route may not be. Overage rates (all plans): $2 per 1M requests, $0.04 per 1M CPU-ms, $0.04/GB storage. 'EAS Hosting is available to anyone with an Expo account, regardless of whether you pay for EAS or use the Free plan.' Deploy = `npx expo export --platform web && eas deploy`. Runtime is Cloudflare Workers. web.output options: `single` (SPA), `static` (per-route HTML), `server` (HTML + API routes).

**Source:** https://expo.dev/pricing.md, https://docs.expo.dev/eas/hosting/introduction.md, https://docs.expo.dev/eas/hosting/get-started.md, https://docs.expo.dev/guides/publishing-websites.md


### Testing on a physical iPhone without a paid Apple Developer account: LOCAL BUILD ONLY
*confidence: high*

Expo docs, development builds, 'Build locally': 'Compile the app yourself with Expo CLI and your native toolchain. No Expo account is required and this is the only way to install a development build on an iPhone without a paid Apple Developer account.' Command: `npx expo run:ios --device` (requires macOS + Xcode, a unique ios.bundleIdentifier, and Developer Mode enabled on the phone). Free Apple ID provisioning expires after 7 days. EAS internal distribution for iOS uses ad hoc or enterprise provisioning, requires `eas device:create` UDID registration on the Apple Developer Portal, and is subject to Apple's 100-device-per-app limit — i.e. it needs the $99/yr Apple Developer Program. Android is completely free: `distribution: 'internal'` makes EAS Build emit an APK behind a UUID install URL, or just install the SDK 57 Expo Go APK via Expo CLI.

**Source:** https://docs.expo.dev/develop/development-builds/introduction.md, https://docs.expo.dev/build/internal-distribution.md


### Sharing a demo through Expo Go/EAS Update no longer works for third parties
*confidence: high*

Expo changelog 2026-05-13: 'when accessing updates published to EAS Update in Expo Go, you can now only load projects that you own or that are owned by an organization you are a member of. This change applies to all versions of Expo Go and took effect on May 12, 2026.' Also, self-hosted updates must serve plain JS bundles, not Hermes bytecode, in Expo Go. Recommended sharing paths are now store testing tracks, EAS internal distribution, or development builds + EAS Update. For a portfolio piece shown to strangers, this kills the 'scan my QR in Expo Go' demo and makes the web export the primary shareable artifact.

**Source:** https://expo.dev/changelog/expo-go-loading-changes-may-2026


### New Architecture is mandatory from SDK 55 onward
*confidence: high*

Expo docs: 'SDK 55 and later run entirely on the New Architecture. The New Architecture is always enabled and cannot be disabled. If you need to use the legacy architecture, use SDK 54 or earlier.' The legacy architecture was frozen in June 2025. All expo-* packages support New Arch as of SDK 53. `npx expo-doctor@latest` cross-checks your deps against React Native Directory for New Arch compatibility. As of January 2026, ~83% of SDK 54 EAS builds used New Arch.

**Source:** https://docs.expo.dev/guides/new-architecture.md


### Supabase free tier: generous, but pauses after 1 week of inactivity and caps you at 2 projects
*confidence: high*

Free $0/mo: unlimited API requests, 50,000 monthly active users (auth), 500 MB database size, shared CPU / 500 MB RAM, 5 GB egress, 5 GB cached egress, 1 GB file storage, community support. Explicit footnote: 'Free projects are paused after 1 week of inactivity. Limit of 2 active projects.' Pro from $25/mo (8 GB disk, 250 GB egress, daily backups, 7-day log retention; $10/mo compute credit covers one Micro instance). Postgres extensions including pg_trgm and pgvector are one-click enableable on all tiers (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`), and native tsvector/tsquery full-text search is standard Postgres. Edge Functions free tier: 500,000 invocations/month.

**Source:** https://supabase.com/pricing


### Convex free tier (real numbers)
*confidence: high*

Free & Starter plan, $0 or pay-as-you-go: 1M function calls/month included ($2.20 per additional 1M), query/mutation compute free, 20 GB-hours action compute, 0.5 GB database storage, 1 GB file storage, 0.5 GB search storage, 1 GB database I/O, 3,000 search query-GBs, 1 GB data egress, 40 deployments, deployment class S16, 1,000 concurrent sessions, 16 concurrent queries, 64 concurrent actions, 1-6 developers. Includes text search, vector search, crons, auth, Node.js actions, preview deployments. NOT included on Free: daily backups, custom domains, email support, log streaming, exception reporting. Professional is $25/developer/month.

**Source:** https://www.convex.dev/pricing


### Cloudflare Workers free tier is the strongest free option for a thin key-hiding API
*confidence: high*

Workers Free: 100,000 requests per DAY, no charge or limit for duration, 10 milliseconds of CPU time per invocation. 'Requests to static assets are free and unlimited.' Cloudflare does not bill for subrequests you make from your Worker. Workers Paid is a $5/month minimum with 10M requests + 30M CPU-ms/month included and no egress charges. This is materially better than EAS Hosting Free for API routes (same underlying runtime, but 100k/day vs 100k/month) — though EAS Hosting integrates with `eas deploy` and Expo Router API routes out of the box.

**Source:** https://developers.cloudflare.com/workers/platform/pricing/


### Fly.io has no free tier; Railway has no free tier — rule both out for a $0 project
*confidence: medium*

Fly.io discontinued its free allowances on 2024-10-07 (previously 3 always-on 256MB VMs, 3GB storage, 160GB bandwidth). New users get a trial capped at 2 VM-hours or 7 days, whichever ends first; practical minimum is ~$5/mo. Railway removed its free tier; new accounts get a one-time $5 trial credit, then Hobby is $5/month plus usage-based billing. For comparison, Vercel Hobby (free) gives 4 CPU-hours Active CPU, 360 GB-hrs provisioned memory, 1M function invocations, 100 GB fast data transfer, 200 projects, 100 deployments/day, 45-min build timeout, 1 concurrent deployment.

**Source:** https://vercel.com/docs/limits + multiple 2026 pricing reviews (Fly/Railway figures unconfirmed on vendor pages)


### iOS standalone PWAs have a chronic camera-permission defect — the strongest argument against the Next.js path
*confidence: medium*

WebKit does not persist the camera-permission decision for installed PWAs; Safari on iOS intermittently re-prompts for camera access even though permission was granted and the origin is unchanged (webkit.org bugs 185448 and 215884; STRICH KB article on iOS PWA camera access). The commonly recommended workaround is to NOT install as a PWA — i.e. remove `apple-mobile-web-app-capable` and run in a Safari tab. Separately, in the EU under the DMA, iOS 17.4+ opens PWAs in Safari tabs with no standalone mode or push. Net effect: a barcode-scanning PWA on iPhone should be demoed in a Safari TAB, not from the home screen.

**Source:** https://bugs.webkit.org/show_bug.cgi?id=185448, https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa


### On-device OCR is the ONE feature that would force a development build — so do it server-side
*confidence: high*

There is no first-party Expo OCR module. Community options are all custom native modules that explicitly do not work in Expo Go: expo-mlkit-ocr@0.2.7 (2026-05-06, ML Kit Text Recognition v2, iOS+Android), expo-text-extractor@2.0.0 (2026-02-28, ML Kit on Android / Apple Vision on iOS), expo-ocr-kit@0.1.4 (2026-04-08), @react-native-ml-kit/text-recognition@2.0.0 (2025-09-01, stale). Web-only alternative: tesseract.js@7.0.0. Recommendation: run OCR in a Supabase Edge Function (Google Cloud Vision or an LLM vision call) so the same code path works in Expo Go AND in the web export, keeping you off development builds entirely.

**Source:** https://registry.npmjs.org/{expo-mlkit-ocr,expo-text-extractor,expo-ocr-kit,@react-native-ml-kit/text-recognition,tesseract.js}


### Exact versions for the full dependency set (npm latest as of 2026-08-30)
*confidence: high*

expo 57.0.18 | expo-router 57.0.17 | expo-camera 57.0.4 | expo-location 57.0.14 | expo-clipboard 57.0.1 | expo-haptics 57.0.2 | expo-image 57.0.3 | expo-sqlite 57.0.2 | expo-web-browser 57.0.2 | expo-image-picker 57.0.14 | expo-dev-client 57.0.16 | react-native 0.86.3 (SDK pin; npm latest 0.87.1) | react/react-dom 19.2.3 | react-native-web 0.21.2 (SDK pin ~0.21.0) | react-native-maps 1.27.2 (SDK pin; npm latest 1.29.0) | react-native-reanimated 4.5.1 (SDK pin; npm latest 4.6.0) | react-native-worklets 0.10.1 (SDK pin; npm latest 0.12.1) | react-native-gesture-handler 2.32.0 | react-native-safe-area-context 5.7.0 | react-native-screens 4.26.0 | nativewind 4.2.6 | tailwindcss 3.4.19 | @tanstack/react-query 5.102.8 | @tanstack/react-query-persist-client 5.102.8 | @supabase/supabase-js 2.112.4 | zustand 5.0.15 | @shopify/flash-list 2.3.2 | react-native-svg 15.15.5 | hono 4.13.5 | next 16.3.3 | serwist 9.5.12 | barcode-detector 3.2.2 | zxing-wasm 3.1.3

**Source:** https://registry.npmjs.org/* + expo@57.0.18 bundledNativeModules.json


### Explicitly unverified
- Whether expo-haptics is bundled in Expo Go. Its docs frontmatter lists platforms ['android','ios','web'] and — unlike expo-camera, expo-location, expo-clipboard, expo-image and expo-sqlite — does NOT carry the 'expo-go' tag. Historically it has always been in Expo Go, so this is probably a docs omission, but I could not confirm it. If it is genuinely excluded, haptics is a nice-to-have and can be dropped or guarded behind a runtime check.
- Whether an SDK 57 Expo Go build has appeared on the iOS App Store since the SDK 57 changelog of 2026-06-30. The changelog index shows no Expo Go entry after 2026-05-13, so the SDK 54 pin most likely still stands as of 2026-08-30, but I found no positive confirmation of the current App Store state.
- That NativeWind 4.2.6 is tested/verified against Expo SDK 57 and React Native 0.86 specifically. No compatibility matrix or issue thread confirming or denying it was located; my GitHub issue-search call failed.
- Whether expo-router/ui headless Tabs render and route correctly under `expo export -p web` with `web.output: 'single'`. The docs describe the API but say nothing about web-export behaviour, and it is marked experimental.
- Whether an Expo Router API route proxying a Google Places call actually fits inside EAS Hosting Free's 10 CPU-ms-per-request budget. The number is documented; the real-world CPU cost of such a route is not.
- The exact interaction between COOP/COEP cross-origin isolation (required by expo-sqlite web) and zxing-wasm's default jsDelivr .wasm fetch. I reasoned about it from spec behaviour; I did not test it.
- The precise split between Convex's 'Free' and 'Starter' tiers. Convex's pricing page merges them into one 'Free & Starter' column, so the quoted numbers (1M function calls, 0.5 GB DB, etc.) are the shared included allowance — what happens at the boundary on the strictly-free plan versus pay-as-you-go Starter is not separable from the page.
- Fly.io's and Railway's exact current trial/minimum terms — taken from 2026 third-party pricing articles rather than fetched vendor pricing pages.
- Behavioural differences between react-native-maps 1.27.2 (the SDK 57 bundledNativeModules pin, and therefore the Expo Go build) and 1.29.0 (npm latest, which added iOS Fabric support for GoogleMaps Marker/Polygon). Whether custom-child markers render correctly under the New Architecture at 1.27.2 in Expo Go was not verified.
- Google Places / Maps API pricing and free-credit terms, and the availability of any Canadian OTC drug price data — outside this dimension's scope and not researched.
- Whether Expo Go for SDK 57 installs cleanly on a physical Android device via Expo CLI. The SDK 57 changelog states it is 'available... through Expo CLI for Android devices/emulators and iOS simulators', but I did not verify the download flow.


## pharmacy-price


### Overpass API returns 701 pharmacies inside the City of Toronto administrative boundary
*confidence: high*

Live query run 2026-08-31 against https://overpass-api.de/api/interpreter returned {nodes: 660, ways: 41, total: 701}. Query used: [out:json][timeout:60]; area["name"="Toronto"]["boundary"="administrative"]["admin_level"="6"]->.a; (node["amenity"="pharmacy"](area.a); way["amenity"="pharmacy"](area.a);); out count; — Overpass version 0.7.62.11, osm3s timestamp 2026-08-31T04:52:34Z.

**Source:** https://overpass-api.de/api/interpreter (live POST)


### OSM pharmacy data quality in downtown Toronto is good enough to ship
*confidence: high*

Radius query around 43.6532,-79.3832 (r=2000m) returned 91 pharmacies. Tag coverage: amenity 91/91, healthcare=pharmacy 91/91, name 91/91, dispensing 55, brand 52, addr:street 51, addr:housenumber 50, website 41, opening_hours 27, phone 26. 50/91 have full housenumber+street. Brand breakdown: 39 independent/unbranded, 26 Shoppers Drug Mart, 14 Rexall, 4 I.D.A., 3 Pharmasave, 2 PharmaChoice, 2 Remedy'sRx, 1 Guardian. Shoppers entries carry real store-locator URLs (e.g. https://www.shoppersdrugmart.ca/en/store-locator/store/1320).

**Source:** https://overpass-api.de/api/interpreter (live POST, analysed locally)


### Exact Overpass QL query to use for the map tab (radius search)
*confidence: high*

POST body (form field `data`): [out:json][timeout:25];(node["amenity"="pharmacy"](around:2000,{lat},{lon});way["amenity"="pharmacy"](around:2000,{lat},{lon}););out center tags; — `out center` gives ways a synthetic center{lat,lon} so you can treat nodes and ways uniformly. Use healthcare=pharmacy as an OR clause only if you want to catch hospital dispensaries; in Toronto all 91 sampled features carried BOTH amenity=pharmacy and healthcare=pharmacy, so amenity alone is sufficient.

**Source:** https://wiki.openstreetmap.org/wiki/Overpass_API


### Overpass public endpoints and fair-use limits
*confidence: high*

Main FOSSGIS instance: https://overpass-api.de/api/interpreter (v0.7.62.11). Alternatives: https://overpass.private.coffee/api/interpreter (successor to the kumi.systems instance, 4 servers, no formal limits) and https://maps.mail.ru/osm/tools/overpass/api/interpreter (no rate limit). Fair use on the main instance: max ~10,000 queries/day and <1 GB/day total; guidance for a distributed *application* is to divide by 100, i.e. <100 queries and <10 MB/day. Mandatory: set a User-Agent or Referer. On HTTP 429 or 504, back off 30 seconds. No parallel scripts.

**Source:** https://wiki.openstreetmap.org/wiki/Overpass_API


### Overpass fair-use maths mean you must NOT call it from the device on every map open
*confidence: high*

With a ~10 MB/day application budget and a 91-pharmacy 2km response, a live per-user query is fine for a demo but will not scale. Recommended: run the Toronto-wide query ONCE at build time, ship the ~701-row GeoJSON in the app bundle (a few hundred KB), and refresh it manually. This also removes the network dependency from the map tab and makes the demo deterministic.

**Source:** https://wiki.openstreetmap.org/wiki/Overpass_API


### OSM data is ODbL; attribution rules for a mobile app are specific and satisfiable
*confidence: high*

Overpass responses literally carry osm3s.copyright: "The data included in this document is from www.openstreetmap.org. The data is made available under ODbL." OSMF guidelines: credit must say "OpenStreetMap" and indicate ODbL; linking the word OpenStreetMap to openstreetmap.org/copyright satisfies the licence-indication requirement. For an interactive map the credit "should typically appear in a corner of the map", OR adjacent to the map, OR on a startup splash screen. It may auto-collapse on map interaction or after five seconds on a splash, provided the user can still reach the licence info via an info button or About menu. If shown at app startup it need not be re-shown on every map view. Because MediSense has no nav bar, put a small tappable "© OpenStreetMap" in the map's bottom corner.

**Source:** https://osmfoundation.org/wiki/Licence/Attribution_Guidelines


### Google Places API (New) searchNearby: exact endpoint, headers, and body
*confidence: high*

POST https://places.googleapis.com/v1/places:searchNearby with headers Content-Type: application/json, X-Goog-Api-Key: <KEY>, X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location. Field mask is MANDATORY — "There is no default list of returned fields in the response"; omitting it returns an error. Body: {"includedTypes":["pharmacy"],"maxResultCount":20,"locationRestriction":{"circle":{"center":{"latitude":43.6532,"longitude":-79.3832},"radius":2000.0}}}. Constraints verified from the docs: radius must be between 0.0 and 50000.0 metres inclusive (default 0.0, and locationRestriction is required); maxResultCount is between 1 and 20 inclusive (20 is the default). rankPreference and excludedTypes/includedPrimaryTypes are also supported.

**Source:** https://developers.google.com/maps/documentation/places/web-service/nearby-search


### Both "pharmacy" and "drugstore" are valid Places API type values
*confidence: high*

The Place Types table lists both `drugstore` and `pharmacy` under the Health and Wellness category. Use includedTypes: ["pharmacy","drugstore"] to catch big-box stores with a pharmacy counter as well as standalone dispensaries.

**Source:** https://developers.google.com/maps/documentation/places/web-service/place-types


### Google Places Nearby Search pricing: $32.00 per 1,000, only 5,000 free per month, billing account mandatory
*confidence: high*

From the official SKU table: "Places API Nearby Search Pro" SKU 99F9-A108-83A6 — free usage cap 5,000/month, then $32.00 / $25.60 / $19.20 / $9.60 / $2.40 per 1,000 across the five volume tiers. "Places API Nearby Search Enterprise" SKU 772E-9975-BE34 — 1,000 free, $35.00/1,000. "Enterprise + Atmosphere" SKU F20E-7034-0EF7 — 1,000 free, $40.00/1,000. Legacy "Places - Nearby Search" SKU 6B23-8A17-D29D — 5,000 free, $32.00/1,000. There is NO Essentials tier for Nearby Search, so $32/1,000 is the floor. The universal $200/month credit was retired in March 2025 and replaced by these per-SKU free caps. Billing is mandatory: "Before using the Places API, ensure you have a project with a billing account and the Places API enabled."

**Source:** https://developers.google.com/maps/billing-and-pricing/pricing


### DECISIVE: rendering a Google map inside a native mobile app is FREE and uncapped
*confidence: high*

On the same official pricing table, SKU "Maps SDK" (6DE1-4D9C-5B67) has Free Usage Cap = "Unlimited" with no per-1,000 price in any volume tier. A footnote states "Mobile Native Static Maps and Mobile Native Dynamic Maps are now merged under one single SKU: Maps SDK." By contrast the web SKU "Dynamic Maps" (FAF4-3B2D-51B2) is 10,000 free then $7.00/1,000, and "Static Maps" (3C2D-B525-2E5F) is 10,000 free then $2.00/1,000. So react-native-maps with PROVIDER_GOOGLE renders at $0 forever; only Places lookups can ever bill you.

**Source:** https://developers.google.com/maps/billing-and-pricing/pricing


### Statistics Canada's ODHF explicitly EXCLUDES pharmacies — verified by downloading it
*confidence: high*

Downloaded https://www150.statcan.gc.ca/n1/en/pub/13-26-0001/2020001/ODHF_v1.1.zip (1,080,425 bytes) and parsed odhf_v1.1.csv: 7,033 rows, columns [index, facility_name, source_facility_type, odhf_facility_type, provider, unit, street_no, street_name, postal_code, city, province, source_format_str_address, CSDname, CSDuid, Pruid, latitude, longitude]. odhf_facility_type values are only: Nursing and residential care facilities (3,664), Ambulatory health care services (2,227), Hospitals (1,140). Only 3 rows have "pharm" anywhere in facility_name, all in BC and all clinics-with-a-pharmacy. ODHF is USELESS for this project. Licence is Open Government Licence – Canada.

**Source:** https://www.statcan.gc.ca/en/lode/databases/odhf (file downloaded and parsed locally)


### City of Toronto Open Data has ZERO pharmacy datasets
*confidence: high*

CKAN query https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_search?q=pharmac returned {"count": 0}. A broader query for pharmacy OR drug OR health facility also returned 0. The portal's licence is otherwise permissive (worldwide, royalty-free, non-exclusive, with credit) but there is simply no pharmacy layer.

**Source:** https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_search?q=pharmac


### Ontario College of Pharmacists register offers a CSV export but with awkward restrictions
*confidence: medium*

The "Find a Pharmacy or Pharmacy Professional" public register at https://members.ocpinfo.com/tcpr/public/pr/en/ supports exporting search results to CSV containing name, accreditation number, address, phone number and fax number. Restrictions: downloads are only available between 5 p.m. and midnight, Chrome/Edge recommended, may take several minutes, and server restrictions cap unlimited downloads. There is no documented API. Reuse is governed by https://ocpinfo.com/terms-of-use/. It has NO coordinates (address only), so you would still need to geocode. Not worth it versus OSM.

**Source:** https://ocpinfo.com/public/how-to-use-find-a-pharmacy-or-pharmacy-professional/


### NO public API returns the retail shelf price of an OTC drug at a Canadian pharmacy
*confidence: high*

Loblaw (which owns Shoppers Drug Mart, Loblaws, Real Canadian Superstore, No Frills) publishes no public product-price API. Rexall publishes none. Costco.ca publishes none. Walmart's developer portal (developer.walmart.com/ca-marketplace) exposes only a seller-facing Price API — it lets a Walmart Marketplace SELLER set prices on their OWN items; it is not a consumer catalogue read API, and the older Price Management APIs are deprecated and slated for removal in 2026. Every commercial offering found (Apify actors for Loblaws/PC Express/Superstore, RealDataAPI, SerpApi Walmart, Actowiz "Shoppers Drug Mart scraping") is a third-party scraper, not an official feed.

**Source:** https://developer.walmart.com/ca-marketplace/docs/price-api-overview


### robots.txt does not permit scraping these retailers — and is not the operative document anyway
*confidence: high*

Fetched live: www.shoppersdrugmart.ca/robots.txt disallows only /cart, /checkout, /my-account for User-agent: *; www.loblaws.ca/robots.txt disallows /cart/, /checkout/, /account/, /collections-id/; www.rexall.ca/robots.txt allows / with Crawl-delay: 5 but disallows /search; www.walmart.ca/robots.txt disallows /search/*, /ws/*, and refined-browse patterns. The absence of a product-page Disallow is NOT permission — the binding restriction is each site's Terms of Use, which for large Canadian retailers uniformly prohibit access by robot/spider/scraper or other automated means. Treat scraping as off-limits for a graded student project.

**Source:** https://www.loblaws.ca/robots.txt , https://www.shoppersdrugmart.ca/robots.txt , https://www.rexall.ca/robots.txt , https://www.walmart.ca/robots.txt


### THE BIG WIN — the ODB Formulary XML extract is real, free, downloadable, and contains OTC drugs with prices
*confidence: high*

Downloaded https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml — HTTP 200, 3,598,643 bytes, application/xml, root <extract createDate="2026-08-26">. Structure: <manufacturerList> with 721 <manufacturer id="XXX"> entries, then <formulary> → 20 <pcg2> (therapeutic class) → 118 <pcg6> → 879 <genericName> (with <name> = the ACTIVE INGREDIENT, e.g. "IBUPROFEN") → <pcgGroup> → 2,551 <pcg9> (with <itemNumber>, <strength>, <dosageForm>, optional <note>) → 8,668 <drug> records. Element counts: individualPrice 7,751, amountMOHLTCPays 7,106, strength 2,467, dosageForm 2,516, dailyCost 773, lccNote 1,785.

**Source:** https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml (downloaded and parsed locally)


### The ODB <drug id> attribute IS the DIN, and it joins cleanly to Health Canada's DPD
*confidence: high*

Verified: ODB record <drug id="00364142"> name "Motrin" manufacturerId "UPJ". Querying https://health-products.canada.ca/api/drug/drugproduct/?lang=en&type=json&din=00364142 returns [{"drug_code":2903,"drug_identification_number":"00364142","brand_name":"MOTRIN TABLETS 400MG","company_name":"MCNEIL CONSUMER HEALTHCARE DIVISION OF JOHNSON & JOHNSON INC","ai_group_no":"0108883002"}]. And https://health-products.canada.ca/api/drug/schedule/?lang=en&type=json&id=2903 returns [{"drug_code":2903,"schedule_name":"NON-PRESCRIPTION DRUGS"}] — so you can filter the entire ODB extract down to genuine OTC products by joining DIN → drug_code → schedule.

**Source:** https://health-products.canada.ca/api/drug/drugproduct/ and /api/drug/schedule/ (live)


### ODB drug records carry a selfMed="Y" attribute that literally flags OTC self-medication products
*confidence: high*

34 drugs carry selfMed="Y". Extracted list includes: Novo-Gesic / Apo-Acetaminophen / Jamp Acetaminophen 325mg @ $0.0114 and 500mg @ $0.0149; Dulcolax (Sanofi) bisacodyl 5mg EC tab @ $0.2009 and 10mg suppository @ $1.2267 vs Jamp / CellChem / AMB bisacodyl 10mg supp @ $0.4206; Colace (WellSpring) docusate 100mg cap @ $0.1342 vs Taro/Soflax/Jamp docusate @ $0.0328; Senokot (iNova) sennosides 8.6mg @ $0.0464 vs Jamp-Senna @ $0.0464; Metamucil Fibre Therapy (P&G) @ $0.0246; Koffex DM dextromethorphan @ $0.0190; Anusol Ointment @ $0.2187; Betadine and Maalox (listed, no price). Other drug attributes present: sec3 (8,504), chronicUseMed (2,089), sec3b (1,748), notABenefit (1,478), sec12 (1,264), sec3bEAP (868), insOH (248), sec9 (142), dinStatus (41), sec3c (28), maO (12).

**Source:** https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml (parsed locally)


### The ODB file contains many more OTC active ingredients beyond the selfMed flag
*confidence: high*

Confirmed <genericName> entries include: ACETAMINOPHEN, ACETAMINOPHEN & CODEINE PHOSPHATE, ACETAMINOPHEN & CAFFEINE & CODEINE PHOSPHATE, IBUPROFEN, NAPROXEN, NAPROXEN SODIUM, LORATADINE, CETIRIZINE HYDROCHLORIDE, FAMOTIDINE, RANITIDINE HCL, OMEPRAZOLE, OMEPRAZOLE MAGNESIUM, ESOMEPRAZOLE, PANTOPRAZOLE SODIUM/MAGNESIUM, HYDROCORTISONE (+ACETATE, +VALERATE), CLOTRIMAZOLE, MICONAZOLE NITRATE, DIMENHYDRINATE, LACTULOSE, DOCUSATE SODIUM, SENNOSIDES A & B, BISACODYL, PSYLLIUM MUCILLOID, ZINC SULFATE, POVIDONE-IODINE, FERROUS GLUCONATE, CYANOCOBALAMIN. Absent: diphenhydramine, pseudoephedrine, nicotine, melatonin, polyethylene glycol.

**Source:** https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml (parsed locally)


### The ODB file already gives you the exact 'branded on top, generics under Alternatives' structure the design doc asks for
*confidence: high*

Real example, ibuprofen 400mg Tab (pcg9 id 280804021, itemNumber 0911–0914 block): <drug id="00364142">Motrin (UPJ) individualPrice .1871, amountMOHLTCPays .0468</drug>; <drug id="00506052">Apo-Ibuprofen (APX) individualPrice .0468</drug>; <drug id="02317338">Ibuprofen (Jamp) individualPrice .0468</drug>. Loratadine 10mg (pcg9 040000061): Claritin (SCP, no ODB price) vs Apo-Loratadine individualPrice .6267. Acetaminophen 325mg (pcg9 280892006): Atasol (notABenefit) vs Novo-Gesic / Apo-Acetaminophen / Jamp @ $0.0114. 1,558 pcg9 groups contain 2+ drugs, and 713 of those have a genuine price spread between members — that is 713 ready-made branded-vs-generic comparison cards.

**Source:** https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml (parsed locally)


### amountMOHLTCPays vs individualPrice is a real, teachable equivalency story
*confidence: high*

For Motrin 400mg, individualPrice = $0.1871 but amountMOHLTCPays = $0.0468 — the plan only reimburses the Lowest Cost Alternative (the generic) price, so the patient pays the $0.1403/tablet difference if they insist on the brand. This is exactly the "Equivalency Explanation" content requirement 1 asks for, sourced from a government file rather than invented. The <lccNote> element (1,785 occurrences) carries the ministry's own Lowest Cost Alternative wording you can surface verbatim.

**Source:** https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml (parsed locally)


### ODB Formulary licence is Open Government Licence – Ontario 1.0, updated monthly
*confidence: high*

CKAN metadata from https://data.ontario.ca/api/3/action/package_show?id=ontario-drug-benefit-formulary-comparative-drug-index-formularycdi returns license_title "Open Government Licence – Ontario", license_id "OGL-ON-1.0", license_url https://www.ontario.ca/page/open-government-licence-ontario, update_frequency "monthly". OGL-ON permits copy, modify, publish, translate, adapt and distribute, including commercially, with attribution. Attribution line to use: "Contains information licensed under the Open Government Licence – Ontario. Source: Ontario Drug Benefit Formulary/Comparative Drug Index, Edition 43 data extract, 2026-08-26."

**Source:** https://data.ontario.ca/api/3/action/package_show?id=ontario-drug-benefit-formulary-comparative-drug-index-formularycdi


### GOTCHA — the legacy health.gov.on.ca ODB URLs are DEAD as of 2026-08-30
*confidence: high*

https://www.health.gov.on.ca/en/pro/programs/drugs/data_extract.xml (the URL still cited by both data.ontario.ca's own resource record and by open.canada.ca) fails with curl exit 60: "SSL certificate problem: certificate has expired", and returns HTTP 502 when TLS verification is bypassed. Same for .../drugs/edition_43.aspx. Do NOT hardcode that URL. Use the ontario.ca/files/ URL instead, and note that it is date-stamped per monthly edition, so pin the copy you ship rather than fetching at runtime.

**Source:** https://www.health.gov.on.ca/en/pro/programs/drugs/data_extract.xml (live probe)


### pCPA gives you an OFFICIAL, citable rule for how much cheaper a generic should be
*confidence: high*

pCPA Generics Tiered Pricing Framework, effective 1 October 2023: Tier 1 (one generic manufacturer) = 85% of brand reference price if no pricing/listing agreement, or 75% dropping automatically to 55% after 3 months of funding where a PLA exists; Tier 2 (two manufacturers) = 50% of brand reference price; Tier 3 (three or more manufacturers) = 25% of brand reference price for oral solids, 35% for all other dosage forms (liquids, patches, injectables, inhalers). Brand/innovator prices negotiated by pCPA are confidential; generic prices are transparent and apply market-wide.

**Source:** https://pcpa-app.ca/generics-tpf-faqs


### The real ODB data matches the pCPA framework almost exactly — you can prove your discount rule
*confidence: high*

Computed from the downloaded extract: Motrin 400mg Tab $0.1871 → Apo-Ibuprofen $0.0468 = 25.0% of brand (Tier 3 oral solid, exact match). Colace 100mg Cap $0.1342 → Taro docusate $0.0328 = 24.4% (Tier 3 oral solid). Dulcolax 10mg suppository $1.2267 → Jamp bisacodyl supp $0.4206 = 34.3% (Tier 3 non-oral-solid, 35% target). Senokot $0.0464 → Jamp-Senna $0.0464 = 100% (brand matched down to the LCA price — a real edge case your UI must handle without claiming a saving).

**Source:** Computed from the ODB Edition 43 XML cross-referenced with https://pcpa-app.ca/generics-tpf-faqs


### Ontario's markup and dispensing-fee rules give you a defensible retail-conversion constant
*confidence: medium*

Ontario Regulation 201/96 under the Ontario Drug Benefit Act sets the dispenser mark-up: 8% on drug costs under $1,000 and 6% at or above $1,000. ODB dispensing fee is capped around $8.83 (higher in designated rural pharmacies); most private plans cap at $11.99. Important nuance for MediSense: an OTC product bought off the shelf incurs NO dispensing fee at all — you just pay retail. So the honest formula is unitPrice × packSize × (1 + markup) × retailMultiplier, and the retailMultiplier is the ONLY genuinely invented number.

**Source:** https://www.ontariocanada.com/registry/view.do?postingId=46454&language=en ; https://www.ontario.ca/page/conditions-payment-dispensing-fee-under-ontario-drug-benefit-program


### Health Canada DPD packaging data is too sparse to give you pack sizes
*confidence: high*

https://health-products.canada.ca/api/drug/packaging/?lang=en&type=json&id=2903 returns {"drug_code":2903,"upc":"","package_size_unit":"","package_type":"","package_size":"","product_information":"1/16/50"} — package_size is empty and product_information is an unparseable free-text list. You will have to hand-curate a small pack-size table (e.g. acetaminophen 500mg = 100 caplets, ibuprofen 400mg = 50, loratadine 10mg = 30) for the ~30 OTC products you demo. Also note drug_code 2903 (Motrin 400mg) has status "Cancelled Post Market" since 2002 — check /api/drug/status/ before showing a product as buyable.

**Source:** https://health-products.canada.ca/api/drug/packaging/ and /api/drug/status/ (live)


### Statistics Canada publishes no retail drug prices
*confidence: high*

Queried the StatCan WDS getCubeMetadata for productId 18100245 ("Monthly average retail prices for selected products"): 13 geographies, 110 products, all food and a handful of household goods. The only near-miss is "Shampoo, 400 millilitres". No drug, medicine, vitamin or analgesic entries. StatCan's CPI publishes an index for non-prescribed medicines but never a dollar price, and never per store.

**Source:** https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata (live POST, productId 18100245)


### react-native-maps 1.29.0 is the right choice, and its Marker accepts arbitrary React children
*confidence: high*

npm: react-native-maps@1.29.0, MIT, peerDeps react >= 18.3.1, react-native >= 0.76.0. Docs: "Children components can be added within a Marker and rendered content will replace the marker symbol. This is a way of creating custom markers and allowing use of native SVGs." That is exactly what the price-label marker needs. Key props: coordinate (LatLng), children, onPress, tracksViewChanges (bool, default true), anchor (Google Maps only; iOS MapKit uses centerOffset), image (local resources only), icon (Google Maps only). Docs explicitly warn that many custom markers hurt performance and recommend tracksViewChanges={false} plus manual redraw().

**Source:** https://registry.npmjs.org/react-native-maps/latest ; https://github.com/react-native-maps/react-native-maps/blob/master/docs/marker.md


### react-native-maps on iOS defaults to Apple Maps with NO API key; Google needs a key on both platforms
*confidence: high*

iOS supports both Apple Maps and Google Maps; Android is Google Maps only. Apple Maps "works out-of-the-box and is therefore simpler to use at the price of missing some of the features supported by the Google Maps backend" and needs no key. Google Maps requires an API key on both platforms and "you must sign up and create a billing account". Expo config plugin requires react-native-maps 1.22+ and Expo SDK 53+; add "plugins": ["react-native-maps"] to app.json. Does not work in Expo Go — you need a development build.

**Source:** https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md


### expo-maps 57.0.2 is still ALPHA and cannot render a price-label marker
*confidence: high*

npm: expo-maps@57.0.2, MIT. Docs: "Expo Maps is currently in alpha and experiences frequent breaking changes"; unavailable in Expo Go, dev build mandatory. iOS = Apple Maps only, Android = Google Maps only (Android needs a Cloud project, Maps SDK for Android enabled, SHA-1 fingerprint, and android.config.googleMaps.apiKey in app.json; iOS needs nothing). Exports AppleMaps.View and GoogleMaps.View, plus markers/annotations, circles, polygons, polylines, and Android-only Street View. Custom markers are IMAGE-ONLY via the useImage hook from expo-image (GoogleMaps uses marker.icon + anchor; AppleMaps supports icon, systemImage, monogram, tintColor). There is no arbitrary-React-children marker. This disqualifies expo-maps for MediSense's price-label markers unless you pre-render every price as a bitmap.

**Source:** https://docs.expo.dev/versions/latest/sdk/maps/ ; https://registry.npmjs.org/expo-maps/latest


### MapLibre React Native 11.3.7 is the free-tile route, with MarkerView for interactive custom children
*confidence: high*

npm: @maplibre/maplibre-react-native@11.3.7, MIT, peerDeps expo >= 54.0.0, react >= 19.1.0, react-native >= 0.80.0. Use <MarkerView> for interactive markers — it accepts custom children as React components. Do NOT use PointAnnotation for tappable price pills: on Android its child views are rendered onto a bitmap for performance, so "if you need interactive views please use MarkerView". In v11 PointAnnotation was renamed ViewAnnotation and its style/icon props were removed (add a Layer child instead).

**Source:** https://registry.npmjs.org/@maplibre/maplibre-react-native/latest ; https://maplibre.org/maplibre-react-native/docs/components/general/marker-view/


### OpenFreeMap is genuinely free, needs no key, and is live right now
*confidence: high*

Verified live: https://tiles.openfreemap.org/styles/positron, /bright, /liberty, /dark, /fiord all return HTTP 200 (positron-bright 404s — the style is just "positron"). The positron style JSON has 55 layers, glyphs https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf, sprite https://tiles.openfreemap.org/sprites/ofm_f384/ofm, and sources {openmaptiles: vector via https://tiles.openfreemap.org/planet, ne2_shaded: raster}. The planet TileJSON 3.0.0 points at build 20260823_080002_pt, i.e. tiles rebuilt 23 Aug 2026. Site states: "Using our public instance is completely free: there are no limits on the number of map views or requests", no registration, no API keys, no cookies, commercial use permitted, MIT-licensed project. Attribution REQUIRED: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (the OpenFreeMap portion is optional). Positron is a minimal grey-and-white style — a near-perfect match for MediSense's black-and-white brief.

**Source:** https://openfreemap.org/ and https://tiles.openfreemap.org/styles/positron (live)


### CARTO basemaps now require a free API key and carry a 5,000,000 tile/month fair-use limit
*confidence: high*

CARTO Basemaps Terms of Service, last updated 26 August 2026: free Basemap Services are available at no charge "to any Customer who requests and uses a CARTO-issued API key", subject to "a fair use limit of five million (5,000,000) tile requests each calendar month, aggregated across all of Customer's API keys". CARTO "may apply a visible watermark or other identifying mark to basemap tiles served in response to requests that do not include a valid CARTO-issued API key." Attribution to BOTH OpenStreetMap and CARTO is mandatory (per https://carto.com/attributions), "prominent and conspicuous", and CARTO may revoke keys for non-compliance. The unauthenticated endpoints still resolve — https://basemaps.cartocdn.com/gl/positron-gl-style/style.json returns 200 and https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png returns 200 — but per the current terms those are the watermarked path. Get the free key at carto.com/basemaps/apikey.

**Source:** https://carto.com/legal/basemap-terms/


### Stadia Maps free tier is 200,000 credits/month but explicitly NON-COMMERCIAL
*confidence: high*

Free plan: 200,000 credits/month, standard basemaps only, basic APIs only, "Commercial use not allowed". Signup required (so an API key is required). New accounts get a no-obligation 14-day Professional trial then fall back to free. For a CSC318 student/portfolio project this is compliant, but it is a licensing landmine the moment the project is monetised or presented as a product.

**Source:** https://stadiamaps.com/pricing/


### Protomaps is the fully-offline option: self-hosted PMTiles, no third-party dependency
*confidence: high*

Full planet basemap is roughly 120 GB at zoom 0-15, with daily builds at https://maps.protomaps.com/builds (basemaps style v4.0.0+) plus a Source Cooperative mirror and BLAKE3 hashes. Regional extracts are made with the CLI `extract` command; each additional zoom level roughly doubles file size, so a Toronto-only extract is small. Protomaps explicitly advises against hotlinking their URLs — "copy the tileset to your own Cloud Storage" (guides for AWS, Cloudflare, GCP, Azure, and self-hosted). Distributed under the Open Database License as a Produced Work; OpenStreetMap attribution required.

**Source:** https://docs.protomaps.com/basemaps/downloads


### Google Maps URLs for directions need NO API key — exact cross-platform scheme
*confidence: high*

Official Maps URLs docs: "You don't need a Google API key to use Maps URLs" and "api=1 is a required parameter in all Google Maps URLs". Directions: https://www.google.com/maps/dir/?api=1&destination={URL-encoded address or lat,lng}&travelmode=driving — optional origin, destination_place_id, waypoints (pipe-separated), travelmode of driving|walking|bicycling|transit|two-wheeler. Search/show-a-pin: https://www.google.com/maps/search/?api=1&query={lat},{lng}&query_place_id={id}. This single https URL works on iOS, Android and web: on a device with the Google Maps app installed it deep-links into the app, otherwise it opens the browser.

**Source:** https://developers.google.com/maps/documentation/urls/get-started


### Apple Maps URL scheme for the iOS 'Directions' button
*confidence: high*

Apple map links are regular http links, not a maps: scheme. Directions: http://maps.apple.com/?daddr={destination}&dirflg=d — saddr optional (defaults to "here"), dirflg values are d (car), w (foot), r (transit). Show a location: http://maps.apple.com/?q={label}&ll={lat},{lng}&z={2-21}, or use the address parameter to display without searching. Recommended pattern in RN: Platform.select({ ios: 'http://maps.apple.com/?daddr=...&dirflg=d', android: 'https://www.google.com/maps/dir/?api=1&destination=...' }) passed to Linking.openURL, with the google.com/maps URL as the universal fallback.

**Source:** https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html


### expo-clipboard 57.0.1 covers the 'copy address' button
*confidence: high*

npm: expo-clipboard@57.0.1, MIT. Install: npx expo install expo-clipboard. Import: import * as Clipboard from 'expo-clipboard'. API: await Clipboard.setStringAsync(text) → Promise<boolean>; await Clipboard.getStringAsync() → Promise<string> (empty string if clipboard is empty or permission denied). Supported on Android, iOS, Web, and — unlike the map libraries — it works in Expo Go. Also relevant: expo-location@57.0.14 for the blue user-location pin.

**Source:** https://docs.expo.dev/versions/latest/sdk/clipboard/ ; https://registry.npmjs.org/expo-clipboard/latest


### Explicitly unverified
- The exact anti-scraping clause text in Loblaw's, Shoppers Drug Mart's and Rexall's Terms of Use — all three sites are client-rendered SPAs that returned 733, 1 and 85 characters of extractable text respectively, and shoppersdrugmart.ca/en/terms-conditions returned HTTP 403 to WebFetch. I verified their robots.txt files directly and verified that no official price API exists, but I could not quote the operative ToS sentence. Treat 'scraping violates ToS' as a strong presumption, not a verified quotation.
- Whether the ODB dispensing fee is still $8.83 and the private-plan cap still $11.99 in 2026 — these came from secondary sources (pharmacy blogs and a 2024-dated figure), not from the Ontario regulation itself. The 8%/6% mark-up split from O. Reg. 201/96 is better attested (Ontario regulatory registry posting) but I did not read the regulation text.
- The retailMultiplier that converts an ODB wholesale unit price into a plausible shelf price. I have no verified anchor for this — no public dataset gives a Canadian OTC shelf price, so any constant you pick is an assumption. Spot-check a few real products in a store and document the check.
- That @maplibre/maplibre-react-native 11.3.7 renders OpenFreeMap's positron style correctly on a real iOS and Android device. The style JSON, glyphs, sprite and TileJSON all resolve (verified over HTTP), and MapLibre Native consumes standard MVT, so it should work — but I did not build and run it.
- Stadia Maps' specific attribution wording for the free tier — the pricing page states the 200,000 credits/month and the commercial-use prohibition but does not spell out the attribution string.
- Whether expo-maps has left alpha in a version newer than the docs page I read. The docs at docs.expo.dev/versions/latest/sdk/maps/ still say alpha as of this research; re-check before committing.
- RAMQ's Liste des médicaments file formats. Searches surfaced only PDF editions (30 April 2026, 30 July 2026) and no XML/CSV extract, and it covers Quebec's plan rather than Ontario, so I did not pursue it. If someone claims RAMQ has a machine-readable price file, that is unconfirmed here.
- The exact free-tier field-mask tiering for Places Nearby Search (which specific field combinations bill as Pro vs Enterprise). Since no Essentials SKU exists for Nearby Search, the $32.00/1,000 floor holds regardless, but I did not read the choose-fields SKU mapping in detail.
- Total pharmacy count in Toronto from an authoritative registry (OCP), which would let you measure OSM's completeness against ground truth. OSM has 701; I could not obtain the OCP figure to compare.


## symptom-search


### openFDA indications_and_usage full-text search + generic_name faceting produces a clean ranked symptom→ingredient map; verified live for all 25 symptoms
*confidence: high*

Pattern: https://api.fda.gov/drug/label.json?search=indications_and_usage:"<symptom>" AND openfda.product_type:"HUMAN OTC DRUG"&count=openfda.generic_name.exact&limit=8 . Live results (Aug 2026 data, meta.last_updated 2026-08-28): headache → Acetaminophen(955), Ibuprofen(623), Naproxen Sodium(219), Aspirin(144). runny nose → Loratadine(338), Cetirizine HCl(244), Diphenhydramine HCl(192), Fexofenadine(109). heartburn → Calcium Carbonate(421), Bismuth Subsalicylate(211), Omeprazole(145), Famotidine(137), Esomeprazole Mg(69). constipation → Docusate Sodium(199), Bisacodyl(111), Sennosides(110), PEG 3350(90), Mg Hydroxide(88). athlete's foot → Tolnaftate(132), Clotrimazole(81), Miconazole Nitrate(72), Terbinafine(26). acne → Salicylic Acid(656), Benzoyl Peroxide(197), Sulfur(54), Adapalene(38). nasal congestion → Oxymetazoline(148). cough → Dextromethorphan/Guaifenesin combos. diarrhea → Bismuth Subsalicylate(226), Loperamide(82+63). motion sickness → Meclizine(38+30), Dimenhydrinate(31). cold sores → Docosanol(70). dry eyes → Carboxymethylcellulose Na(35). hemorrhoids → Witch Hazel(41), Pramoxine/Phenylephrine combos. NOTE the noise: homeopathics leak in (nausea → Chelidonium majus; motion sickness → Anamirta cocculus seed, Tobacco Leaf; diarrhea → Arsenic Trioxide) and MUST be filtered.

**Source:** https://api.fda.gov/drug/label.json?search=indications_and_usage:%22headache%22&limit=1 (13,445 total) plus 25 executed count queries


### openFDA exposes the FDA OTC monograph number (M001–M032) in openfda.application_number, and it is aggregatable
*confidence: high*

A TYLENOL Extra Strength label returns openfda.application_number: ["M013"]. Query https://api.fda.gov/drug/label.json?search=openfda.product_type:"HUMAN OTC DRUG" AND openfda.application_number:M*&count=openfda.application_number.exact&limit=40 returns the full distribution: M020 Sunscreen 7216, M012 Cold/Cough/Allergy 3912, M017 External Analgesic 3103, M003 First Aid Antiseptic 2321, M013 Internal Analgesic 1693, M019 Antiperspirant 1466, M016 Skin Protectant 1386, M006 Topical Acne 1101, M021 Anticaries 1036, M005 Topical Antifungal 1022, M007 Laxative 874, M022 Oral Health Care 822, M001 Antacid 743, M032 Dandruff 630, M018 Ophthalmic 512, M015 Anorectal 437, M004 First Aid Antibiotic 432, M028 Wart Remover 289, M010 Nighttime Sleep Aid 261, M002 Antiflatulent 258, M008 Antidiarrheal 227, M014 Topical Otic 135, M009 Antiemetic 117, M030 Corn/Callus 112, M011 Stimulant 74, M027 Menstrual 49, M031 Pediculicide 43, M024 Anthelmintic 18, M026 Deodorant 10, M023 Poison Treatment 6, M029 Ingrown Toenail 3. Data is dirty — stray values 'M'(111), 'M20'(11), 'M334'(3), 'M009.50'(6), 'M505G(a)(3)'(11) — so validate against the canonical M001–M032 list.

**Source:** https://api.fda.gov/drug/label.json?search=openfda.product_type:%22HUMAN+OTC+DRUG%22+AND+openfda.application_number:M*&count=openfda.application_number.exact


### The canonical FDA OTC monograph list M001–M032 is machine-readable and free from the Federal Register API
*confidence: high*

Federal Register doc 2021-20393 (published 2021-09-21), raw text at https://www.federalregister.gov/documents/full_text/text/2021/09/21/2021-20393.txt , 30,669 bytes, contains 'Table 1--OTC Monographs as Represented by Final Orders Deemed by Section 505G(b)(8)'. Full list: M001 Antacid (21 CFR 331); M002 Antiflatulent (332); M003 First Aid Antiseptic (no CFR); M004 First Aid Antibiotic (333B); M005 Topical Antifungal (333C); M006 Topical Acne (333D); M007 Laxative (no CFR); M008 Antidiarrheal (335); M009 Antiemetic (336); M010 Nighttime Sleep Aid (338); M011 Stimulant (340); M012 Cold, Cough, Allergy, Bronchodilator, and Antiasthmatic (341); M013 Internal Analgesic, Antipyretic, and Antirheumatic (343); M014 Topical Otic (344); M015 Anorectal (346); M016 Skin Protectant (347); M017 External Analgesic (348); M018 Ophthalmic (349); M019 Antiperspirant (350); M020 Sunscreen (352); M021 Anticaries (355); M022 Oral Health Care; M023 Poison Treatment; M024 Anthelmintic (357B); M025 Cholecystokinetic (357C); M026 Deodorant for Internal Use (357I); M027 Orally Administered Menstrual; M028 Wart Remover (358B); M029 Ingrown Toenail Relief (358D); M030 Corn and Callus Remover (358F); M031 Pediculicide (358G); M032 Dandruff/Seborrheic Dermatitis/Psoriasis (358H). Federal Register API is free, no key: https://www.federalregister.gov/api/v1/documents/2021-20393.json

**Source:** https://www.federalregister.gov/documents/full_text/text/2021/09/21/2021-20393.txt


### FDA OTC monograph categories are a poor PRIMARY symptom picker but an excellent SECOND-level grouping
*confidence: high*

M012 lumps cold + cough + allergy + bronchodilator + antiasthmatic into one bucket of 3,912 labels — a user with 'runny nose' and a user with 'cough' both land there, defeating the purpose. M013 lumps analgesic + antipyretic + antirheumatic. Conversely M019 Antiperspirant, M020 Sunscreen, M021 Anticaries and M026 Deodorant are not symptoms at all. Roughly 12 of the 32 monographs map 1:1 to a consumer symptom (M001 antacid→heartburn, M002→gas, M005→athlete's foot, M006→acne, M007→constipation, M008→diarrhea, M009→nausea, M010→insomnia, M015→hemorrhoids, M028→warts, M031→lice, M032→dandruff). Use the monograph as a facet/badge on results, not as the picker.

**Source:** Derived from the verified M001-M032 table and the openFDA per-monograph label counts above


### Health Canada DPD 'therapeuticclass' returns ATC only — NO AHFS codes
*confidence: high*

GET https://health-products.canada.ca/api/drug/therapeuticclass/?lang=en&type=json&id=5254 → [{"drug_code":5254,"tc_atc_number":"N02BE01","tc_atc":"ACETAMINOPHEN (PARACETAMOL)"}]. Exactly three fields: drug_code, tc_atc_number, tc_atc. The official docs (https://health-products.canada.ca/api/documentation/dpd-documentation-en.html) confirm parameters are id (required), lang, type — and confirm only those three response fields. No AHFS anywhere in the DPD API. Omitting the id parameter returns the FULL dataset: 48,027 rows, 3.75 MB, 2,659 distinct ATC codes — usable as a one-shot bulk load. Note the din= parameter is silently ignored and also returns the full dump.

**Source:** https://health-products.canada.ca/api/drug/therapeuticclass/?lang=en&type=json&id=5254


### ATC covers 88.6% of Canadian non-prescription products and its level-2/3 groups do align usefully with symptom classes
*confidence: high*

Full-dump analysis: DPD schedule endpoint returns 59,211 rows; 23,760 distinct drug_codes are 'NON-PRESCRIPTION DRUGS'; 21,042 of those (88.6%) carry an ATC code. Top ATC level-2 groups among Canadian OTC: D02 (5,897 - UV protectives/sunscreen), V07 (3,719 - technical disinfectants), A11 (2,614 - vitamins), N02 (1,378 - analgesics), D08 (1,197 - antiseptics), D11 (903), R05 (549 - cough/cold), A06 (544 - laxatives), R06 (352 - antihistamines), S01 (255 - ophthalmic), R01 (246 - nasal), A02 (239 - acid/antacid), D10 (216 - acne), M02 (205 - topical analgesic), M01 (201 - NSAIDs), A07 (157 - antidiarrheal). Useful ATC anchors: N02B analgesic, M01A NSAID, R06A antihistamine, R01A/R01B decongestant, R05C expectorant, R05D cough suppressant, A02A antacid, A02BC PPI, A06A laxative, A07D/A07B antidiarrheal, A03F/N07C antiemetic, D01A topical antifungal, D10A acne, S01X artificial tears.

**Source:** Computed from https://health-products.canada.ca/api/drug/schedule/?lang=en&type=json and .../therapeuticclass/?lang=en&type=json full dumps


### ATC alone CANNOT power a symptom picker — it is an anatomical/chemical axis, not an indication axis
*confidence: high*

Concrete failures: ibuprofen is M01AE01 (antirheumatic/musculoskeletal) while acetaminophen is N02BE01 (nervous system/analgesic) — the two most common headache products sit in different ATC top-level branches. Diphenhydramine is R06AA02 (respiratory antihistamine) but is also THE Canadian OTC sleep aid and THE topical antipruritic — one ATC code, three unrelated symptoms. Magnesium hydroxide is simultaneously an antacid and a laxative. ATC is 1 code per product and is assigned by chemistry+organ, so it cannot express the many-to-many symptom relation. Use ATC as a validation/QA cross-check on a curated map, never as the map.

**Source:** Verified codes from DPD therapeuticclass dump (N02BE01, M01AE01, R06AA02 confirmed present)


### RxClass may_treat exists, is free, and is DANGEROUS for OTC self-care — do not use it
*confidence: high*

Endpoints work: https://rxnav.nlm.nih.gov/REST/rxclass/class/byName.json?className=Headache → {classId:'D006261', classType:'DISEASE'}; then https://rxnav.nlm.nih.gov/REST/rxclass/classMembers.json?classId=D006261&relaSource=MEDRT&rela=may_treat . Actual returned members for Headache (all 19): octopamine, belladonna alkaloids, naproxen sodium, acetanilide, octopamine HCl, acetylcholine, butalbital, acetylcholine chloride, doxylamine succinate, phenylalanine DL-, doxylamine succinate (R)-, belladonna leaf extract, doxylamine, sodium benzoate, meprobamate, naproxen, phenylalanine, belladonna extract USP, quercetin. Acetaminophen and ibuprofen are ABSENT. Fever (D005334, n=26) returns ceftazidime, meropenem, cefepime, ciprofloxacin (febrile-neutropenia indications). Cough (D003371, n=44) returns codeine, hydrocodone, hydromorphone, cocaine. Constipation (D003248, n=73) returns linaclotide, naloxegol, plecanatide, tegaserod (all Rx). Nasal Obstruction (D015508) returns only 2 members (xylometazoline) — no pseudoephedrine, no phenylephrine. Allergic Rhinitis (D065631, n=124) is dominated by Rx steroids and montelukast. relaSources available: ATC, ATCPROD, CDC, DAILYMED, FDASPL, FMTSME, MEDRT, RXNORM, SNOMEDCT, VA. classTypes: ATC1-4, CHEM, CVX, DISEASE, DISPOS, EPC, MOA, PE, PK, SCHEDULE, STRUCT, TC, VA.

**Source:** https://rxnav.nlm.nih.gov/REST/rxclass/classMembers.json?classId=D006261&relaSource=MEDRT&rela=may_treat (and 8 further executed queries)


### openFDA 'purpose' is full-text searchable but NOT aggregatable — a real constraint on using the standardized Drug Facts Purpose section
*confidence: high*

search=purpose:"antihistamine" works → 7,412 results; purpose:"antacid" → 1,796; purpose:"pain reliever" → 13,096. But count=purpose returns HTTP error: '[illegal_argument_exception] Text fields are not optimised for operations that require per-document field data like aggregations and sorting... Please use a keyword field instead.' There is no purpose.exact subfield. So you can FILTER by purpose but cannot enumerate the purpose vocabulary from the API — you would have to download the 14 bulk partitions (~1.9 GB zipped total, 20,000 records each, listed at https://api.fda.gov/download.json) and aggregate locally. Purpose values are also un-normalized free text ('Purpose Antihistamine Antitussive Nasal Decongestant' as one string).

**Source:** https://api.fda.gov/drug/label.json?search=openfda.product_type:%22HUMAN+OTC+DRUG%22&count=purpose (error) and purpose: search queries


### openFDA carries the full regulated Drug Facts safety text as separate structured fields — the app should render these verbatim rather than author its own warnings
*confidence: high*

Verified record counts among HUMAN OTC DRUG labels using _exists_: warnings 49,916; keep_out_of_reach_of_children 49,898; purpose 49,912; inactive_ingredient 49,912; dosage_and_administration 49,927; active_ingredient 49,624; stop_use 29,841; when_using 23,460; do_not_use 22,766; pregnancy_or_breast_feeding 18,552; ask_doctor 17,345; ask_doctor_or_pharmacist 9,097. Live ibuprofen example — do_not_use: 'Do not use if you have ever had an allergic reaction to any other pain reliever/fever reducer, right before or after heart surgery'; stop_use: '...signs of stomach bleeting: feel faint, bloody or black stools, vomit blood... pain gets worse or lasts more than 10 days, fever gets worse or lasts more than 3 days'.

**Source:** https://api.fda.gov/drug/label.json?search=_exists_:stop_use+AND+openfda.product_type:%22HUMAN+OTC+DRUG%22 (12 field queries executed)


### The regulated red-flag / referral thresholds already exist inside monograph label text — they do not need to be invented
*confidence: high*

Pulled live from openFDA by monograph. M001 antacid: 'Stop use and ask a doctor if symptoms last more than two weeks.' M008 antidiarrheal (bismuth subsalicylate): 'Ask a doctor before use if you have fever, mucus in the stool'; 'Stop use and ask a doctor if symptoms get worse or last more than 2 days, ringing in the ears or loss of hearing occurs, diarrhea lasts more than 2 days.' M007 laxative (bisacodyl): 'Ask a doctor before use if you have noticed a sudden change in bowel habits that lasts over a period of 2 weeks'; 'Stop use and ask a doctor if you have rectal bleeding, you fail to have a bowel movement after using this product. This may indicate a serious condition.' M012 cold/cough: 'Ask a doctor before use if you have persistent or chronic cough such as occurs with smoking, asthma, or emphysema, cough accompanied by excessive phlegm'; 'Stop use and ask doctor if cough persists for more than 7 days, tends to recur, or is accompanied by fever, rash, or persistent headache. These could be signs of a serious condition.' M013 analgesic: pain >10 days (adults), fever >3 days.

**Source:** https://api.fda.gov/drug/label.json?search=openfda.application_number:%22M001%22+AND+_exists_:stop_use (5 monograph queries executed)


### Health Canada publishes 23 non-prescription drug Labelling Standards — the citable Canadian authority for symptom→ingredient claims
*confidence: high*

Index at https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/applications-submissions/guidance-documents/nonprescription-drugs-labelling-standards.html (page updated 2026-03-30). Full list with dates: Acetaminophen [2016-09-15]; Acetylsalicylic Acid [2013-10-17]; Adult Cough, Cold and Flu [2025-04-01]; Anorectal Drug Products [1994-09-01]; Antacids [1994-07-24]; Anthelmintics [1996-05-17]; Antiflatulents [1996-07-19]; Antifungals (topical) [1995-01-30]; Bismuth Subsalicylate [1996-05-17]; Oral Paediatric Cough and Cold [2009-02-06]; Cyproheptadine [1992-08-14]; Dimenhydrinate [1994-12-01]; Laxatives: Bulk Forming [2012-07-09]; Laxatives: General [1994-09-01]; Laxatives: Lactulose [1994-09-01]; Laxatives: Lubricant [1994-09-01]; Laxatives: Stimulant [1997-10-03]; Laxatives: Stool Softener [2015-07-28]; Sleep Aids [1993-07-12]; Topical Anaesthetic/Analgesic/Antipruritic [2015-07-29]; Topical Antibiotics [1992-11-19]; Topical Nasal Decongestants [2014-05-30]; Triethanolamine Salicylate (Trolamine) [1995-09-13]. Each states 'permissible conditions of use... such as dose, intended use, directions for use, warnings, active ingredients'. Sub-page URL pattern: .../nonprescription-drugs-labelling-standards/<slug>.html . Example verified indication wording: topical nasal decongestants = oxymetazoline HCl or xylometazoline HCl 'for use in adults to relieve nasal congestion'; oral adult antitussive = dextromethorphan 'to relieve dry cough due to cold'; stool softener = docusate sodium/calcium 'for use in adults and children 6 years of age and older'.

**Source:** https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/applications-submissions/guidance-documents/nonprescription-drugs-labelling-standards.html


### Health Canada also has 8 Category IV Monographs covering the topical/lozenge categories
*confidence: high*

Sunscreen; Acne Therapy; Anti-Dandruff Products; Antiseptic Skin Cleansers; Athlete's Foot Treatments; Medicated Skin Care Products; Diaper Rash Products; Throat Lozenges. Index: https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/applications-submissions/guidance-documents/non-prescription-drugs-category-iv-monographs.html . Open Government Licence – Canada; dataset record at https://open.canada.ca/data/en/dataset/63c2c89a-f442-4f49-8339-558312b86ebb offers HTML only (no CSV/JSON). These 'outline the permissible conditions of use and labelling requirements, such as dose, intended use, directions for use, warnings, active ingredients and combinations thereof.' Together with the 23 Labelling Standards these cover ~20 of the 22 symptoms in the proposed taxonomy.

**Source:** https://open.canada.ca/data/en/dataset/63c2c89a-f442-4f49-8339-558312b86ebb


### DPD 'schedule' endpoint gives a clean OTC filter AND a clean homeopathic exclusion — solving the noise problem seen in openFDA
*confidence: high*

GET https://health-products.canada.ca/api/drug/schedule/?lang=en&type=json&id=5254 → [{"drug_code":5254,"schedule_name":"NON-PRESCRIPTION DRUGS"}]. Full-dump distribution across 59,211 rows: NON-PRESCRIPTION DRUGS 23,760; PRESCRIPTION 23,188; HOMEOPATHIC 5,571; ETHICAL 2,459; SCHEDULE D 1,907; NARCOTICS (CDSA I) 932; TARGETED SUBSTANCES (CDSA IV) 438; blank 330; CONTROLLED DRUGS (CDSA IV) 180; SCHEDULE C 162; CONTROLLED (CDSA I) 140; CONTROLLED (CDSA III) 106; NARCOTICS (CDSA II) 18; PRESCRIPTION RECOMMENDED 14; COVID-19 IO AUTHORIZATION 6. Filter rule: schedule_name == 'NON-PRESCRIPTION DRUGS' AND schedule_name != 'HOMEOPATHIC'.

**Source:** https://health-products.canada.ca/api/drug/schedule/?lang=en&type=json


### End-to-end symptom→Canadian-product pipeline verified against 2,840 marketed non-prescription DINs
*confidence: high*

DPD status endpoint full dump: 13,345 drug_codes have status 'Marketed'. Intersected with the 23,760 non-prescription codes → 2,840 marketed Canadian OTC products. Matching a curated ingredient-token list against the activeingredient dump (16 MB) gives product counts per symptom: Minor cuts/antiseptic 815, Headache 312, Menstrual cramps 281, Fever 274, Runny nose/allergies 154, Nasal congestion 153, Cough 141, Insomnia 103, Dandruff 75, Acne 70, Constipation 66, Sore throat 65, Muscle/joint pain 62, Hemorrhoids 58, Athlete's foot 46, Dry eyes 42, Diarrhea 29, Itchy skin 16, Nausea/motion sickness 15, Heartburn 13, Gas/bloating 13, Cold sores 0. The two zero/low buckets are a real caveat: cold-sore docosanol and many antacids are marketed in Canada under other schedules or as NHPs, and the 'Marketed' status filter is aggressive — relax to include status 'Approved' and match ai_group_no as well.

**Source:** Computed locally from four DPD full dumps (schedule, status, activeingredient, therapeuticclass)


### Health Canada's LNHPD API exposes a Canadian 'purpose' (indication) field — the only Canadian machine-readable indication text that exists
*confidence: high*

Base https://health-products.canada.ca/api/natural-licences/ . GET /productpurpose/?lang=en&type=json&page=1 → {metadata:{pagination:{limit:100, total:162255}}, data:[{text_id, lnhpd_id, purpose}]}. GET /productrisk/?lang=en&type=json&page=1 → total 261,734, fields {lnhpd_id, risk_id, risk_type_desc, sub_risk_type_desc, risk_text}; risk_type_desc values include 'Cautions and Warnings' and 'Contra-Indications' (e.g. 'If symptoms persist consult a health care practitioner.', 'Do not use if pregnant or breastfeeding.'). Other endpoints: /medicinalingredient/, /nonmedicinalingredient/, /productdose/, /productlicence/, /productroute/. CAVEAT: purpose text is noisy free text, mixes English and French in the same field, and contains junk values ('N/A', 'For oral use only.'); the corpus is dominated by supplements, not OTC drugs. Paginating all 162,255 purposes at 100/page = 1,623 requests.

**Source:** https://health-products.canada.ca/api/natural-licences/productpurpose/?lang=en&type=json&page=1


### Licensing and rate limits: everything needed is free, no keys required for the Canadian sources
*confidence: high*

openFDA: CC0 1.0 Universal public domain, no attribution required, commercial use permitted, 'should not imply endorsement'; rate limits 240 req/min + 1,000 req/day per IP without a key, 240 req/min + 120,000 req/day with a free key passed as ?api_key= or HTTP Basic username (https://open.fda.gov/apis/authentication/, https://open.fda.gov/license/). Health Canada DPD and LNHPD: Open Government Licence – Canada, monthly updates, no API key, no documented rate limit or terms in the API docs. RxNav/RxNorm/RxClass: free, max 20 requests/second per IP, no UMLS licence needed for most APIs BUT RxClass incorporates SNOMED CT and is therefore subject to a SNOMED CT Affiliate licence via the UMLS agreement; NLM attribution statement required; NLM recommends caching 12–24 h; RxNav-in-a-Box (Docker) available for high volume. Federal Register API: free, no key, US Government public domain.

**Source:** https://open.fda.gov/license/ , https://open.fda.gov/apis/authentication/ , https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html , https://open.canada.ca/data/en/dataset/bf55e42a-63cb-4556-bfd8-44f26e5a36fe


### SNOMED CT / ICD-10 / MeSH: overkill for 22 symptoms; SNOMED is free in Canada but adds licence obligations for no benefit
*confidence: high*

SNOMED CT: Canada is a member territory — SNOMED CT CA is available at no cost to Canadian organizations via a free Canada Health Infoway account, requiring annual acceptance of the Terms of Use and Licence Agreement (infocentral.infoway-inforoute.ca/en/standards/standards-access). ICD-10-CA: maintained by CIHI, licensed/paid, and is a morbidity-coding classification for hospital abstracting — wrong tool entirely. MeSH: free, public domain from NLM, and its descriptor IDs are already the identifiers RxClass uses (D006261 Headache, D003371 Cough, D006356 Heartburn, D003248 Constipation, D003967 Diarrhea, D005334 Fever, D015508 Nasal Obstruction, D065631 Allergic Rhinitis, D003139 Common Cold, D010146 Pain). Recommendation: store the MeSH descriptor ID as an optional cross-reference column on each curated symptom row (free, zero obligation, future-proofs analytics); skip SNOMED and ICD-10 entirely.

**Source:** https://infocentral.infoway-inforoute.ca/en/standards/standards-access and MeSH IDs returned live by https://rxnav.nlm.nih.gov/REST/rxclass/class/byName.json


### Health Canada's SaMD guidance has an explicit exclusion that a label-surfacing product finder can sit inside — and it names patients, not just clinicians
*confidence: medium*

Health Canada considers clinical/patient decision support software NOT to be a medical device when it meets ALL FOUR criteria: (1) not intended to acquire, process or analyze a medical image or a signal from an IVDD or a pattern/signal from a signal acquisition system; (2) intended to display, analyze or print medical information about a patient or other medical information (such as demographic information, DRUG LABELING, clinical guidelines, studies, or recommendations); (3) only intended to SUPPORT a health care professional, PATIENT or non-healthcare-professional caregiver in making decisions about prevention, diagnosis or treatment; (4) not intended to replace the clinical judgment of healthcare professionals. Health Canada notes these 'are only intended to serve as a foundation for an analysis... and should not be interpreted as a rigid set of exclusion factors.' Criterion (2) explicitly naming 'drug labeling' and criterion (3) explicitly naming 'patient' is the regulatory basis for MediSense's symptom search: it displays drug labelling and supports a decision; it must never assert a diagnosis.

**Source:** https://www.canada.ca/en/health-canada/services/drugs-health-products/public-involvement-consultations/medical-devices/software-medical-device-draft-guidance/document.html (via search; page itself returns 403 to automated fetch)


### Apple App Review guidelines 1.4.1 and 1.4.2 constrain what the app may do
*confidence: high*

1.4.1 Physical Harm, verbatim: 'Medical apps that could provide inaccurate data or information, or that could be used for diagnosing or treating patients may be reviewed with greater scrutiny. Apps must clearly disclose data and methodology to support accuracy claims relating to health measurements, and if the level of accuracy or methodology cannot be validated, we will reject your app... Apps should remind users to check with a doctor in addition to using the app and before making medical decisions. If your medical app has received regulatory clearance, please submit a link to that documentation with your app.' 1.4.2: 'Drug dosage calculators must come from the drug manufacturer, a hospital, university, health insurance company, pharmacy or other approved entity, or receive approval by the FDA or one of its international counterparts.' PRACTICAL CONSEQUENCE: MediSense must (a) cite its data sources on-screen, (b) show a 'check with a pharmacist or doctor' reminder, and (c) NOT build a dose calculator — display the label's dosage text verbatim only.

**Source:** https://developer.apple.com/app-store/review/guidelines/


### Comparable-app disclaimer language, verbatim
*confidence: high*

WebMD Symptom Checker (symptoms.webmd.com): 'This tool does not provide medical advice. It is intended for informational purposes only. This tool may leverage certain generative artificial intelligence tools to generate results, and is not a substitute for professional medical advice, diagnosis or treatment. Never ignore professional medical advice in seeking treatment because of something you have read on the WebMD Site. If you think you may have a medical emergency, immediately call your doctor or dial 911.' Note WebMD gates the tool behind age + sex entry before showing any result. openFDA's own mandatory disclaimer, returned in every API response meta block: 'Do not rely on openFDA to make decisions regarding medical care. While we make every effort to ensure that data is accurate, you should assume all results are unvalidated.'

**Source:** https://symptoms.webmd.com/ and https://api.fda.gov/drug/label.json meta.disclaimer


### Canadian paediatric red flag: no OTC cough and cold products under age 6
*confidence: high*

On 2008-12-18 Health Canada announced that orally administered OTC cough and cold products with certain active ingredients (including first-generation antihistamines such as diphenhydramine, chlorpheniramine, doxylamine, plus decongestants, antitussives and expectorants) should not be used in children under 6 years of age; manufacturers were required to relabel by fall 2009. Health Canada's 'Non-prescription Oral Paediatric Cough and Cold Labelling Standard' [2009-02-06] encodes this. This is a hard, Canada-specific interstitial rule the app must implement.

**Source:** https://www.healthycanadians.gc.ca/recall-alert-rappel-avis/hc-sc/2008/13267a-eng.php and https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/applications-submissions/guidance-documents/nonprescription-drugs-labelling-standards/nonprescription-oral-paediatric-cough-cold-labelling-standard.html


### Red-flag referral framework for pharmacy self-care triage (REDS)
*confidence: medium*

Widely taught pharmacy triage mnemonic: Rapid onset (sudden severe symptoms suggesting acute pathology); Extremes of age (very young or elderly — lower referral threshold); Duration (symptoms beyond the expected self-limiting timeframe); Systemic features (fever, weight loss, night sweats, malaise). Specific referral triggers named in the pharmacy literature: central crushing chest tightness radiating to back/jaw; sudden severe abdominal pain radiating to back; haemoptysis; cough >3 weeks especially with fatigue and weight loss; severe headache with photophobia; unexplained weight loss; new muscle weakness; fever with ear pain and erythema behind the ear; sudden change in bowel habit in older adults.

**Source:** https://pharmaceutical-journal.com/article/ld/how-to-identify-red-flag-symptoms-and-refer-patients-appropriately


### Explicitly unverified
- The verbatim text of Health Canada's SaMD four exclusion criteria from the primary canada.ca source — canada.ca returned 403 to every automated fetch; the wording quoted comes from secondary summaries of the guidance document.
- The exact permitted indication/'use' wording inside each individual Health Canada Labelling Standard and Category IV Monograph (Antacids, Sleep Aids, Antifungals topical, Throat Lozenges, Acne Therapy, etc.) — only the Topical Nasal Decongestants, Oral Adult Antitussive and Stool Softener wordings were surfaced, and those came from search snippets rather than a fetched page. The titles, dates and URLs ARE verified from the fetched index page.
- Whether Health Canada's Category IV Monograph list is still exactly 8 documents as of 2026 — the '8 monographs' figure traces to a 2014–2016 attestation pilot description; the index page itself could not be fetched.
- Whether openFDA's openfda.application_number monograph assignment is complete or authoritative — it appears to be publisher-supplied SPL metadata, and the dirty values suggest it is not validated by FDA on ingest.
- The DPD API's rate limits, terms of use and API-key policy — the official documentation page contains no statement on any of these. The Open Government Licence – Canada is confirmed for the dataset via open.canada.ca, but no API-specific terms exist.
- Whether LNHPD /productpurpose/ supports any server-side text search parameter — only id, lang, page and type are documented, implying you must paginate all 1,623 pages to build a searchable index locally.
- Drugs.com's specific symptom-checker disclaimer wording — searches surfaced only WebMD's, which is quoted verbatim.
- Exact CAD retail pricing for any of these products — no Canadian OTC price API was in scope for this dimension; the price field the ranking depends on is assumed to come from another workstream (and is very likely to require synthesis).
- Google Play's medical/health app policy equivalents to Apple's 1.4.1 and 1.4.2 — not fetched.
- Whether the 2,840 marketed-OTC figure is stable; it depends on the 'Marketed' status filter, and DPD's status semantics (Approved vs Marketed vs Dormant) were not independently validated against a known product list.


## barcode-ocr


### Health Canada DPD packaging endpoint exposes a `upc` field that is empty in 100% of records
*confidence: high*

GET https://health-products.canada.ca/api/drug/packaging/?type=json returns 58,239 records with shape {drug_code, upc, package_size_unit, package_type, package_size, product_information}. I downloaded the full dataset and counted: 0 records with a non-empty `upc`, 0 with non-empty `package_size`, `package_size_unit` or `package_type`. Only `product_information` is populated (44,660 records), holding strings like "2/50/100/130/150/200/230/325". Single-record example: /packaging/?id=5255 (TYLENOL EXTRA STRENGTH, DIN 00559393) returns {"drug_code":5255,"upc":"","package_size_unit":"","package_type":"","package_size":"","product_information":"2/50/100/130/150/200/230/325"}. The API docs state: "As of May 1, 2025 this information will now appear in the product_information field" and UPC values were removed. No auth, no documented rate limit, json/xml via ?type=.

**Source:** https://health-products.canada.ca/api/drug/packaging/?type=json (live download, 6.9 MB) + https://health-products.canada.ca/api/documentation/dpd-documentation-en.html


### The DPD historical bulk download confirms UPC was never usefully populated
*confidence: high*

allfiles.zip (https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/dhp-mps/alt_formats/zip/prodpharma/databasdon/allfiles.zip) contains package.txt with 15,804 rows and 6 columns. Column 2 (the UPC column) is non-empty in exactly 4 rows, and those 4 contain junk ('2X', '100', '5', '5') rather than barcodes. So this is not a recent regression — Health Canada has never shipped usable barcode data.

**Source:** https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/dhp-mps/alt_formats/zip/prodpharma/databasdon/allfiles.zip (live download + parse)


### The NDC-to-GTIN-12 embedding is real and I verified it arithmetically against a real product
*confidence: high*

Rule: GTIN-12 = '3' + the 10-digit NDC (labeler+product+package) + GS1 mod-10 check digit. GTIN-14 = indicator digit '0' + 10-digit NDC + check digit. Mechanism: FDA labeler code is registered with GS1 US as a GS1 Company Prefix that always begins with 0; stripping that leading 0 yields a U.P.C. Company Prefix beginning with 3 (5 digits from a 4-digit labeler code, 6 digits from a 5-digit one). Verification: I computed '3' + '0045044910' + check → 300450449108, and openFDA independently returns openfda.upc = ['0300450449108'] for product_ndc 50580-449 (TYLENOL Extra Strength, Kenvue Brands LLC) and 67414-449. So a 12-digit code starting with '3' can be decoded to an NDC with zero API calls.

**Source:** https://www.rxtrace.com/2012/01/depicting-an-ndc-within-a-gtin.html/ + live check-digit computation + https://api.fda.gov/drug/ndc.json?search=openfda.upc:"0300450449108"


### The NDC-in-barcode trick does not apply to Canadian packages, and FDA is deprecating it anyway
*confidence: high*

Canada has no NDC — Canadian OTC packages carry ordinary GS1-Canada-assigned company prefixes with no drug identifier embedded (e.g. 062600 = Kenvue/McNeil Canada, 057800 = Loblaw/Shoppers Life Brand, 064541 = another Tylenol line). None begin with '3'. Separately, FDA's proposed 12-digit NDC format (Federal Register 2022-15414) cannot be embedded in a GTIN-12 or GTIN-14 at all; GS1 US created Application Identifier (75) to carry the NDC instead, which UPC-A retail symbols cannot express.

**Source:** https://www.federalregister.gov/documents/2022/07/25/2022-15414/revising-the-national-drug-code-format-and-drug-label-barcode-requirements + observed Canadian UPC prefixes


### openFDA NDC Directory is free, has real UPC data, but is US-only and requires a zero-padded 13-digit query
*confidence: high*

Base: https://api.fda.gov/drug/ndc.json. Field is `openfda.upc` (array of strings). Counts as of meta.last_updated 2026-08-28: 137,590 total records; 56,618 product_type:"HUMAN OTC DRUG"; 16,718 OTC records with _exists_:openfda.upc (29.5%); 38,629 records overall with a UPC. CRITICAL GOTCHA I verified: values are stored 13-digit zero-padded — search=openfda.upc:"300450449108" returns NOT_FOUND while search=openfda.upc:"0300450449108" returns the two Tylenol records. Other useful fields: product_ndc, brand_name, generic_name, labeler_name, active_ingredients[{name,strength}], dosage_form, route, packaging[{package_ndc,description}], openfda.rxcui, openfda.unii. Rate limits: 240 req/min + 1,000 req/day per IP with no key; 240/min + 120,000/day with a free key passed as ?api_key=. No aggregation on openfda.upc (it is a text field, count= returns an illegal_argument_exception).

**Source:** https://api.fda.gov/drug/ndc.json (multiple live queries) + https://open.fda.gov/apis/authentication/


### A real Canadian OTC drug UPC returns NOT_FOUND in openFDA
*confidence: high*

Canadian Tylenol Extra Strength 500mg (Shoppers Drug Mart variantCode 062600142290): https://api.fda.gov/drug/ndc.json?search=openfda.upc:"0062600142290" → {"error":{"code":"NOT_FOUND"}}. Confirms openFDA cannot resolve Canadian retail packages.

**Source:** https://api.fda.gov/drug/ndc.json?search=openfda.upc:"0062600142290"


### UPCitemdb has a keyless free tier of 100 lookups/day, but only ~33% coverage of Canadian brand-name drugs and 0% of Canadian store-brand generics
*confidence: high*

Endpoint: GET https://api.upcitemdb.com/prod/trial/lookup?upc=<12 or 13 digits>, no signup, no key. Response headers observed live: X-RateLimit-Limit: 100, X-RateLimit-Remaining. Documented FREE tier: 100 combined lookups/day, 20 searches/day, burst 6/min lookup, sustained 1 per 10s, 1 concurrent connection, batch of 2 UPCs. DEV: 20,000 lookups + 2,000 searches/day, burst 15/30s, batch 10, at https://api.upcitemdb.com/prod/v1/lookup. PRO: 150,000 lookups + 20,000 searches/day, 12/second burst. COVERAGE TEST — Canadian national brands: 062600142290 HIT ('Tylenol Tylenol Extra Strength 500Mg, 150 Caplets', brand 'Johnson & Johnson Inc'), 062600142641 HIT, 062600380050 MISS, 062600650474 MISS, 064541319854 MISS, 056500001108 MISS → 2/6. Canadian store-brand generics (Shoppers Life Brand): 057800974116 MISS, 057800109570 MISS, 057800973591 MISS, 057800826460 MISS → 0/4. Even on a hit the payload has no DIN, no active ingredient and no Canadian price — just a marketing title, brand string, category and stale US retailer offers.

**Source:** https://api.upcitemdb.com/prod/trial/lookup (10 live lookups) + https://www.upcitemdb.com/wp/docs/main/development/plan/


### Open Food Facts and Open Products Facts are unusable for medicines
*confidence: high*

Open Products Facts holds 45,010 products total; filtering categories_tags_en=medicines yields exactly 112 products, mostly Indian and Dutch. Querying a US Tylenol code against OPF returns status 0 'product found with a different product type: food'. Open Food Facts does have 0300450449108 (product_name 'Tylenol extra strength', countries en:united-states, all other fields blank) and 0062600142290 (product_name 'Tynelol' — a crowd-sourced typo, countries en:canada, no brand, no ingredients). All 5 Canadian codes I tested for the generics were 'product not found' in OFF. There is no Open Medicine Facts project.

**Source:** https://world.openproductsfacts.org/api/v2/search?categories_tags_en=medicines + https://world.openfoodfacts.org/api/v2/product/*.json (live)


### Go-UPC pricing has no free tier
*confidence: high*

Developer $74.95/month for 5,000 API requests/month; Startup $245/month for 45,000; Enterprise $795/month for 450,000. JSON only. A trial key can be requested but no free usage allowance is published. Overage pricing not disclosed.

**Source:** https://go-upc.com/plans


### GEPIR is dead; Verified by GS1 has no free API
*confidence: medium*

GEPIR (the old free SOAP GTIN→company lookup, 20-30 requests/day per country) was retired at end of December 2023 and replaced by Verified by GS1. Verified by GS1 web search allows roughly 30 free searches; programmatic/batch access is via GS1 US Data Hub starting at $500/year for unlimited lookups. Even then it returns brand/company/product description and image — never a DIN, ingredient list or price. Individual GTIN licensing from GS1 US is $30 one-time per GTIN (relevant only if you were publishing your own products).

**Source:** https://www.gs1.org/services/verified-by-gs1 + https://www.gs1us.org/tools/gs1-company-database-gepir + https://en.wikipedia.org/wiki/GEPIR


### Nutritionix is food-only and effectively paid
*confidence: medium*

The UPC lookup path is GET /v2/search/item on developer.nutritionix.com, explicitly scoped to branded grocery/food items and restaurant menus, not pharmaceuticals. The historic open free trial has been withdrawn due to abuse; a limited 'Hacker' free plan with a small daily allowance and mandatory attribution remains, with the paid starter pack reported at $299/month. Not applicable to MediSense.

**Source:** https://developer.nutritionix.com/docs/v2/search + https://calorieapi.com/blog/nutritionix-api-pricing


### expo-barcode-scanner is removed; expo-camera is the replacement
*confidence: high*

expo-barcode-scanner was deprecated in Expo SDK 50 and removed in SDK 52 (Nov 2024). Its last npm publish is 13.0.1 on 2024-04-23 — abandoned. Migration: `import { CameraView, Camera } from 'expo-camera'`; `BarCodeScanner.requestPermissionsAsync()` → `Camera.requestCameraPermissionsAsync()`; `onBarCodeScanned` → `onBarcodeScanned` plus a `barcodeScannerSettings={{barcodeTypes:[...]}}` prop; `BarCodeScanner.scanFromURLAsync` → `Camera.scanFromURLAsync`.

**Source:** https://github.com/expo/fyi/blob/main/barcode-scanner-to-expo-camera.md + https://expo.dev/changelog/2024-11-12-sdk-52


### expo-camera 57.0.4 supports 13 symbologies on every platform including Expo Go and web
*confidence: high*

Current versions from the npm registry: expo 57.0.18 (2026-08-28), expo-camera 57.0.4 (2026-08-20), SDK 57 = React Native 0.86, released 2026-06-30. barcodeTypes on all platforms: 'aztec','ean13','ean8','qr','pdf417','upc_e','datamatrix','code39','code93','itf14','codabar','code128','upc_a'. Platform support table: Android ✓ (device only), iOS ✓ (device only), Web ✓, Expo Go ✓. BarcodeScanningResult = {type, data, raw? (Android), cornerPoints, bounds:{origin,size}, extra? (Android)}. Corner-point ordering differs per platform: Android/Web topLeft,topRight,bottomRight,bottomLeft; iOS bottomLeft,bottomRight,topLeft,topRight. Android uses Google ML Kit; iOS uses AVFoundation + ZXingObjC. There is also launchScanner()/dismissScanner() which uses DataScannerViewController on iOS 16+ and Google's code scanner on Android — on Android it auto-dismisses, on iOS you must call dismissScanner().

**Source:** https://docs.expo.dev/versions/latest/sdk/camera/ + https://registry.npmjs.org/expo-camera + https://raw.githubusercontent.com/expo/expo/main/packages/expo-camera/src/Camera.types.ts


### expo-camera's config plugin has a barcodeScannerEnabled flag that has bitten people on iOS
*confidence: high*

From packages/expo-camera/plugin/src/withCamera.ts: props are cameraPermission, microphonePermission, recordAudioAndroid (default true) and barcodeScannerEnabled (default true). Setting it false writes the key 'expo.camera.barcode-scanner-enabled' = 'false' into Podfile.properties.json and gradle.properties to strip ZXingObjC and shrink the app. Docs note that on Android with prebuilt modules the flag has no effect unless you add expo-camera to `buildFromSource` in package.json. Issue expo/expo#44491 (SDK 55) reported barcode scanning silently disabled on iOS because ZXingObjC was not linked when the property was absent, compounded by expo-build-properties useFrameworks:"static" — now CLOSED via PR #44635.

**Source:** https://raw.githubusercontent.com/expo/expo/main/packages/expo-camera/plugin/src/withCamera.ts + https://github.com/expo/expo/issues/44491


### Expo web barcode scanning works in every browser because expo-camera ships a ZXing-wasm polyfill
*confidence: high*

expo-camera 57.0.4's only runtime dependency is barcode-detector ^3.0.0 (latest 3.2.2, 2026-08-16, which depends on zxing-wasm 3.1.3). Source of packages/expo-camera/src/web/WebBarcodeScanner.ts: it uses globalThis.BarcodeDetector when defined, otherwise `const { BarcodeDetector } = await import('barcode-detector')`. It maps expo names to web format strings (code39→code_39, ean13→ean_13, itf14→itf, qr→qr_code, datamatrix→data_matrix, etc.). This matters because native BarcodeDetector support is poor: per MDN browser-compat-data, Chrome 88+ is ChromeOS and macOS ONLY (partial_implementation), Chrome Android 83+ full, Edge 83+ macOS only, Opera 69+ macOS only, Firefox not supported (bugzil.la/1553738), Safari 17 only behind the 'Shape Detection API' preference, Safari iOS mirrors that. Without the polyfill, web scanning would fail on iOS Safari, Firefox, and Chrome on Windows/Linux.

**Source:** https://raw.githubusercontent.com/expo/expo/main/packages/expo-camera/src/web/WebBarcodeScanner.ts + https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/BarcodeDetector.json


### scanFromURLAsync cannot decode EAN-13/UPC-A from a still photo on iOS
*confidence: high*

Expo docs for Camera.scanFromURLAsync(url, barcodeTypes): "Only QR codes are supported on iOS." Android supports the full type list but performs best when "the barcode should take up the majority of the image." Consequence for MediSense: the 'take a photo of the barcode' flow is impossible on iOS — barcode capture must be the live onBarcodeScanned preview path, and the still-photo path is OCR-only.

**Source:** https://docs.expo.dev/versions/latest/sdk/camera/


### iOS reports UPC-A as ean13 with a leading zero; expo-camera already strips it
*confidence: medium*

AVFoundation (per Apple TN2325) emits a decoded UPC-A as AVMetadataObjectTypeEAN13Code with a leading zero in stringValue — a UPC-A is structurally an EAN-13 with a leading 0. expo/expo PR #28233 (merged 2024-04-16, fixing issue #28100) added logic to detect an EAN-13 that is really a converted UPC-A and strip that zero, plus fixed Swift barcode-type casing. Practical rule: with expo-camera specifically, do NOT strip a leading zero yourself or you will truncate genuine UPC-A codes that legitimately start with 0 (e.g. Life Brand 057800...). Normalize by trying both 12- and 13-digit forms against your table instead.

**Source:** https://github.com/expo/expo/pull/28233 + https://github.com/expo/expo/issues/28100 + https://developer.apple.com/library/archive/technotes/tn2325/_index.html


### expo-mlkit-ocr 0.2.7 is the cleanest on-device OCR for an Expo app, but requires a dev build
*confidence: high*

MIT, published 2026-05-06, 40 KB, repo github.com/rbayuokt/expo-mlkit-ocr. Uses Google ML Kit Text Recognition v2 standalone (not Firebase). Install: npx expo install expo-mlkit-ocr expo-image-picker expo-build-properties. app.json needs BOTH plugins: ["expo-mlkit-ocr", {"iosEngine":"auto"}] and ["expo-build-properties", {"ios":{"deploymentTarget":"16.0"}}] — without the 16.0 target you get 'Cannot find native module ExpoMlkitOcr'. iosEngine 'auto'/'vision' falls back to Apple Vision, which is what lets it build for the arm64 iOS Simulator. API: `recognizeText(uri: string): Promise<RecognitionResult>` where RecognitionResult = {text: string, blocks: TextBlock[]}, TextBlock = {text, boundingBox:{x,y,width,height}, lines: TextLine[]}, TextLine = {text, boundingBox, elements: TextElement[]}. Errors: INVALID_URI, IMAGE_LOAD_FAILED, RECOGNITION_FAILED. Also exports `isSupported(): boolean` and an <OCRTextOverlay> component. README states explicitly: "Will NOT work in Expo Go — this is a custom native module. You need a development client or EAS Build."

**Source:** https://registry.npmjs.org/expo-mlkit-ocr/-/expo-mlkit-ocr-0.2.7.tgz (README extracted from the published tarball)


### React Native OCR module landscape: three maintained, three dead
*confidence: high*

MAINTAINED — expo-mlkit-ocr 2.0.7... (0.2.7, 2026-05-06, MIT, Expo Module + config plugin); react-native-vision-camera-mlkit 2.0.1 (2026-08-20, MIT, real-time frame-processor OCR *and* barcode scanning in one plugin, peer deps @expo/config-plugins ^57.0.0 + react-native-vision-camera >=5 + react-native-nitro-modules, requires RN 0.86 / iOS 15.1+ / Android SDK 24+, config plugin ["react-native-vision-camera-mlkit", {"textRecognition":true,"barcodeScanning":true}], API useTextRecognition + useFrameOutput with mandatory frame.dispose(), plus processImageTextRecognition for gallery images up to 25 MB); react-native-vision-camera-ocr-plus 2.0.6 (2026-08-20, needs RNVC >=5.0.0 + react-native-worklets >=0.8.0). ALSO current: @bear-block/vision-camera-ocr 4.0.2 (2026-08-20, targets RNVC ^3||^4 + react-native-worklets-core ^1.5.0). STALE/DEAD — @react-native-ml-kit/text-recognition 2.0.0 (2025-09-01, no config plugin, peer RN >=0.60); react-native-vision-camera-text-recognition 3.1.1 (2024-08-12); vision-camera-ocr 1.0.0 (2022-02-21); react-native-mlkit-ocr 0.3.0 (2023-04-13). react-native-vision-camera itself is at 5.2.3 (2026-08-20) and is now Nitro-based, which breaks every v3/v4-era plugin. NONE of these work in Expo Go.

**Source:** https://registry.npmjs.org/ (live metadata for 15 packages) + https://github.com/pedrol2b/react-native-vision-camera-mlkit


### Google Cloud Vision TEXT_DETECTION accepts plain API-key auth — verified by live probe
*confidence: high*

POST https://vision.googleapis.com/v1/images:annotate?key=API_KEY. I probed it with an invalid key and got HTTP 400 {"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID","domain":"googleapis.com","metadata":{"service":"vision.googleapis.com"}}]}} — the key mechanism is accepted, not rejected as an unsupported auth method (the docs only demonstrate OAuth bearer tokens). Request body: {"requests":[{"image":{"content":"<base64>"},"features":[{"type":"TEXT_DETECTION"}],"imageContext":{"languageHints":["en"]}}]}. Response: responses[0].fullTextAnnotation.text (full string) and responses[0].textAnnotations[].description + .boundingPoly.vertices. Regional variants exist at eu-vision. and us-vision.googleapis.com.

**Source:** live POST to https://vision.googleapis.com/v1/images:annotate?key=INVALID_TEST_KEY_123 + https://docs.cloud.google.com/vision/docs/ocr


### Google Cloud Vision pricing: 1,000 free units/month then $1.50 per 1,000
*confidence: high*

TEXT_DETECTION and DOCUMENT_TEXT_DETECTION are priced identically: first 1,000 units/month free; 1,001–5,000,000 units at $1.50 per 1,000; 5,000,001+ at $0.60 per 1,000. Each feature applied to each image is one billable unit, and multi-page PDFs bill per page. For a class project, 1,000 free scans/month is comfortably more than a usability study needs.

**Source:** https://cloud.google.com/vision/pricing


### Azure AI Vision Read: 5,000 free transactions/month on F0
*confidence: medium*

Free F0 tier: 5,000 transactions per month, capped at 20 transactions per minute. Standard S1 Read/OCR: $1.50 per 1,000 transactions for 0–1M, $1.00 per 1,000 for 1M–5M, $0.65 per 1,000 above 5M. Note the numbers come from secondary sources — Azure's own pricing page now renders the table with '$-' placeholders and the prices.azure.com retail API returned zero items for serviceName 'Cognitive Services' / productName 'Azure Computer Vision', so I could not confirm the S1 figures first-hand.

**Source:** https://azure.microsoft.com/en-us/pricing/details/computer-vision/ (free-tier limits confirmed there; S1 per-1000 prices from secondary sources)


### Fuse.js 7.5.0 defaults, extracted from the published bundle
*confidence: high*

Apache-2.0, published 2026-07-13, 417 KB unpacked. Defaults read directly out of package/dist/fuse.cjs: threshold 0.6, distance 100, location 0, ignoreLocation false, minMatchCharLength 1, shouldSort true, isCaseSensitive false, includeScore false, findAllMatches false, useExtendedSearch false, ignoreFieldNorm false, ignoreDiacritics false, fieldNormWeight 1. threshold 0.0 requires a perfect match, 1.0 matches anything. ignoreLocation:true disables the location/distance penalty — essential for OCR, where the brand name may appear anywhere in the recognized string. 7.5.0 also ships a worker build (dist/fuse-worker.mjs/.cjs) and a useTokenSearch option with a custom tokenizer that receives text after case-folding and diacritic-stripping.

**Source:** https://registry.npmjs.org/fuse.js/-/fuse.js-7.5.0.tgz (dist bundle grepped) + https://registry.npmjs.org/fuse.js/7.5.0


### pg_trgm gives server-side fuzzy drug-name matching with an indexed operator
*confidence: high*

CREATE EXTENSION pg_trgm; (trusted — installable by a non-superuser with CREATE privilege). similarity(a,b) returns 0..1. The % operator returns true when similarity exceeds pg_trgm.similarity_threshold, which DEFAULTS TO 0.3 and is settable per-session with SET pg_trgm.similarity_threshold = 0.5. word_similarity('word','two words') = 0.8 finds the best-matching substring extent; strict_word_similarity forces word boundaries — better for matching a brand name inside a noisy OCR blob. Index: CREATE INDEX trgm_idx ON products USING GIN (brand_name gin_trgm_ops); or USING GIST (... gist_trgm_ops(siglen=32)) with siglen 1-2024, default 12.

**Source:** https://www.postgresql.org/docs/current/pgtrgm.html


### RxNav approximateTerm is a free typo-tolerant drug-name matcher and it handled deliberately corrupted OCR text
*confidence: high*

GET https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=<text>&maxEntries=<n>. No API key, free. I fed it 'TYLEN0L EXTRA STRENGHT 500mg' (zero substituted for O, 'STRENGHT' misspelled) and it returned rxcui 198440 'ACETAMINOPHEN 500 mg ORAL TABLET' with score 11.88. 'ADVILL LIQUI GELS' returned rxcui 2388167 (score 17.81) and 731533. Response shape: approximateGroup.candidate[] = {rxcui, rxaui, score, rank, name, source}. Terms of service: no more than 20 requests/second per IP, cache results 12-24 hours, and you must display the NLM disclaimer statement; RxNav-in-a-Box (Docker) exists for higher volume. Caveat: RxNorm is US-centric, so Canadian-only brand names will miss.

**Source:** https://rxnav.nlm.nih.gov/REST/approximateTerm.json (2 live queries) + https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html


### Shoppers Drug Mart product URLs expose the real 12-digit Canadian UPC, but the pages are scrape-blocked
*confidence: high*

Product URLs are keyed by UPC: https://www.shoppersdrugmart.ca/<slug>/p/BB_062600142290?variantCode=062600142290 — the variantCode IS the UPC. Confirmed examples: Tylenol Extra Strength 062600142290 and 062600142641, Tylenol rapid-release gels 062600380050, Tylenol Easy Dissolve 062600650474, Tylenol back pain 064541319854; Life Brand generics all under 057800: Acetaminophen 500mg 057800974116 / 057800974109, Acetaminophen 325mg 057800974024, Extra Strength Acetaminophen 057800109570, Children's Acetaminophen 057800102854, Extra Strength Ibuprofen 057800973591, Ibuprofen 400mg 057800826460, Ibuprofen liquid caps 057800013426. Direct fetching is blocked: a browser-UA GET returned HTTP 403 from Akamai ('Access Denied', errors.edgesuite.net reference). So harvest these from search-result URLs or by hand, not with a crawler.

**Source:** live curl to shoppersdrugmart.ca (403) + Shoppers product URLs surfaced via search


### Barcode generation for printed test labels is trivially available
*confidence: high*

bwip-js 4.11.4 (MIT, 2026-08-19) generates EAN-13/UPC-A/Code-128 to canvas, PNG or SVG in Node and the browser; JsBarcode 3.12.3 (MIT, 2026-01-07) is the lighter option. Either lets you mint scannable labels for the ~50 seeded products so the camera path demos reliably. GS1 mod-10 check digit: sum digits right-to-left weighting 3,1,3,1..., check = (10 - sum mod 10) mod 10.

**Source:** https://registry.npmjs.org/bwip-js + https://registry.npmjs.org/jsbarcode + verified check-digit computation reproducing 300450449108


### Explicitly unverified
- Exact USD monthly prices for UPCitemdb DEV and PRO plans — the official plan-comparison page publishes quotas and rate limits but no dollar figures. Third-party sources say $29–$149/month; not confirmed.
- Barcode Lookup API plan pricing and quotas — https://www.barcodelookup.com/api returns HTTP 403 and /api-pricing-style URLs 404. Only their terms-page statement of a $99 USD minimum per bulk lookup order is attributable, and even that is second-hand.
- Azure AI Vision S1 per-1,000-transaction prices ($1.50 / $1.00 / $0.65). Azure's own pricing page renders '$-' placeholders and the prices.azure.com retail API returned zero items for the Cognitive Services / Computer Vision filters I tried. The F0 free tier (5,000/month, 20/minute) IS confirmed on Microsoft's page.
- GS1 Canada membership and GTIN licensing prices in CAD — gs1ca.org/pricing returns a Page Not Found. The GS1 US figures ($30 one-time per single GTIN, $500/year Data Hub) are US-specific and may not transfer.
- Whether Verified by GS1 returns anything useful for Canadian OTC drug GTINs specifically — I could not run a lookup without an account, so its actual drug coverage is untested. Its documented output fields (brand, company, description, image) contain no DIN or ingredient data regardless.
- On-device latency figures for expo-mlkit-ocr and expo-camera barcode scanning. No benchmark was run — there is no device or simulator in this environment. The 13.34s usability budget is almost certainly safe (ML Kit OCR is typically sub-second and native barcode decode is near-instant), but this should be measured on a real phone before you cite it.
- The claim that expo-camera already strips iOS's synthetic leading zero AND still reports type as 'ean13'. PR #28233 confirms the stripping was implemented; the residual type-reporting behaviour in expo-camera 57.0.4 comes from a third-party blog and needs a device test.
- The real-world OCR hit rate against Canadian OTC packaging. Glossy boxes, curved bottles, coloured backgrounds and stylized brand wordmarks (the TYLENOL logotype, Advil's script) are materially harder than the flat document text ML Kit is benchmarked on. Test on ~20 real boxes before trusting the largest-text-block heuristic.
- UPCitemdb's coverage percentages are extrapolated from a 10-code sample (2/6 national brands, 0/4 store brands). Directionally certain, numerically rough.
- Whether Health Canada plans to ever repopulate the DPD `upc` field. The documentation note only says the information moved to product_information as of 2025-05-01; no roadmap was found.


## trust-safety


### Ontario law restricts the title "pharmacist" and penalises holding out — the decisive argument against a fabricated badge
*confidence: high*

Pharmacy Act, 1991, S.O. 1991, c. 36, s. 10(1): "No person other than a member shall use the title 'apothecary', 'druggist', 'pharmacist', 'pharmacy technician' or 'pharmaceutical chemist', a variation or abbreviation or an equivalent in another language." s. 10(2): "No person other than a member shall hold himself or herself out as a person who is qualified to practise in Ontario as a pharmacist or a pharmacy technician or in a specialty of pharmacy." s. 12: "Every person who contravenes subsection 10(1) or (2) is guilty of an offence and on conviction is liable to a fine of not more than $25,000 for a first offence and not more than $50,000 for a second or subsequent offence." (as amended 2007, c. 10, Sched. B, s. 18). Caveat: s.10 governs a PERSON using the title; an app label is not squarely inside it, and I am not a lawyer. But a green-check "Pharmacist Verified" on real drug information sits close enough to s.10(2) that no student portfolio should carry that risk when a better label exists.

**Source:** https://www.ontario.ca/laws/statute/91p36


### OGL-Canada 2.0 forbids implying Health Canada endorses your app, and mandates an exact attribution string
*confidence: high*

Non-endorsement clause verbatim: "This licence does not grant you any right to use the Information in a way that suggests any official status or that the Information Provider endorses you or your use of the Information." Attribution: "you must use the following attribution statement: Contains information licensed under the Open Government Licence – Canada." Also grants a "worldwide, royalty-free, perpetual, non-exclusive licence... including for commercial purposes", and disclaims all warranties. Version 2.0; governed by the laws of Ontario. Practical effect on copy: "Verified against Health Canada DPD" is fine; "Health Canada verified" or a GoC wordmark is not.

**Source:** https://open.canada.ca/en/open-government-licence-canada


### canada.ca non-commercial reproduction terms give the exact citation format the verification panel must use
*confidence: high*

"Unless otherwise specified you may reproduce the materials in whole or in part for non-commercial purposes, and in any format, without charge or further permission, provided you do the following: exercise due diligence in ensuring the accuracy of the materials reproduced; indicate both the complete title of the materials reproduced, as well as the author (where available); indicate that the reproduction is a copy of the version available at [URL where original document is available]." A student/portfolio app is non-commercial, so quoting Health Canada text verbatim in the equivalency panel is permitted — provided each quote carries full title + author + "copy of the version at <URL>".

**Source:** https://www.canada.ca/en/transparency/terms.html


### THE bioequivalence citation, verbatim, from the governing Health Canada guidance — and Canada does NOT put a confidence interval on Cmax
*confidence: high*

Health Canada, "Guidance Document - Comparative Bioavailability Standards: Formulations Used for Systemic Effects". Date Adopted: 2012/12/08; Revised Date: 2018/06/08; Effective Date: 2018/09/01. Section 2.1 Bioequivalence standards: "For the majority of drugs, with the exception of subsequent-entry biologic products, the following standards obtained in single dose cross-over comparative bioavailability studies determine bioequivalence: 1. The 90% confidence interval of the relative mean area under the concentration versus time curve to the time of the last quantifiable concentration (AUC T) of the test to reference product should be within 80.0% - 125.0% inclusive. 2. The relative mean maximum concentration (C max) of the test to reference product should be within 80.0% - 125.0% inclusive. These standards should be met on log transformed parameters calculated from the measured data." CRITICAL: criterion 2 is a point estimate of the relative mean, NOT a confidence interval — the 2018 change log records the wording being tightened from "between" to "within" for exactly this. Section 2.1.1.6 Critical dose drugs tightens AUC to a 90% CI within 90.0%–112.0% and adds a 90% CI on Cmax of 80.0%–125.0%. Section 2.1.1.1 (modified-release steady-state) adds Cmin not less than 80.0%.

**Source:** https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/applications-submissions/guidance-documents/bioavailability-bioequivalence/comparative-bioavailability-standards-formulations-used-systemic-effects.html


### FDA's parallel statement, verbatim, from a May 2026 guidance — FDA DOES apply the 90% CI to Cmax
*confidence: high*

"Statistical Approaches to Establishing Bioequivalence — Guidance for Industry", U.S. Department of Health and Human Services, FDA, Center for Drug Evaluation and Research (CDER), May 2026, Biopharmaceutics/Generic Drugs. Verbatim: "Generally, the BE limit of 80.00 percent to 125.00 percent is based on a clinical judgment that a test product with BA measures outside this range should be denied market access. To pass a confidence interval limit of 80 percent to 125 percent, the rounded confidence interval value should be at least 80.00 percent and not more than 125.00 percent." Also: "This approach is termed average BE and involves the calculation of a 90 percent confidence interval for the ratio of the averages (population geometric means) of the PK measures for T and R." Extracted directly from the PDF (623,868 bytes, HTTP 200).

**Source:** https://www.fda.gov/media/163638/download


### Health Canada's own consumer page states plainly that non-medicinal ingredients CAN differ — this is the allergen sentence the equivalency copy needs
*confidence: high*

"The Safety and Effectiveness of Generic Drugs" (It's Your Health series; Updated April 2012; page details 2017-05-04). Verbatim: "The generic drug must contain the same amount of medicinal ingredient as the brand name reference product. However, non-medicinal ingredients, like fillers and ingredients that colour the drug, may be different from those of the brand name product. The generic manufacturer must provide studies showing that the different non-medicinal ingredients have not changed the quality, safety or effectiveness of the generic drug." Also: "A generic drug is a copy of a brand name product, known as the 'reference product'. Generic drugs contain the same medicinal ingredients as the brand name drug, and are considered bioequivalent to the reference product." And: "The generic drug must show that it delivers the same amount of medicinal ingredient at the same rate as the brand name drug." Note the 2012 vintage — show the date, per NN/g's recency finding.

**Source:** https://www.canada.ca/en/health-canada/services/healthy-living/your-health/medical-information/safety-effectiveness-generic-drugs.html


### FDA is more candid than Health Canada about inactive ingredients mattering to a minority of patients
*confidence: high*

FDA "Generic Drugs: Questions & Answers". Q: "Do differences in inactive ingredients matter clinically?" A: "In most cases no, but in a minority of patients, inactive ingredients may affect tolerability or absorption. This is usually minor and uncommon – but worth clinical attention if patients report concerns. FDA will not approve a generic drug if the inactive ingredients of the drug are unsafe for use under the conditions proposed in the drug's labeling." Also: "Generic drugs are designed to work the same way as the brand drug... but small, allowable differences between the products manufactured by different companies (such as in certain inactive ingredients) can sometimes feel noticeable to patients." And: "Bioequivalence generally means the generic drug delivers the same amount of active ingredient to a patient at the same rate and to the same extent as the brand name drug."

**Source:** https://www.fda.gov/drugs/frequently-asked-questions-popular-topics/generic-drugs-questions-answers


### FDA Generic Drug Facts — the plain-language five-point equivalence list, ideal for the "What is a Generic?" onboarding
*confidence: high*

Content current as of 11/01/2021. "Generic drug applicants must show the generic medicine is the same as the brand-name in the following ways: The active ingredient in the generic medicine is the same as in the brand-name drug/innovator drug. The generic medicine has the same strength, dosage form (such as a tablet or an injectable), and route of administration (such as oral or topical). The generic medicine is manufactured under the same strict standards as the brand-name medicine. The label is the same as the brand-name medicine's label (with certain exceptions). The generic medicine is bioequivalent to the brand-name medicine." Price fact for FR2: "a single generic competitor can lead to price reductions of 30%, while five generics competing are associated with prices drops of nearly 85%."

**Source:** https://www.fda.gov/drugs/generic-drugs/generic-drug-facts


### HEADLINE FIND: Health Canada's DPD gives you a per-product deep link AND its own canonical "find the equivalents" link — the verification panel builds itself
*confidence: high*

Product page: https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code={drug_code} (HTTP 200). For ADVIL CAPLETS (drug_code 13452) it renders: Current status Marketed; Current status date 2025-05-22; DIN 01933531; Company HALEON CANADA ULC; Dosage form Tablet; Route Oral; Schedule(s) NON-PRESCRIPTION DRUGS; ATC M01AE01 IBUPROFEN; Active ingredient group (AIG) number 0108883004; active ingredient IBUPROFEN 200 MG; and a product monograph PDF at https://pdf.hres.ca/dpd_pm/00080634.PDF (HTTP 200, application/pdf, 655,238 bytes). At the foot of every such page Health Canada itself links "Same active ingredient group number" → https://health-products.canada.ca/dpd-bdpp/search-fast-recherche-rapide?lang=eng&no=0108883004 (HTTP 200). That is the authoritative, government-hosted equivalence list, free, per product, with no key. AIG footnote verbatim: "The AIG number is a 10 digit number that identifies products that have the same active ingredient(s) and ingredient strength(s). The AIG is comprised of three portions: the first portion (2 digits) identifies the number of active ingredients, the second portion (5 digits) identifies the unique groups of active ingredient(s), the last portion (3 digits) identifies the active ingredient group strength. The strength group has a tolerance of -2% to +10%."

**Source:** https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=13452


### The DPD JSON API returns ai_group_no directly, no auth, so the badge and the alternatives list share one field
*confidence: high*

GET https://health-products.canada.ca/api/drug/drugproduct/?brandname=advil&type=json → HTTP 200, application/json. Sample record: {"drug_code":13452,"class_name":"Human","drug_identification_number":"01933531","brand_name":"ADVIL CAPLETS","descriptor":"","number_of_ais":"1","ai_group_no":"0108883004","company_name":"HALEON CANADA ULC","last_update_date":"2025-06-09"}. ADVIL CAPLETS, ADVIL TABLETS, ADVIL GEL CAPLETS and ADVIL LIQUI-GELS all share ai_group_no 0108883004; CHILDREN'S ADVIL is 0108883005. Also GET /api/drug/activeingredient/?ingredientname=ibuprofen&type=json → 209 records with drug_code, ingredient_name, strength, strength_unit. Query by DIN: /api/drug/drugproduct/?din=01933531&type=json → 200.

**Source:** https://health-products.canada.ca/api/drug/drugproduct/?brandname=advil&type=json


### CORRECTION TO THE BRIEF: HONcode is dead — do not cite it or design toward it
*confidence: high*

Health On the Net Foundation announced in September 2022 that HON would be permanently discontinued on 15 December 2022 ("Despite all our efforts, it is no longer possible to maintain it"). Certification and monitoring ceased December 2022; domains inactive. I independently confirmed https://www.healthonnet.org/ fails to resolve (curl exit, HTTP 000) while every other domain in my check list returned 200. There is no live successor seal. Trust must therefore be earned through source attribution and citation, not through a third-party badge — which is exactly what the recommendation does.

**Source:** https://www.hifa.org/dgroups-rss/health-net-foundation-permanently-discontinued


### NN/g's four trust factors — the app already satisfies three; the badge redesign fixes the fourth
*confidence: high*

"Trustworthiness in Web Design: 4 Credibility Factors". Jakob Nielsen's 1999 four ways a site communicates trustworthiness, re-confirmed in a later NN/g study: design quality, up-front disclosure, comprehensive and current content, and connection to the rest of the web. Verbatim: "Typos, broken links, and other mistakes quickly degrade credibility and communicate an overall lack of attention to detail." On disclosure: "people appreciate when sites are upfront with all information that relates to the customer experience... When sites omitted basic information, they were almost immediately ruled out of consideration in favor of more upfront sites." "Connected to the rest of the web" is the one MediSense fails today — a self-asserted badge with no outbound link — and is precisely what per-drug DPD/monograph links repair.

**Source:** https://www.nngroup.com/articles/trustworthy-design/


### NN/g icon research directly validates the team's label fix AND contradicts their hover-state plan
*confidence: high*

"Icon Usability" (NN/g). Verbatim: "To help overcome the ambiguity that almost all icons face, a text label must be present alongside an icon to clarify its meaning in that particular context." And: "Icon labels should be visible at all times, without any interaction from the user. For navigation icons, labels are particularly critical. Don't rely on hover to reveal text labels: not only does it increase the interaction cost, but it also fails to translate well on touch devices." Also: "If that object, action, or idea is not immediately clear to users, the icon is reduced to mere eye candy." The team's planned "hover/press states for clickability" is fine as an affordance cue but must never be what reveals the label — on a phone there is no hover.

**Source:** https://www.nngroup.com/articles/icon-usability/


### NN/g on writing for skeptical/expert readers — cite, link to the original, and show the date
*confidence: high*

"Writing Digital Copy for Domain Experts". Verbatim: "To establish authority and trust, provide references to any ideas or information taken from a source. And don't just say where the information originated — whenever possible, give readers an easy way to follow the trail of evidence by providing a link to the original article, research, book, or journal." Participant quote: "Medical people don't want information that is on the web that has been interpreted by a journalist…no article stands alone." On layering: "State the summary at the top. Then provide more detailed information down the page progressively" and "Include hyperlinks that take readers to supporting details on deeper-level pages." On recency: "Professionals rely on publishing dates to determine relevance." This is the A→B→C accordion structure recommended above, and the reason each verification row carries a date.

**Source:** https://www.nngroup.com/articles/writing-domain-experts/


### WCAG 2.2 SC 1.4.1 — a green checkmark alone fails; this is why the badge needs a shape and a label
*confidence: high*

Success Criterion 1.4.1 Use of Color (Level A), verbatim: "Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element." In Brief: "Goal: Color is not the only way of distinguishing information. What to do: Use information in addition to color, such as shape or text, to convey meaning. Why it's important: Not everyone sees colors or sees them the same way." Doubly relevant here because the app's theme is black-and-white — a lone green check is both an a11y failure and a visual-system violation.

**Source:** https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html


### WCAG 2.2 SC 2.5.8 gives the exact number for the "make map pins directly clickable" fix
*confidence: high*

Success Criterion 2.5.8 Target Size (Minimum), Level AA, verbatim: "The size of the target for pointer inputs is at least 24 by 24 CSS pixels, except when: Spacing — Undersized targets (those less than 24 by 24 CSS pixels) are positioned so that if a 24 CSS pixel diameter circle is centered on the bounding box of each, the circles do not intersect another target or the circle for another undersized target; Equivalent — The function can be achieved through a different control on the same page that meets this criterion; Inline; User Agent Control; Essential." In Brief: "Some people with physical impairments cannot click small buttons that are close together." Directly applicable: price-bearing map markers must be ≥24x24 or use RN's hitSlop, and the spacing exception matters when several pharmacies cluster downtown.

**Source:** https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html


### NHS health-literacy data explains WHY the 80–125% fact must be buried at layer three
*confidence: high*

NHS digital service manual, Content guide – Health literacy: "more than 4 in 10 adults struggle with health content for the public" and "more than 6 in 10 adults struggle with health content that includes numbers and statistics." NHS also: "We do not recommend readability tools, except to help you prioritise your content. Tools cannot tell you how usable your content is. It's best to test it with your users." The NHS design system also ships a "Warning callout" component — "Use a warning callout to help users identify and understand warning content on the page, even if they do not read the whole page" — which is the right pattern for the allergen/non-medicinal-ingredient warning.

**Source:** https://service-manual.nhs.uk/content/health-literacy


### NLM's medical disclaimer is the best model to copy — short, specific, non-defensive
*confidence: high*

NLM Web Policies, Disclaimers section, verbatim: "Medical Information: It is not the intention of NLM to provide specific medical advice, but rather to provide users with information to better understand health and disease. Specific medical advice will not be provided, and NLM urges you to consult with a qualified health professional for diagnosis and for answers to your personal medical questions." Also "Liability: ...the U.S. Government does not warrant or assume any legal liability or responsibility for the accuracy, completeness, or usefulness of any information..." and "Links to External Web Sites: Some NLM Web pages may provide links to other Internet sites only for the convenience of web users. NLM is not responsible for the availability or content of these external sites, nor does NLM endorse, warrant or guarantee the products, services or information described..." MedlinePlus's about page adds a good positioning line: "There is no advertising on this website, and MedlinePlus does not endorse any companies or products."

**Source:** https://www.nlm.nih.gov/web_policies.html


### MedlinePlus is safe to LINK to but its drug monographs are NOT free to copy
*confidence: high*

MedlinePlus "Using MedlinePlus content": public-domain content includes the homepage, health-topic summaries, medical test info, genetics summaries, healthy recipes and videos, with requested credit "Courtesy of MedlinePlus from the National Library of Medicine" or "Source: MedlinePlus, National Library of Medicine." BUT copyrighted and licensed only for use on MedlinePlus: "Drug monographs from the American Society of Health-System Pharmacists" and "Any content from the A.D.A.M. Medical Encyclopedia". Practical rule for MediSense: deep-link to e.g. https://medlineplus.gov/druginfo/meds/a682159.html (HTTP 200) in the "useful links" panel; never scrape or paste that monograph text into the app.

**Source:** https://medlineplus.gov/about/using/usingcontent/


### CGPA is a legitimate but INTERESTED party — use it as a fourth link, never as the primary citation
*confidence: high*

Canadian Generic Pharmaceutical Association, bioequivalence page, verbatim: "Generic medicines have the same active ingredient as the brand-name and must have the same amount of active ingredient in the prescription. Non-medicinal ingredients, like fillers and preservatives, may be different from the brand-name product, but they are also regulated and reviewed by Health Canada." And: "If a generic drug product is tested and is bioequivalent to the brand-name version, there is no meaningful difference between the brand-name and the generic and the way the generic medicine works in the body." CGPA is the generics industry's trade association, so a skeptical user who checks will find a vested interest. Order the citations Health Canada → FDA → CGPA, and label CGPA as an industry association in the link text.

**Source:** https://canadiangenerics.ca/medicines/bioequivalence/


### Current React Native / Expo baseline, and RN 0.82+ is New-Architecture-only (this is what makes stale tour libraries dangerous)
*confidence: high*

npm registry, checked 2026-08-30: react-native latest 0.87.1 (published 2026-08-26, peerDeps react ^19.2.3); expo latest 57.0.18 (published 2026-08-28; dist-tags include sdk-54: 54.0.37, sdk-53: 53.0.27); react-native-reanimated 4.6.0 (2026-08-21, peers react-native "0.83 - 0.87", react-native-worklets 0.12.x); react-native-svg 15.15.5 (2026-05-11); react-native-safe-area-context 5.9.1 (2026-08-18). RN 0.82 release blog: "React Native 0.82 is the first React Native that runs entirely on the New Architecture" — setting newArchEnabled=false on Android or RCT_NEW_ARCH_ENABLED=0 on iOS is disabled from 0.82 onward.

**Source:** https://reactnative.dev/blog/2025/10/08/react-native-0.82


### Full comparison of RN coach-mark/tour libraries with npm + GitHub evidence — none is a clean win
*confidence: high*

All MIT unless noted. react-native-spotlight-tour: npm 4.0.0 (2025-06-23), repo pushed 2026-08-17, 520 stars, 35 open issues, 7,499 weekly downloads; peers react>=16.8, react-native>=0.50, react-native-svg>=12.1.0; deps @floating-ui/react-native ^0.10.7. rn-tourguide: npm 3.3.2 (2024-10-30), pushed 2025-06-11, 863 stars, 65 open issues, license NOASSERTION, 10,072/wk. react-native-copilot: npm 3.3.3 (2024-12-17), repo NOT pushed since 2024-12-17, 2,435 stars, 124 open issues, 16,464/wk — most popular but most stale. guideway: npm 0.4.1 (2026-06-29), MIT, peers react-native-reanimated>=3 + react-native-svg>=14, explicitly "built for the New Architecture", but only 25 weekly downloads and a 0.x API. @wrack/react-native-tour-guide: npm 2.0.0 (2026-08-20), only 20 GitHub stars, heavy peer list (@react-native-community/blur, react-native-linear-gradient, @react-native-masked-view/masked-view). Intro carousels: react-native-onboarding-swiper 1.4.0 (2026-01-27, MIT, 5,503/wk) is fine; react-native-app-intro-slider 4.0.4 last published 2020-05-26 — avoid. Persistence: @react-native-async-storage/async-storage 3.1.1 (2026-05-29, MIT) or react-native-mmkv 4.3.2 (2026-06-22, MIT, requires react-native-nitro-modules).

**Source:** https://registry.npmjs.org/react-native-spotlight-tour


### Independent confirmation that the best-maintained tour library has an open New-Architecture bug
*confidence: high*

GitHub issue search on stackbuilders/react-native-spotlight-tour for open Fabric / "new architecture" issues returns 2: #202 "Tooltip not rendering on iOS with Expo 54 + New Architecture (Fabric) - overlay shows but TourBox/tooltip invisible" (opened 2026-01-06, still open) and #203 "[Android] Spotlight position incorrect due to missing StatusBar.currentHeight adjustment" (2026-02-14). This corroborates guideway.dev's competitive claim from a neutral source, and #203 matters directly because MediSense has no nav bar — its tour targets sit near the status bar.

**Source:** https://github.com/stackbuilders/react-native-spotlight-tour/issues/202


### React Native's accessibility API supplies everything the badge and map pins need
*confidence: high*

reactnative.dev/docs/accessibility documents accessibilityLabel, accessibilityRole (valid values include button, link, image, header, text, alert, checkbox, togglebutton, tab, tablist), accessibilityHint ("can be used to provide additional context to the user on the result of the action when it is not clear from the accessibility label alone", e.g. accessibilityLabel="Go back" accessibilityHint="Navigates to the previous screen"), accessibilityState, accessibilityValue, accessibilityLabelledBy (Android) and accessibilityLiveRegion. Concretely: the badge is accessibilityRole="button" with accessibilityLabel="Health Canada listed, DIN 01933531" and accessibilityHint="Opens how we checked this"; each map pin is accessibilityRole="button" with label "Shoppers Drug Mart, Bloor Street, 8 dollars 49".

**Source:** https://reactnative.dev/docs/accessibility


### Ontario Poison Centre number for the emergency line in the disclaimer, verified on the Centre's own site
*confidence: high*

1-800-268-9017, ontariopoisoncentre.ca: "The Ontario Poison Centre is available to help you over the phone 24 hours a day, every day of the year. We can help you with poison emergencies and with questions about poisoning." Pair with 911. This belongs in the persistent disclaimer, not buried in an About screen — it is the single highest-stakes piece of copy in an OTC medicine app.

**Source:** https://www.ontariopoisoncentre.ca/


### THREE EQUIVALENCY COPY DRAFTS, layered, ready to paste
*confidence: high*

LAYER A — result card, one line, no numbers: "Same active ingredient, same strength as Advil: ibuprofen 200 mg."  |  LAYER B — accordion summary, ~55 words, the persuasion tier: "Both contain ibuprofen 200 mg. Health Canada puts them in the same active ingredient group — its own way of saying same active ingredient, same strength. Generic makers don't get to skip the science: before a generic can be sold in Canada it has to prove it puts the same amount of drug into your blood, at the same speed, as the brand does."  |  LAYER C — "Show me the standard", the number, cited: "The test is called bioequivalence. Healthy volunteers take the brand and the generic, and the drug in their blood is measured. Health Canada's rule for most drugs: the 90% confidence interval for total drug absorbed (AUC) must fall between 80.0% and 125.0% of the brand's, and the average peak level (Cmax) must fall in the same range. Miss it and the product is not approved for sale. Source: Health Canada, Guidance Document - Comparative Bioavailability Standards: Formulations Used for Systemic Effects, section 2.1, revised 2018-06-08. [Read it →]"  |  LAYER D — the warning callout, non-negotiable, and the reason this copy is honest rather than promotional: "What can be different: the non-medicinal ingredients — fillers, dyes, coatings, flavours. Health Canada says these 'may be different from those of the brand name product.' They almost never change how the medicine works. They can matter if you have an allergy or an intolerance. Read the ingredients on the box, and tell the pharmacist if you have ever reacted to a medicine."

**Source:** https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/applications-submissions/guidance-documents/bioavailability-bioequivalence/comparative-bioavailability-standards-formulations-used-systemic-effects.html


### FULL DISCLAIMER TEXT, ready to paste — covers all five required points plus licensing
*confidence: high*

Persistent one-liner (foot of every product screen, tappable): "Information only — not medical advice. Prices are illustrative. [Read the full notice →]"  |  FULL NOTICE: "About MediSense — MediSense is a non-commercial student project built for CSC318 at the University of Toronto. It is not a pharmacy, a medical service, or a business.  NOT MEDICAL ADVICE. MediSense does not provide specific medical advice. It provides information to help you understand over-the-counter medicines. For diagnosis, and for answers to your personal health questions, consult a pharmacist, physician, or other qualified health professional.  NO PHARMACIST HAS REVIEWED THIS APP. We do not employ pharmacists and no pharmacist has reviewed any page here. Where you see 'Health Canada listed', it means we matched the product to a record in Health Canada's public Drug Product Database — nothing more. Every such claim links to the government record so you can check it yourself.  PRICES ARE ILLUSTRATIVE. Prices shown are sample figures for demonstration and are not quotes from any pharmacy. Confirm the price at the pharmacy.  INGREDIENTS AND ALLERGIES. Generic and brand-name products contain the same medicinal ingredient at the same strength, but their non-medicinal ingredients — fillers, dyes, coatings, flavours — can differ, and those can matter if you have an allergy or intolerance. Always read the label on the package.  IN AN EMERGENCY. Call 911. For a suspected poisoning or overdose in Ontario, call the Ontario Poison Centre at 1-800-268-9017, 24 hours a day.  SOURCES AND LICENCE. Drug information is drawn from Health Canada's Drug Product Database. Contains information licensed under the Open Government Licence – Canada. MediSense is not affiliated with, endorsed by, or approved by Health Canada or the Government of Canada. External links are provided for convenience; we are not responsible for their content.  Last updated: 30 August 2026."

**Source:** https://www.nlm.nih.gov/web_policies.html


### Every URL in this report was fetched and confirmed to resolve
*confidence: high*

Confirmed HTTP 200: health-products.canada.ca/dpd-bdpp/, .../dpd-bdpp/info?lang=eng&code=13452, .../dpd-bdpp/search-fast-recherche-rapide?lang=eng&no=0108883004, pdf.hres.ca/dpd_pm/00080634.PDF, fda.gov/drugs/generic-drugs/generic-drug-facts, fda.gov/drugs/frequently-asked-questions-popular-topics/generic-drugs-questions-answers, fda.gov/media/163638/download, canadiangenerics.ca/medicines/bioequivalence/, ontario.ca/laws/statute/91p36, open.canada.ca/en/open-government-licence-canada, nlm.nih.gov/web_policies.html, medlineplus.gov/about/using/usingcontent/, medlineplus.gov/druginfo/meds/a682159.html, nngroup.com/articles/{trustworthy-design,communicating-trustworthiness,icon-usability,writing-domain-experts}/, service-manual.nhs.uk/content/health-literacy, service-manual.nhs.uk/design-system/components/warning-callout, reactnative.dev/docs/accessibility, reactnative.dev/blog/2025/10/08/react-native-0.82, guideway.dev/docs/, github.com/stackbuilders/react-native-spotlight-tour(+/issues/202), stackbuilders.github.io/react-native-spotlight-tour/, ontariopoisoncentre.ca. NOTE ON TWO HOSTS: canada.ca and w3.org refuse direct curl from this machine (HTTP/2 INTERNAL_ERROR and 403 respectively) but both returned full, correct content through a text-extraction proxy — they are live and fine in a browser; do not mistake my transport errors for dead links. Confirmed DEAD: healthonnet.org (HONcode).

**Source:** https://health-products.canada.ca/dpd-bdpp/


### Explicitly unverified
- No case law or regulatory decision was found applying Ontario's Pharmacy Act s. 10 title restrictions to a mobile app's UI label (as opposed to a person representing themselves). The statute text and penalty are verified; the application to software is my inference and should be framed as risk, not as a settled legal conclusion.
- Ontario College of Pharmacists public pages (ocpinfo.com/public/…) returned 403 to my client, so I could not confirm the exact URL of a consumer-facing "Find a Pharmacy" tool. The domain resolves (ocpinfo.com → 200) and members.ocpinfo.com → 200 appears to be the public register, but the precise deep link for the "Find a pharmacy near me" button in my proposed copy is unconfirmed — verify before shipping that button.
- Health Canada's "Access to Generic Drugs" fact sheet and the "Non-prescription Drugs: Category IV Monographs" guidance both resolve (200 via proxy), but I read only search-result excerpts of their bodies, not the full pages. The ANDS / Canadian Reference Product / pharmaceutical-equivalence framing attributed to them is from those excerpts, not from a full fetch.
- Whether the Drug Product Database specifically is released under OGL-Canada 2.0 was not directly confirmed — the open.canada.ca dataset page fetch returned only site chrome, and the dedicated DPD terms-and-conditions URL 404s. The OGL text itself and the canada.ca non-commercial reproduction terms ARE verified and both cover the use described, so the attribution guidance stands; but confirm the dataset-specific licence line before publishing the app.
- Guideway's competitive comparison table (claiming copilot/tourguide/spotlight-tour do not work on the New Architecture) is vendor marketing from a library author about rivals. I corroborated the release-date and open-issue facts independently from npm and the GitHub API, which support the general claim, but the per-capability Yes/No cells are the vendor's own assessment and were not tested.
- I did not build or run anything. All React Native library compatibility claims are from npm metadata, GitHub repository metadata, and READMEs — no library was installed against RN 0.87.1 or Expo SDK 57 to confirm it actually renders. The recommended hand-rolled overlay approach is likewise untested in this project.
- The exact drug_code → DIN mapping and monograph PDF URL were verified only for ADVIL CAPLETS (drug_code 13452, DIN 01933531, 00080634.PDF). I did not sample enough products to confirm every OTC product in the DPD carries an AIG number, a monograph PDF, or a Schedule value of NON-PRESCRIPTION DRUGS — expect nulls and design the verification panel to degrade gracefully when a row is missing.
- The HONcode discontinuation date (15 December 2022) comes from a HIFA mailing-list post and secondary summaries; the primary announcement is gone with the domain. The fact that healthonnet.org no longer resolves I confirmed myself, so the operational conclusion (do not cite HONcode) is safe regardless of the exact date.
- Reading-level targets for the copy drafts are my judgment. NHS explicitly declines to recommend readability tools ("Tools cannot tell you how usable your content is. It's best to test it with your users"), so no grade-level claim about my drafts has been measured.
- I did not read the CSC318 A3.pdf design document in the project directory — I worked from the brief's summary of the five functional requirements and the usability findings. If the original document contains specific wording for the verification page or the disclaimer, reconcile my proposed copy against it.


---

# Part 3 — Adversarial corrections

> These override Part 1.



## mobile-stack — refuted: True


### Correction 1
**Original claim:** VERDICT: 'FEASIBLE_FREE — ... delivers all 5 functional requirements at $0, with the single caveat that testing on a physical iPhone requires a local Xcode build.' Combined with SCHEMA: 'product(id, din, npn, gtin, ...)' and 'a unique index on gtin for the barcode path.'

**Correction:** There is a second, larger caveat the study never states: there is no free authoritative source for the `gtin` column, so the barcode-scan feature has no data behind it. Health Canada's Drug Product Database — the only free Canadian drug dataset — REMOVED UPC values as of 2025-05-01. The API guide's Packaging table states verbatim: 'upc - The Universal Product Code. As of May 1, 2025, UPC values have been removed from the packaging file.' I confirmed this against the live endpoint: GET https://health-products.canada.ca/api/drug/packaging/?id=11685&lang=en&type=json returns {"drug_code":11685,"upc":"",...} — the field is present but empty. GS1 Canada, the only other authority, licenses GTIN data via paid membership. Note the irony: the recommendation says the Expo-vs-Next.js decision 'hinges on one verified fact' about barcode scanning, and that fact (claim 7) IS correct — expo-camera really does fall back to the ZXing-WASM polyfill on iOS Safari. The scanner works; the lookup table it scans into cannot be populated for free. Every GTIN must be hand-entered per product, which is fine for a portfolio demo but must be scoped as manual data entry, not a pipeline.

**Source:** https://health-products.canada.ca/api/documentation/dpd-documentation-en.html (Packaging section) — verified live at https://health-products.canada.ca/api/drug/packaging/?id=11685&lang=en&type=json


### Correction 2
**Original claim:** '$0' / 'no budget', with 'the Google Places / OCR proxy as an Edge Function', 'implement map.web.tsx with the Google Maps JS API or a Static Maps image', and 'the Google Maps SDK for Android key DOES ship in the app'.

**Correction:** $0 in cash, but NOT $0 in prerequisites: every one of those four Google surfaces (Places nearby-pharmacy search, Maps JavaScript API, Static Maps, Maps SDK for Android) is a Google Maps Platform product, and GMP requires a Google Cloud project with billing ENABLED and a valid payment method on file — an API key alone is not sufficient. Google's own Places setup checklist lists 'Account and billing' as step 1: 'Ensure that you have a project with a billing account.' The free allowance is also no longer the old blanket $200/month credit — since 2025-03-01 it is per-SKU monthly caps (10,000 events for Essentials SKUs incl. Place Details/Geocoding/Dynamic Maps/Static Maps; 5,000 for Pro SKUs incl. Nearby Search Pro). Those caps are far above a portfolio project's usage, so the real risk is the credit-card requirement, not the quota. The same applies to Cloud Vision if the OCR proxy uses it. The study's 'single caveat' framing should be 'two caveats: iPhone testing, and a Google Cloud billing account.' Mitigation that preserves the claim: react-native-maps in Expo Go needs no key at all (Expo's docs: 'No additional setup is required when testing your project using Expo Go'), and on iOS it defaults to Apple Maps, so the DEV LOOP is genuinely card-free — only the standalone Android build, the web map tab, and the Places proxy are not.

**Source:** https://developers.google.com/maps/documentation/places/web-service/get-api-key and https://developers.google.com/maps/billing-and-pricing/pricing


### Correction 3
**Original claim:** Claim 8: 'caniuse mdn-api_barcodedetector_detect: Safari desktop 3.1–26.5 not supported, 26.6–27+ disabled by default; Safari on iOS 3.2–26.5 not supported, 26.6 onward disabled by default.'

**Correction:** Misreads the cited source. caniuse shows BarcodeDetector as 'disabled by default' on Safari desktop and Safari iOS from version 17.0 onward (not from 26.6), with no version anywhere in the table showing enabled support. The conclusion the claim draws is unaffected and still correct — 'disabled by default' is unusable in a demo either way, so the WASM polyfill remains load-bearing — but the version boundary cited is wrong by nine major Safari releases. Global support (76.34%), Chrome for Android 151 full support, and Firefox never-supported all check out.

**Source:** https://caniuse.com/mdn-api_barcodedetector_detect


### Correction 4
**Original claim:** Claim 2: 'SDK 56 = 2026-05-20'

**Correction:** The Expo changelog index dates SDK 56 to 2026-05-21, not 2026-05-20. Immaterial to the recommendation; noted only because the claim was rated high confidence with the changelog as its source. SDK 55 (2026-02-25) and SDK 57 (2026-06-30) are both correct.

**Source:** https://expo.dev/changelog


### What held up
WHAT HELD UP (verified against primary sources, not memory):

Claim 1 — CONFIRMED exactly. registry.npmjs.org/expo dist-tags: latest = 57.0.18. bundledNativeModules.json on the sdk-57 branch pins react-native 0.86.3, react 19.2.3, react-dom 19.2.3, react-native-web ~0.21.0 — verbatim as claimed. GitHub issue expo/expo#48298 ('[SDK 56/57] Dev builds take 20x longer to launch') is CLOSED with a pinned comment confirming the fix landed in expo@57.0.17 via RN 0.86.3 / Hermes 250829098.0.17. The >= 57.0.17 floor is real.

Claim 3 — CONFIRMED, and I actively hunted for a newer entry that would retire it. https://expo.dev/changelog/expo-go-and-app-store-may-2026 exists and says what's quoted, including that `eas go` 'requires an Apple Developer Program membership' and 'The TestFlight External beta group is now at capacity.' The changelog index's most recent entries are Aug 20 ('EAS Observe is now GA') and Aug 13 2026 — no App Store approval entry for SDK 55/56/57. The blocker is still live as of today.

Claim 4 — CONFIRMED per-package from docs frontmatter: expo-camera ['android*','ios*','web','expo-go'], expo-sqlite ['android','ios','macos','tvos','web','expo-go'], react-native-maps ['android','ios','expo-go'] with inExpoGo: true and 'No additional setup is required when testing your project using Expo Go.'

Claim 5 — CONFIRMED, including the part I initially thought was wrong. The raw unversioned .mdx has no alpha marker, but the rendered docs page carries the banner verbatim: 'This library is currently in alpha and will frequently experience breaking changes. It is not available in the Expo Go app.' Google Maps on iOS is genuinely unsupported by expo-maps. The icon-vs-children distinction is real.

Claim 6 — CONFIRMED. MapView.web.ts is literally `//@ts-ignore` + `export {default} from 'react-native-web/dist/modules/UnimplementedView';`. npm latest is 1.29.0 (2026-06-28, 'ios fabric support (GoogleMaps Marker, Polygon)'), peers `react >= 18.3.1` / `react-native >= 0.76.0` / optional `react-native-web >= 0.11` — exactly as stated.

Claim 7 (THE CRUX) — CONFIRMED at source. WebBarcodeScanner.ts contains the literal fallback chain, and expo-camera@57.0.4's package.json has exactly one dependency: "barcode-detector":"^3.0.0". The load-bearing fact of the whole recommendation is true.

Claim 9 — CONFIRMED verbatim, including the fastly.jsdelivr.net default template and the prepareZXingModule({overrides:{locateFile}}) escape hatch.

Claims 10, 11, 12 — CONFIRMED. custom-tabs.md resolves (not a 404), is marked 'This is an experimental feature', and documents asChild and reset ('always'|'onLongPress'|'never'). Typed routes docs say verbatim 'This feature is currently in beta and is not enabled by default' plus 'Statically typed routes do not support relative paths.' nativewind dist-tags: latest 4.2.6, preview 5.0.0-preview.4.

Free tiers — ALL CONFIRMED, none silently require a card. Expo Free: 15 Android + 15 iOS builds/mo, EAS Hosting 100,000 requests/mo, 5 aliases, 100 GiB bandwidth, custom domain NOT included. Supabase Free: pauses 'after 1 week of inactivity', 2 active projects, 500 MB DB, 5 GB egress, 500k Edge Function invocations. Cloudflare Workers Free: 'a daily request limit of 100,000 requests, resetting at midnight UTC.' The bundled-SQLite design really does make the Supabase pause harmless.

EXTRA GOTCHAS FOUND:

1. react-native-maps 1.27.2 + New Architecture on iOS. SDK 57 pins 1.27.2 (2026-03-11) and New Arch cannot be disabled. iOS Fabric support for GoogleMaps Marker/Polygon only landed in 1.29.0 (2026-06-28) — three months after the pinned version. Apple Maps (the iOS default provider) is fine, so the design works as long as you never set provider={PROVIDER_GOOGLE} on iOS. If you do want Google on iOS you must jump off the SDK pin to 1.29.0. Worth an explicit 'do not set provider on iOS' line in the plan.

2. The COOP/COEP-vs-jsDelivr conflict is overstated. expo-sqlite's docs do confirm 'Web support is in alpha and may be unstable', but they also explicitly document configuring the headers on EAS Hosting, recommending COEP: 'credentialless' — and credentialless exists precisely to allow cross-origin no-cors subresource fetches without CORP headers, so the jsDelivr WASM fetch would most likely still work. The recommended workaround (ship a gzipped JSON blob behind an identical repository interface in db.web.ts) is still the right call for an alpha dependency, but it should be justified by 'web support is alpha', not by a header conflict that probably doesn't bite.

3. No free Canadian OTC retail price source exists either — searched and found nothing. The study is internally honest here (Supabase is the 'AUTHORING store', implying manual entry), but the verdict's 'delivers all 5 functional requirements at $0' should be read as 'delivers the software at $0; the drug/barcode/price dataset is hand-curated labour.' For a student portfolio project that's an acceptable trade, but it belongs in the verdict, not buried in the schema section.

BOTTOM LINE: the engineering research is excellent and I could not break claims 1–12 on any point that matters. The recommendation to ship Expo SDK 57 over Next.js stands, and stands for the reason given. What fails is the verdict sentence: it is not one caveat, it is three — physical-iPhone testing, a Google Cloud billing account, and a barcode/price dataset that must be typed in by hand because Health Canada deleted the UPC column in May 2025.



## pharmacy-price — refuted: True


### Correction 1
**Original claim:** "You get 713 pcg9 groups with a genuine branded-vs-generic price spread" from the ODB Formulary joined to Health Canada DPD keeping only schedule_name 'NON-PRESCRIPTION DRUGS'.

**Correction:** Off by roughly two orders of magnitude once the OTC filter the researcher themselves specify is actually applied. I downloaded the Edition 43 XML (3,598,643 bytes, createDate=2026-08-26) and the full DPD dumps, then joined DIN -> drug_code -> schedule_name. Results: 2,551 pcg9 groups total; 739 groups have any price spread across ALL drugs (overwhelmingly PRESCRIPTION); only 56 pcg9 groups contain even one NON-PRESCRIPTION DIN; and only 8 of those have a genuine branded-vs-generic price spread. The figure 713 matches nothing I can compute and is closest to the unfiltered 739 — it appears the all-drugs spread count was reported as if it were the OTC yield. The complete usable OTC set is: cetirizine 10mg tab, ibuprofen 400mg tab, bisacodyl 10mg supp, docusate sodium 100mg cap, levonorgestrel 1.5mg tab, clotrimazole 10mg/g vag cream, clotrimazole 20mg/g vag cream, fluconazole 150mg cap. And one of those 8 (cetirizine) has no brand price at all — Reactine carries no individualPrice — so only 7 yield a computable ratio. Three of the 8 (Plan B, Diflucan-150, clotrimazole vaginal cream) are behind-the-counter/Schedule II products, not shelf items a map-based OTC price finder would headline.

**Source:** https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml joined against https://health-products.canada.ca/api/drug/drugproduct/?lang=en&type=json and https://health-products.canada.ca/api/drug/schedule/


### Correction 2
**Original claim:** "Seed your catalogue from ~30 of these (ibuprofen, acetaminophen, loratadine, cetirizine, famotidine, docusate, senna, bisacodyl, dimenhydrinate, clotrimazole)."

**Correction:** Not available. Across all ten named ingredients the ODB file contains only 35 pcg9 groups, and just 7 have any price spread — you cannot seed ~30 products with a branded-vs-generic comparison from this list. Ingredient by ingredient: ACETAMINOPHEN has 13 groups and ZERO computable ratios — every brand (Atasol, Atasol Forte, Tempra, Abenol) has no individualPrice element, only the generics are priced; LORATADINE has 1 group and Claritin has no price; FAMOTIDINE has 2 groups and Pepcid has no price in either; DIMENHYDRINATE appears only as 50mg/mL injectable solution (no Gravol, no oral OTC form at all); SENNA is a single group where Senokot and Jamp-Senna are both $.0464 (no saving). That means the app's flagship category — acetaminophen, the most-bought OTC analgesic in Canada — cannot show a brand-vs-generic saving from this data source at all.

**Source:** https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml (parsed genericName/name -> pcgGroup -> pcg9 -> drug/individualPrice)


### Correction 3
**Original claim:** "the ODB file matches it [the pCPA Tiered Pricing Framework] to within a rounding error (Motrin 400mg $0.1871 vs Apo-Ibuprofen $0.0468 = exactly 25.0%; Dulcolax supp $1.2267 vs Jamp bisacodyl $0.4206 = 34.3%)"

**Correction:** Both cited numbers are individually correct — I confirmed .1871/.0468 (25.01%) and 1.2267/.4206 (34.29%) verbatim in the XML — but they are the two best cases out of eight and the generalization does not hold. Actual brand:generic ratios across the full OTC set: ibuprofen 25.0%, fluconazole 25.2%, levonorgestrel 25.0%, docusate 24.4%, bisacodyl 34.3%, clotrimazole 10mg/g 82% (Clotrimaderm $.1812 vs Canesten 6 $.2212), clotrimazole 20mg/g 82%, senna 100%. An 82% and a 100% are not rounding errors off a 25/35/50 tier. The ibuprofen example is also the only strength that works: Motrin 200mg, 300mg and 600mg are all flagged notABenefit="Y" with NO individualPrice, so three of four ibuprofen strengths yield no ratio. The structural cause, which the writeup never mentions: ODB systematically omits individualPrice for brand products flagged notABenefit="Y", so the brand half of the comparison is missing far more often than present.

**Source:** https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml; tiers cross-checked at https://www.pcpacanada.ca/generics-tpf-faqs


### Correction 4
**Original claim:** Claim 12 detail: "A broader query for pharmacy OR drug OR health facility also returned 0."

**Correction:** False as stated. The Toronto CKAN endpoint returns count=61 for q=health (e.g. 'Population Health Status Indicators', 'Wellbeing Toronto - Health'). The central claim survives — q=pharmac genuinely returns {"count": 0}, so there is still no pharmacy layer — but the supporting statement that a broader health query returns zero is wrong and should not be repeated as evidence.

**Source:** https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_search?q=health


### Correction 5
**Original claim:** "On HTTP 429 or 504, back off 30 seconds."

**Correction:** Minor: the Overpass wiki's fair-use text specifies 429 or 406, not 504 — 'If you receive an HTTP error code such as 429 or 406, pause for 30 seconds before making a new request.' Everything else in claim 4 is verbatim correct (10,000 queries/day, <1 GB/day, divide by 100 for a distributed application, mandatory User-Agent or Referer, and the private.coffee and maps.mail.ru instances are both listed).

**Source:** https://wiki.openstreetmap.org/wiki/Overpass_API


### Correction 6
**Original claim:** "A footnote states 'Mobile Native Static Maps and Mobile Native Dynamic Maps are now merged under one single SKU: Maps SDK.'"

**Correction:** Minor: the substance of claim 10 is fully confirmed — SKU 6DE1-4D9C-5B67 'Maps SDK' does show Free Usage Cap = Unlimited with no per-1,000 price in any tier, and the web SKUs are as stated (Dynamic Maps FAF4-3B2D-51B2 at 10,000 free then $7.00; Static Maps 3C2D-B525-2E5F at 10,000 free then $2.00). But I could not locate that merger footnote anywhere on the cited pricing page. Treat the quote as unsourced; the free-and-unlimited conclusion itself stands.

**Source:** https://developers.google.com/maps/billing-and-pricing/pricing


### Correction 7
**Original claim:** "Dulcolax supp $1.2267 vs Jamp bisacodyl $0.4206"

**Correction:** Trivial naming error: the prices are exactly right, but no product in that pcg9 group (561200002) is named 'Jamp bisacodyl'. The three generics at $.4206 are 'Bisacodyl Suppository' (02361450), 'Bisacodyl 10mg' (02458853) and 'AMB-Bisacodyl' (02520478). Jamp does make the senna generic (Jamp-Senna), which is likely where the name came from. Worth fixing before it lands in a cited UI string.

**Source:** https://www.ontario.ca/files/2026-08/moh-ontario-drug-benefit-odb-formulary-edition-43-data-extract-en-2026-08-27.xml


### What held up
WHAT HELD UP — I re-ran nearly everything live and the infrastructure half of this study is unusually solid.

Claim 1 reproduced to the digit: the Overpass query returned {nodes: 660, ways: 41, total: 701} against generator 0.7.62.11. Claim 2 reproduced to the digit as well — 91 pharmacies at r=2000m, and every single tag count matched (amenity 91, healthcare 91, name 91, dispensing 55, brand 52, addr:street 51, addr:housenumber 50, website 41, opening_hours 27, phone 26, 50 with full address), as did the entire brand breakdown (39 unbranded, 26 Shoppers, 14 Rexall, 4 I.D.A., 3 Pharmasave, 2 PharmaChoice, 2 Remedy'sRx, 1 Guardian). Claim 3 verified — `out center` does emit centers for both ways. Claims 4/5 verified on the wiki apart from the 406/504 slip. Claim 6 verified almost verbatim, including the auto-collapse allowance and the "does not need to be presented every time" startup rule. Claim 7 verified exactly (endpoint, mandatory X-Goog-FieldMask with the "no default list of returned fields" wording, radius 0–50000, maxResultCount 1–20). Claim 8 verified. Claim 9 verified exactly (Nearby Search Pro 99F9-A108-83A6, 5,000 free, $32.00/$25.60/$19.20/$9.60/$2.40, no Essentials tier). Claim 10's decisive finding verified. Claim 11 verified by downloading the file — 1,080,425 bytes exactly as claimed, 7,033 rows, facility types only nursing/ambulatory/hospitals, and exactly 3 BC clinics with "pharm" in the name.

Beyond the 12: the ODB XML URL is live (HTTP 200, 3,598,643 bytes, last-modified 27 Aug 2026), createDate="2026-08-26" and selfMed="Y" count = 34 both exact, licence confirmed OGL-ON-1.0 on data.ontario.ca. The legacy health.gov.on.ca warning is real and worth keeping — curl fails with "certificate has expired" and returns 502 when you bypass TLS. DPD's schedule_name "NON-PRESCRIPTION DRUGS" is a genuine value (23,760 rows). expo-maps is still alpha with the verbatim breaking-changes warning and image-only markers, so that avoidance is correct. Versions all check out as current latest: react-native-maps 1.29.0 (ships codegenConfig, so New Architecture is fine; peer RN >= 0.76 against expo 57.0.18), @maplibre/maplibre-react-native 11.3.7, expo-location 57.0.14. OpenFreeMap positron returns 200 application/json. pCPA tiers and the ODB 8% mark-up are both real.

THE ONE THING THAT BREAKS — Layer 2, the "better news than expected" part, is the weakest part of the study rather than the strongest. The verdict wording "the branded-vs-generic price relationship is real and free" is true in principle but the usable inventory is 8 pcg9 groups, not 713, and it collapses precisely where the app needs it most. The reason is structural, not incidental: ODB does not publish individualPrice for brand products flagged notABenefit="Y", and most OTC brands are exactly that. The two examples chosen (Motrin 400mg, Dulcolax suppository) are survivors, not representatives.

EXTRA GOTCHAS FOUND:
1. DPD coverage gap — 320 of the 8,668 ODB DINs have no DPD record at all (8,348 matched). `?din=` silently returns [] for these rather than erroring, so a naive join drops them invisibly. Budget for that.
2. The schedule endpoint takes drug_code, not DIN — `/api/drug/schedule/?id=` needs the drug_code from the drugproduct lookup. The writeup's "Join drug id → ... /api/drug/schedule/?id=" reads as if you can pass the DIN straight in. You cannot; it is a two-hop join.
3. DPD exposes no UPC/barcode field. The drugproduct record is {drug_code, class_name, drug_identification_number, brand_name, descriptor, number_of_ais, ai_group_no, company_name, last_update_date} — nothing scannable. If any part of the product plan assumes barcode scanning against DPD, it has no basis.
4. The 8% figure is the under-$1,000 tier of a two-tier structure (6% at/above $1,000), and Ontario has consulted on expanding it to six tiers. Harmless for OTC packs, but it is a reimbursement mark-up on ODB claims, not a retail mark-up — using it as a proxy for shelf pricing is a modelling assumption belonging in Layer 3's disclosure, not something to present as a real-world retail rule.
5. Bundling the Overpass GeoJSON at build time (claim 5) is the right call for an additional reason not mentioned: the fair-use policy governs runtime querying, and a shipped app that queries per map-open from thousands of installs would breach the ~100 queries/day application guidance almost immediately.

RECOMMENDATION — keep the verdict FEASIBLE_WITH_SYNTHETIC_DATA and keep the entire map/location/tooling stack as written; it is well evidenced. But rewrite Layer 2 honestly: it supports roughly 7 demonstrable brand-vs-generic comparisons, and for acetaminophen, loratadine, famotidine and dimenhydrinate there is no brand price to compare against. Either scope the demo catalogue to the products that genuinely work, or move the ratio itself into the disclosed-synthetic layer and cite the pCPA framework as the *justification* for the modelled ratio rather than claiming the ODB file empirically confirms it. The Senokot "no saving on this product" case is good design and should be the default path, not the exception — it is what the data most often supports.



## drug-data — refuted: True


### Correction 1
**Original claim:** VERDICT: 'Health Canada DPD (ai_group_no) + Health Canada NOC (noc_crp_product_name) give real, authoritative, free, no-auth Canadian brand→generic equivalence for ~272 OTC ingredient groups.'

**Correction:** The NOC half of that sentence is false at scale. I downloaded both NOC datasets and joined them to the exact 1,589-product OTC set the researcher defines. Results: only 224 of 1,589 OTC DINs (14.1%) have ANY NOC record at all; only 68 (4.3%) have a strict 'Abbreviated New Drug Submission (ANDS)' record; only 65 (4.1%) have an ANDS record WITH a non-empty noc_crp_product_name. At the group level — the level the verdict actually asserts — only 19 of the 272 multi-member ai_group_no OTC groups (7.0%) contain even one member with an ANDS+CRP. So the '~272 groups' figure comes entirely from ai_group_no; NOC contributes brand→generic evidence for 19 of them. The verdict's headline conflates the two. The '272 multi-member groups' number itself is correct (I reproduced it exactly), as are 1,589 / 13,384 / 11,497 / 746 single-AI / 843 combo / 1,587 with ATC and the full schedule value distribution.

**Source:** Computed from https://health-products.canada.ca/api/notice-of-compliance/drugproduct/?lang=en&type=json (77,626 rows) + https://health-products.canada.ca/api/notice-of-compliance/noticeofcompliancemain/?lang=en&type=json (37,868 rows) joined on DIN against https://www.canada.ca/content/dam/hc-sc/documents/services/drug-product-database/allfiles.zip (last-modified 2026-08-04)


### Correction 2
**Original claim:** Implicit premise of the whole NOC design: that OTC products in the DPD have NOC records to join to.

**Correction:** There is a structural regulatory reason 86% of them do not, and the researcher never identifies it. In Canada a non-prescription drug can be authorized under Part C Division 1 (a DINA or DINF/Category IV Monograph application) — which yields a DIN and NO Notice of Compliance — or under Division 8 (NDS/ANDS), which yields both. The overwhelming majority of Canadian OTC products, and specifically the cheap private-label products this app exists to surface, are Division 1 monograph authorizations and therefore can never appear in the NOC database. This is not a fiddly join to be debugged; it is a permanent ceiling. Health Canada's own guidance: 'Division 1 drugs can make an application for market authorization for a Drug Identification Number (DIN) without a Notice of Compliance.'

**Source:** https://www.canada.ca/en/health-canada/services/drugs-health-products/natural-non-prescription/legislation-guidelines/guidance-documents/obtain-market-authorization-non-prescription-drug/division-1-division-8.html


### Correction 3
**Original claim:** THE EQUIVALENCY EXPLANATION TEXT (FR1) 'writes itself from real fields… Every clause there is a database field, not a claim you invented' — the ADVIL/Vita Health worked example.

**Correction:** Three of its clauses are not what the database says. (a) DIN 02368080's brand_name in drug.txt is 'IBUPROFEN CAPLETS', not 'IBUPROFEN CAPLETS 200 MG' — the latter is a different product, DIN 02272857. (b) DIN 02368080's ANDS record is noc_number 12356, whose noc_crp_product_name is the freeform comma-joined string 'ADVIL IBUPROFEN CAPLETS, ADVIL EXTRA STRENGTH CAPLETS, ADVIL IBUPROFEN TABLETS' — not 'ADVIL', and not a value that can be rendered as a single reference brand. (c) The named reference product ADVIL CAPLETS (DIN 01933531) resolves to four NOC records, all 'New Drug Submission (NDS)' with an EMPTY noc_crp_product_name, so nothing in the data links 02368080 to 01933531 specifically. noc_crp_product_name is uncontrolled free text generally: across the 276 Nonprescription ANDS rows, 6 are blank, 5 are comma-lists, 8 name a US reference product (noc_crp_country_name = 'UNITED STATES OF AMERICA'), and the data contains typos such as 'ADVIL IBOPROFEN TABLETS'.

**Source:** https://health-products.canada.ca/api/notice-of-compliance/noticeofcompliancemain/?lang=en&type=json&id=12356 and https://health-products.canada.ca/api/notice-of-compliance/drugproduct/?lang=en&type=json (DIN 02368080, 01933531) cross-checked against drug.txt in allfiles.zip


### Correction 4
**Original claim:** Claim 12: NOC endpoints are '/noticeofcompliancemain/, /drugproduct/, /medicinalingredient/, /dosageform/, /route/, /product/, /vetspecies/'

**Correction:** /product/ does not exist. GET https://health-products.canada.ca/api/notice-of-compliance/product/?lang=en&type=json&id=7595 returns HTTP 404, and the official NOC API guide documents only drugproduct, noticeofcompliancemain, dosageform, medicinalingredient, route and vetspecies. The other six endpoints and all 17 noticeofcompliancemain field names verified correct live.

**Source:** https://health-products.canada.ca/api/documentation/noc-documentation-en.html (endpoint list) + live 404 from https://health-products.canada.ca/api/notice-of-compliance/product/?lang=en&type=json&id=7595


### Correction 5
**Original claim:** Claim 10: 'ther.txt: DRUG_CODE, TC_ATC_NUMBER, TC_ATC, TC_AHFS_NUMBER, TC_AHFS, TC_ATC_F, TC_AHFS_F.'

**Correction:** ther.txt in the current allfiles.zip has 4 columns, not 7, in all 13,206 rows: DRUG_CODE, TC_ATC_NUMBER, TC_ATC, TC_ATC_F. There are no AHFS columns. Sample row: "9","H03BB02","THIAMAZOLE","". A parser built to the claimed 7-column spec will not fail loudly — it will just find nothing where it expects AHFS data. Every other file's column order in claim 10 (drug 14, ingred 15, schedule 3, status 7, form 4, route 4, comp 18, package 8) I verified field-by-field and is correct.

**Source:** Direct inspection of ther.txt from https://www.canada.ca/content/dam/hc-sc/documents/services/drug-product-database/allfiles.zip


### Correction 6
**Original claim:** BUILD SCRIPT step 5: 'keep the 1,825 rows where noc_product_type="Nonprescription Pharmaceutical"' — presented as the pool of OTC generic evidence.

**Correction:** 1,825 is correct as the count of Nonprescription NOC rows, but it is the count across ALL submission types (NDS, SNDS, ANDS, SANDS), not the generics. Only 276 of those 1,825 are strict ANDS, and only 270 of those carry a CRP name. Separately, step 6's rule as literally written — 'if noc_on_submission_type contains "Abbreviated New Drug Submission"' — is a substring test that also matches 'Supplement to an Abbreviated New Drug Submission (SANDS)', changing the OTC generic count from 68 to 78. Decide which you mean.

**Source:** Computed over https://health-products.canada.ca/api/notice-of-compliance/noticeofcompliancemain/?lang=en&type=json


### Correction 7
**Original claim:** Store-brand mapping: 'map them onto the real contract-manufacturer DINs that already exist (Vita Health, Juno OTC, LNK International, Sigma Life Sciences, Angita, Guardian Drug, CRLS…)' — implying these sit inside the NOC-backed equivalence layer.

**Correction:** These are precisely the manufacturers the NOC layer cannot see. Their OTC products with any NOC record at all: LNK 0 of 3, Sigma 0 of 7, Guardian 0 of 5, CRLS 0 of 18, Juno OTC 3 of 28, Vita Health 20 of 80. Likewise, of the 13 private-label 'cheaper alternative' brand names the researcher himself lists in claim 11 as the app's whole point, most have no NOC record: ALLERGY FORMULA, SLEEP-EZE, ZZZQUIL, TRAVEL TABS, ANTI-NAUSEANT, TAMINOL, ASAPHEN and RIVASA all return NOC=NONE. The bioequivalence sentence is unavailable for exactly the products the app is built to recommend.

**Source:** Join of https://health-products.canada.ca/api/notice-of-compliance/drugproduct/?lang=en&type=json against comp.txt/drug.txt in allfiles.zip


### Correction 8
**Original claim:** openFDA build step: 'query https://api.fda.gov/drug/label.json?search=openfda.generic_name:"<inn>"… for each seeded product'

**Correction:** This silently returns nothing for at least one common Canadian OTC ingredient because DPD and openFDA use different ingredient vocabularies. DPD's ingred.txt spells it ACETYLSALICYLIC ACID; openFDA has zero OTC labels under that generic_name and 701 under 'aspirin'. That is the ingredient behind ASAPHEN, ENTROPHEN and RIVASA — three of the researcher's own named examples. You need an INN→USAN alias table, not a pass-through. (Quotas are correct as stated: 240/min + 1,000/day without a key, 240/min + 120,000/day with one; licence is genuinely CC0.) Counts drift slightly: today openFDA holds 49,929 HUMAN OTC DRUG labels of which 16,160 have openfda.upc, not the claimed 56,618/16,718.

**Source:** https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22acetylsalicylic+acid%22+AND+openfda.product_type:%22HUMAN+OTC+DRUG%22 (no match) vs. the same query for "aspirin" (701); quotas per https://open.fda.gov/apis/authentication/


### What held up
WHAT HELD UP (verified live, 2026-08-31, not taken on trust):

- Claim 1 exactly right. `curl -D` on https://health-products.canada.ca/api/drug/drugproduct/?lang=en&type=json&id=13766 returns 200, `access-control-allow-origin: *`, `content-type: application/json; charset=utf-8`, `cache-control: no-cache`, server nginx, no auth. FR mirror https://produits-sante.canada.ca/api/medicament/drugproduct/ also 200 (note the endpoint segment stays English — /api/medicament/medicament/ errors).
- Claim 2 field names: verified live against drug_code 13452 for drugproduct, activeingredient, form, route, schedule, status, packaging, pharmaceuticalstd, therapeuticclass, company. Every field name matches.
- Claim 3: confirmed, including the sharp edge — /api/drug/company/?id=13452 returns an all-null object with company_code 0, so company detail is unreachable from the live API and only exists in comp.txt.
- Claim 5: confirmed exactly. ?ai_group_no=0108883004 returns the full unfiltered list starting at drug_code 225 PLACIDYL. Unknown params are dropped, not rejected. The DPD API guide documents only id/din/brandname/status/lang/type for drugproduct.
- Claim 6: confirmed. Live schedule for 13452 is "NON-PRESCRIPTION DRUGS"; the API guide prose does still list a phantom "OTC" schedule; the 12-value distribution over 13,952 schedule.txt rows matches the researcher's numbers to the row; zero of the 11,497 human marketed products lack a schedule row; the 622 ETHICAL products are indeed professional-use items (BACTERIOSTATIC WATER FOR INJECTION, XYLOCAINE, ADRENALIN, MANNITOL INJECTION) and must be excluded.
- Claim 7: 13,384 → 11,497 Human → 1,589 Human OTC reproduced exactly; brandname=advil returns 48 rows unfiltered and 25 with status=2, exactly as claimed.
- Claim 8: sunscreen dominance reproduced exactly (OCTISALATE 430, AVOBENZONE 416, OCTOCRYLENE 397, HOMOSALATE 359, then ACETAMINOPHEN 227). The ATC whitelist narrows 1,589 to 587 products / 107 multi-member groups.
- Claim 9: allfiles.zip is 200, application/zip, last-modified Tue 04 Aug 2026 15:38:38 GMT, exactly 1,500,321 bytes; all 12 files present with the exact row counts claimed; all _ap/_ia/_dr variants and all 13 per-table zips return 200; OGL-Canada licence confirmed on open.canada.ca (note OGL does require reasonable-effort attribution).
- Claim 4: every membership assertion reproduced from the extract. ai_group_no 0108883004 = 18 marketed human OTC products (all the named ones), 0102009002 = 24, 0122686001 = 12. The strength-suffix theory holds exactly: 0108883001/002/003/004/005/007 = ibuprofen 300/400/600/200/100/40 mg (008 is also 100 mg).
- Claim 11: confirmed, and it is the strongest finding in the whole study — DPD has no brand/generic field and the name heuristic misses every private-label product.
- The recommendation's UPC statement is right and now has a citation: package.txt has 7,764 rows with 0 non-empty UPC values, and the DPD API guide states "As of May 1, 2025, UPC values have been removed from the packaging file."
- No free Canadian OTC retail price feed surfaced; the synthesize-prices decision stands.

EXTRA GOTCHAS THE RESEARCHER MISSED:

1. ai_group_no is not a perfectly clean ingredient+strength key. 459 of 5,182 group numbers (8.9%) overall — and 33 of the 639 OTC ones — map to more than one distinct ingredient/strength signature. Most are harmless unit-expression variants (0.5% vs .5%, 100% vs 99.9% mineral oil), but 0100807001 genuinely mixes DEXTROMETHORPHAN HBr 15 mg and 30 mg, and 0106680029 mixes activated charcoal 222 mg / 225 mg / 50 g. Two of those are cough-and-cold products squarely in the app's whitelist, so a same-strength assertion in the FR1 text needs a strength cross-check, not a bare ai_group_no match.

2. Only 179 of the 272 multi-member OTC groups have two or more distinct DIN owners. The other 93 are one company's own line extensions (e.g. four ADVIL SKUs), which will render as "alternatives" that are the same brand at the same price. Filter on distinct company_name before showing a group.

3. Route filtering is not enough to make a group's members interchangeable. All 18 members of the ibuprofen 200 mg group are ORAL, but the group mixes TABLET and CAPSULE — and the acetaminophen 500 mg group includes a POWDER (EXTRA STRENGTH TYLENOL EASY DISSOLVE). Step 7 filters on route only; it needs form too, which the FR1 sentence already implicitly asserts.

4. Casing differs between the two access paths: the API returns status "Marketed" while status.txt returns "MARKETED", and the API returns pharmaceutical_form_name "Tablet" while form.txt returns "TABLET". Normalize, or a build script that mixes live calls with extract rows will silently drop rows.

5. noc_last_update_date is the sentinel "1111-11-11" on every NOC main record I pulled — do not surface it as a freshness date in the Expert Verification tab.

BOTTOM LINE: the DPD half of this study is unusually well verified — I could not break claims 1, 3, 4, 5, 6, 7, 8, 9 or 11, and the counts reproduce to the row. What fails is the NOC layer, which is the thing the verdict leads with and the thing the FR1 showcase sentence depends on. It works for 19 of 272 groups. The researcher's own stated FALLBACK — ai_group_no plus a hand-curated innovator whitelist, with the weaker "Health Canada assigns both products the same Active Ingredient Group Number" sentence — is not a fallback, it is the actual design for ~93% of the catalogue, and the plan and README should be rewritten around it, with the CRP/bioequivalence sentence treated as a bonus that appears on a minority of products.



## symptom-search — refuted: True


### Correction 1
**Original claim:** §4 Ranking: 'every product sharing that ingredient + strength + route (DPD ai_group_no is the exact equivalence key — it is Health Canada's own active-ingredient-group identifier and is far more reliable than string matching)'

**Correction:** ai_group_no groups on ingredient + strength VALUE only. It does not encode route or dosage form. Of the 7,057 ai_group_no values covering more than one product, 3,183 (45.1%) span more than one pharmaceutical form, 1,357 (19.2%) span more than one route of administration, and 693 (9.8%) span more than one strength UNIT. Concrete failure: group 0102009003 ('ACETAMINOPHEN','80','MG') contains drug_code 9718 CHILDRENS CHEWABLE ACETAMINOPHEN TAB 80MG (Tablet) alongside drug_code 6112 ATASOL DROPS USP 80MG/ML and 9719 ACETAMINOPHEN ORAL SOLUTION 80MG/ML (Drops/Solution). Using ai_group_no as the Tier-2 'price-equivalent alternatives' key would present paediatric 80 mg/mL oral drops as a cheaper swap for an 80 mg chewable tablet — a dosing error, in the exact screen the report designates as safe. The equivalence key must be ai_group_no JOINED with form.pharmaceutical_form_name and route.route_of_administration_name.

**Source:** Computed from https://health-products.canada.ca/api/drug/drugproduct/?lang=en&type=json + .../form/?lang=en&type=json + .../route/?lang=en&type=json + .../activeingredient/?lang=en&type=json (full dumps, fetched 2026-08-31)


### Correction 2
**Original claim:** Claim 6: '23,760 distinct drug_codes are NON-PRESCRIPTION DRUGS; 21,042 of those (88.6%) carry an ATC code. Top ATC level-2 groups among Canadian OTC: D02 (5,897), V07 (3,719), A11 (2,614), N02 (1,378), R05 (549), A06 (544), R06 (352), A02 (239)...'

**Correction:** The row counts are arithmetically right but describe the historical register, not a shippable catalogue. 83.1% of those 23,760 are dead: applying the report's OWN Step D filter (status IN 'Marketed','Approved') leaves 4,022 drug_codes; status='Marketed' alone leaves 2,840. Recomputed over Marketed-only OTC the ATC level-2 table is V07 909, D02 524, N02 221, R06 101, D08 93, D11 77, M01 65, A06 61, R05 57, S01 44, A07 37, D10 33, R01 29, M02 16 — an order of magnitude smaller, and A02 (antacid/acid) falls out of the top 20 entirely. Per-ingredient marketed OTC counts are thin: omeprazole 2, esomeprazole 1, famotidine 4, diclofenac 5, loperamide 15, dimenhydrinate 15, loratadine 18. ATC coverage over Marketed OTC is 87.6%, not 88.6%.

**Source:** Computed from https://health-products.canada.ca/api/drug/schedule/?lang=en&type=json (59,211 rows), .../status/?lang=en&type=json (58,239 rows), .../therapeuticclass/?lang=en&type=json (48,027 rows)


### Correction 3
**Original claim:** §2 Taxonomy: rows list docosanol 10% (cold sores), meclizine (nausea/motion sickness), attapulgite (diarrhea), dyclonine (sore throat), terbinafine (athlete's foot) and adapalene (acne) as 'Canadian OTC ingredients'; Step C claims human review 'removes US-only ingredients'

**Correction:** Six of those ingredients resolve to ZERO marketed Canadian non-prescription products, so the Step E join returns an empty result screen. DOCOSANOL: 0 records in the entire DPD activeingredient dump, any schedule, any status; no brand_name containing 'ABREVA' exists either — symptom 20 Cold sores is wholly unresolvable against DPD. MECLIZINE HYDROCHLORIDE: 3 records, 0 Marketed. ATTAPULGITE (ACTIVATED): 15 records, 0 Marketed. DYCLONINE HYDROCHLORIDE: 13 records, 0 Marketed. TERBINAFINE: 31 records, every one schedule=PRESCRIPTION (LAMISIL, LAMISIL DERMGEL, PMS-TERBINAFINE CREAM/SPRAY all PRESCRIPTION) — it is US-OTC but Canada-Rx. ADAPALENE: 12 records, all 10 marketed ones PRESCRIPTION (DIFFERIN, DIFFERIN XP, TACTUPUMP FORTE). These are exactly the US-OTC contaminations Step C is supposed to strip, and they are already baked into the shipped table.

**Source:** Computed from https://health-products.canada.ca/api/drug/activeingredient/?lang=en&type=json joined to .../schedule/ and .../status/ full dumps


### Correction 4
**Original claim:** Claim 1: 'dry eyes → Carboxymethylcellulose Na(35)', under the stated pattern search=indications_and_usage:"<symptom>" AND openfda.product_type:"HUMAN OTC DRUG", 'verified live for all 25 symptoms'

**Correction:** Executing the stated pattern with the symptom string 'dry eyes' returns 9 labels total, topped by EYELID CLEANSING WIPES (2), EYELID WIPES (2) and homeopathics; CARBOXYMETHYLCELLULOSE SODIUM does not appear at all. 'dry eye' (singular) returns 1 label. The 35 figure comes from a different phrase, 'dryness of the eye' (363 labels, CMC 35). The row was not executed as written, which undercuts the blanket 'verified live for all 25 symptoms' — and the taxonomy has 22 (+1 optional) symptoms, not 25.

**Source:** https://api.fda.gov/drug/label.json?search=indications_and_usage:%22dry%20eyes%22+AND+openfda.product_type:%22HUMAN+OTC+DRUG%22&count=openfda.generic_name.exact vs. the same query with %22dryness%20of%20the%20eye%22


### Correction 5
**Original claim:** Claim 8 detail: 'Fever (D005334, n=26) returns ceftazidime, meropenem, cefepime, ciprofloxacin (febrile-neutropenia indications). Cough (D003371, n=44) returns codeine, hydrocodone, hydromorphone, cocaine.'

**Correction:** Materially selective. D005334 Fever (n=26 confirmed) DOES include acetaminophen, ibuprofen, ibuprofen lysine, aspirin, naproxen, naproxen sodium, magnesium salicylate and salsalate alongside the antibiotics. D003371 Cough (n=44 confirmed) DOES include dextromethorphan, dextromethorphan hydrobromide, benzonatate and guaifenesin alongside the opioids. The central conclusion (do not use RxClass may_treat) still holds — it holds on Headache (19 members, acetaminophen and ibuprofen genuinely absent, confirmed verbatim) and Nasal Obstruction D015508 (2 members, xylometazoline only, confirmed) — but the fever/cough evidence as written overstates the case.

**Source:** https://rxnav.nlm.nih.gov/REST/rxclass/classMembers.json?classId=D005334&relaSource=MEDRT&rela=may_treat and ...classId=D003371...


### Correction 6
**Original claim:** Claim 12: 'Health Canada publishes 23 non-prescription drug Labelling Standards' with the enumerated list, and 'Sub-page URL pattern: .../nonprescription-drugs-labelling-standards/<slug>.html'

**Correction:** The enumeration is incomplete and internally inconsistent with the report's own taxonomy. At least three further standards live under exactly that sub-page path and are absent from the 23: Non-prescription Oral Adult Antitussive Cough and Cold LS, Nonprescription Oral Adult Expectorant Cough and Cold LS, and Non-prescription Oral Adult Nasal Decongestant LS. Two of those three are cited as the HC source for taxonomy rows 6 (nasal congestion) and 8 (cough) — so either the count of 23 is wrong or those two rows are citing sources the report says do not exist. Separately, the 'Adult Cough, Cold and Flu LS [2025-04-01]' that IS listed does not follow the claimed sub-page pattern: its canonical title is 'Non-prescription Oral Adult Cough, Cold and Flu Labelling Standard' and it sits at /en/health-canada/services/drugs-health-products/natural-non-prescription/legislation-guidelines/guidance-documents/non-prescription-oral-adult-cough-cold-flu-labelling.html. CAVEAT: www.canada.ca is unreachable from this environment (curl connection failure, WebFetch HTTP 403 on every canada.ca URL), so this rests on indexed URLs/titles rather than the index page itself — re-verify the exact count in a browser before publishing it.

**Source:** https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/applications-submissions/guidance-documents/nonprescription-drugs-labelling-standards/non-prescription-oral-adult-nasal-decongestant-labelling-standard.html ; .../nonprescription-oral-adult-expectorant-cough-cold-labelling-standard.html ; .../non-prescription-oral-adult-antitussive-cough-cold-labelling-standard.html ; https://www.canada.ca/en/health-canada/services/drugs-health-products/natural-non-prescription/legislation-guidelines/guidance-documents/non-prescription-oral-adult-cough-cold-flu-labelling.html


### What held up
WHAT HELD UP (re-executed live, 2026-08-31):

- Claim 2 verified byte-for-byte. The full application_number facet came back in the exact order and counts given, including every dirty value: M020 7216, M012 3912, M017 3103, M003 2321, M013 1693, M019 1466, M016 1386, M006 1101, M021 1036, M005 1022, M007 874, M022 822, M001 743, M032 630, M018 512, M015 437, M004 432, M028 289, M010 261, M002 258, M008 227, M014 135, M009 117, M030 112, 'M' 111, M011 74, M027 49, M031 43, M024 18, 'M20' 11, 'M505G(a)(3)' 11, M026 10, 'M009.50' 6, M023 6, M029 3, 'M334' 3. Three extra strays the report missed: 'M007.54'(4), 'M007.60'(3), 'M013.50'(3), 'M016B'(3) — reinforces the validate-against-canonical-list advice.
- Claim 3 verified exactly: the Federal Register .txt is 30,669 bytes, contains the Table 1 heading, and yields exactly M001–M032 with no gaps. The API JSON confirms document 2021-20393, published 2021-09-21.
- Claim 5 verified exactly: id=5254 returns [{"drug_code":5254,"tc_atc_number":"N02BE01","tc_atc":"ACETAMINOPHEN (PARACETAMOL)"}], three fields only; the full dump is 3,748,601 bytes / 48,027 rows / 2,659 distinct ATC codes; din= is indeed silently ignored (byte-identical full dump). Grepping the DPD documentation page for 'ahfs' returns nothing — no AHFS anywhere.
- Claim 7 verified. Additional supporting evidence the report did not use: every OTC drug_code in DPD carries at most ONE distinct ATC code (0 of 21,042 have more than one), so ATC structurally cannot express the many-to-many symptom relation.
- Claim 9 verified: count=purpose returns the exact illegal_argument_exception quoted; purpose:"antihistamine" 7,412, "antacid" 1,796, "pain reliever" 13,096. Bulk is 14 partitions × 20,000 records (262,271 total) but 1,770.9 MB, not "~1.9 GB".
- Claim 10 verified: all twelve _exists_ counts match to the digit (warnings 49,916 … ask_doctor_or_pharmacist 9,097) against 49,929 total OTC labels.
- Claim 11 verified: the M001/M007/M008/M012/M013 stop_use and ask_doctor strings came back verbatim as quoted.
- Rate limits confirmed on open.fda.gov/apis/authentication: 240 req/min + 1,000 req/day per IP unauthenticated; 240/min + 120,000/day with a free key. No billing card. openFDA CC0 1.0 dedication confirmed on open.fda.gov/license.
- meta.last_updated is 2026-08-28 and indications_and_usage:"headache" = 13,445, both exactly as claimed. The headache/runny-nose/heartburn/constipation/athlete's-foot/acne/nasal-congestion/diarrhea/motion-sickness/cold-sores/hemorrhoids facets all reproduced (small note: 'Cetirizine HCl 244' is actually CETIRIZINE HYDROCHLORIDE 244 with a SEPARATE CETIRIZINE HCL 100 bucket, same for diphenhydramine 192/188 — which strengthens the Step B normalization argument).
- The dandruff aside checks out precisely: 75 marketed Canadian non-prescription products across pyrithione zinc / ketoconazole / selenium sulfide / coal tar.

GOTCHAS THE REPORT DID NOT ADDRESS:

1. NO PRICE DATA EXISTS ANYWHERE. I dumped every DPD endpoint — drugproduct, activeingredient, status, company, form, route, packaging, schedule, therapeuticclass — and not one carries a price field. openFDA has none either. Yet §4 Ranking is built entirely on "sorted price ASCENDING" and FR2 is "ascending by price". The feasibility verdict FEASIBLE_FREE is silent on the one data class the ranking design depends on, and there is no free, licensed source of Canadian OTC retail prices. This is the biggest hole in the study.

2. DPD DOES expose a `upc` field — on the packaging endpoint (https://health-products.canada.ca/api/drug/packaging/?lang=en&type=json, keys: drug_code, package_size, package_size_unit, package_type, product_information, upc) — but it is EMPTY in all 58,239 rows. Zero non-empty UPC values, zero drug_codes with a barcode. Any barcode-scan feature has no Canadian source here.

3. Step D says "four full-dump calls, ~33 MB total" but lists five endpoints; actual sizes are drugproduct 15.0 MB + activeingredient 16.1 MB + schedule 3.2 MB + status 10.3 MB + therapeuticclass 3.7 MB = 48.3 MB, plus form 5.5 MB / route 6.5 MB which the corrected ai_group_no join now requires (~60 MB). Also its filter `schedule_name == 'NON-PRESCRIPTION DRUGS' AND schedule_name != 'HOMEOPATHIC'` is dead code on a single row, and unnecessary: 0 of the 23,760 OTC drug_codes also carry a HOMEOPATHIC schedule row (968 drug_codes overall do carry multiple schedules, so the intent is not crazy, just misapplied).

4. The LNHPD API base is /api/natural-licences/ (plural, e.g. .../natural-licences/productlicence/?lang=en&type=json) — /api/natural-licence/ 404s. Worth pinning before the fallback path relies on it.

5. openFDA's own meta block ships a mandatory disclaimer ("Do not rely on openFDA to make decisions regarding medical care") on every response. Given §6's positioning, that string should probably appear in the Tier-0 footer alongside the app's own text.

NET: the licensing verdict (CC0 / OGL-Canada, no keys, no billing) and the strategic recommendation (frozen hand-curated table, openFDA offline as evidence generator, ATC as QA cross-check not as map, no classification API at request time) all survive intact and are well evidenced. What fails is the execution layer: the equivalence key is wrong in a safety-relevant way, the catalogue is ~8x smaller than the report's numbers imply, six taxonomy ingredients resolve to nothing in Canada, and the price sort has no data source.



## barcode-ocr — refuted: True


### Correction 1
**Original claim:** Claim 4: "GS1 US created Application Identifier (75) to carry the NDC instead, which UPC-A retail symbols cannot express."

**Correction:** The GS1 Application Identifier for the NDC is AI (715), not AI (75). The FDA final rule text states verbatim: "GS1 US states that it has created an application identifier (AI) for the NDC, referred to as ``AI (715).'' GS1's AI (715) is an additional data element that enables the NDC to be encoded in barcodes that can manage multiple AIs... the following barcodes can encode AI (715) for the 12-digit NDC: (i) the GS1 2D DataMatrix barcode (nonlinear); (ii) the GS1-128 barcode (linear); and (iii) the GS1 DataBar barcode (linear)." The substance (UPC-A cannot carry it) is correct — the rule also says "GTIN-12 and GTIN-14 cannot accommodate the embedding of a 12-digit [NDC]" and "GS1 US indicated that industry will no longer be able to use the UPC-A barcode" — but the AI number is wrong and would send anyone implementing this to the wrong spec.

**Source:** https://www.federalregister.gov/documents/full_text/text/2026/03/05/2026-04368.txt


### Correction 2
**Original claim:** Claim 4: "FDA's proposed 12-digit NDC format (Federal Register 2022-15414)" — cited as a proposed rule.

**Correction:** It is no longer proposed. FDA issued the FINAL rule on 2026-03-05 as FR document 2026-04368, same title, type "Rule", action "Final rule.", effective 2033-03-07. The 2022-15414 document the researcher cited is the superseded proposed rule (comments closed 2022-11-22). Practical effect on the project is mild — the 7-year effective date means the NDC-in-GTIN trick in chain step 2 keeps working through 2033 — but the citation and the word "proposed" are both out of date, and the correct citation is the one that carries the actual compliance deadline.

**Source:** https://www.federalregister.gov/api/v1/documents/2026-04368.json (type "Rule", action "Final rule.", effective_on "2033-03-07") — https://www.federalregister.gov/documents/2026/03/05/2026-04368/revising-the-national-drug-code-format-and-drug-label-barcode-requirements


### Correction 3
**Original claim:** Claim 7: "Even on a hit the payload has no DIN, no active ingredient and no Canadian price — just a marketing title, brand string, category and stale US retailer offers."

**Correction:** Wrong on the price and on the retailer. The live lookup of 062600142290 returns "currency":"CAD", "lowest_recorded_price":10.97, "highest_recorded_price":12.47, and a single offer from "merchant":"WalMart Canada", "domain":"walmart.ca", "price":11.98 — a Canadian retailer with a CAD price, not a US one. "Stale" is fair: that offer's updated_t is 1572532412 (31 Oct 2019, ~7 years old). The no-DIN and no-active-ingredient parts hold. This matters because the study elsewhere implies no source carries OTC retail prices; UPCitemdb does carry a badly stale Canadian one on the ~33% of national brands it hits.

**Source:** https://api.upcitemdb.com/prod/trial/lookup?upc=062600142290 (live, full JSON payload)


### Correction 4
**Original claim:** Claim 11: "The historic open free trial has been withdrawn due to abuse; a limited 'Hacker' free plan with a small daily allowance and mandatory attribution remains, with the paid starter pack reported at $299/month."

**Correction:** No free plan of any kind remains. The Nutritionix developer portal homepage states verbatim: "For over a decade, we've proudly offered an open, no-cost trial for developers, students, and hobbyists. Unfortunately, due to increased misuse of free trial accounts, we are no longer able to maintain a public free-access tier." Access is now sales-gated ("our team would be happy to provide a limited trial account tailored to your use case... A member of our sales team will respond"). There is no Hacker tier and no published daily allowance. The $299/month figure is also unsourced from Nutritionix itself — https://developer.nutritionix.com/pricing returns HTTP 404, and the only citation given was calorieapi.com, a competing vendor's blog. The claim's conclusion (not applicable to MediSense) still stands, but for a stronger reason than stated.

**Source:** https://developer.nutritionix.com/ (live homepage notice); https://developer.nutritionix.com/pricing returns HTTP 404


### Correction 5
**Original claim:** Seeding plan: "Harvest these via search-result URLs — direct page fetches are Akamai-403'd (verified)."

**Correction:** Direct product-page fetches are not blocked. GET https://www.shoppersdrugmart.ca/p/BB_062600142290?variantCode=062600142290 returns HTTP 200 with the full Next.js page (title "Tylenol Extra Strength Pain Relief Acetaminophen 500mg | Shoppers Drug Mart", __NEXT_DATA__ present, the string 062600142290 appearing 152 times) — both with a Chrome User-Agent and with curl's default UA. The Life Brand URL BB_057800974116 also returns 200. What actually happens on the shop.shoppersdrugmart.ca host the researcher used is a 302 redirect to www.shoppersdrugmart.ca, likely mistaken for a block. The search-result-URL workaround is unnecessary; direct fetch is the simpler harvest path, which makes the 4-6 hour seeding estimate conservative rather than optimistic.

**Source:** https://www.shoppersdrugmart.ca/p/BB_062600142290?variantCode=062600142290 (live, HTTP 200)


### What held up
VERDICT SURVIVES. The central finding — no free or paid API reliably maps a Canadian OTC barcode to a drug product, so UPC→product must live in a seeded local table — held under every attack I made. FEASIBLE_WITH_SYNTHETIC_DATA and BUILD THIS both stand. The five corrections are errors of detail; two of them (UPCitemdb does return a CAD price; Shoppers pages are directly fetchable) make the project marginally easier, not harder. refuted=true reflects that claims 4, 7 and 11 do not hold as written, not that the recommendation is wrong.

WHAT I VERIFIED EXACTLY, NUMBER FOR NUMBER:
- Claim 1 (DPD): downloaded the full 6,926,862-byte JSON. 58,239 records; keys exactly as claimed; upc non-empty = 0, package_size = 0, package_size_unit = 0, package_type = 0; product_information non-empty = 44,660. /packaging/?id=5255 returns the record quoted byte for byte. Airtight.
- Claim 2 (allfiles.zip): downloaded 1,442,310 bytes, unzipped, parsed package.txt — 15,804 rows, 6 columns, column 2 non-empty in exactly 4 rows, values ['2X','100','5','5']. Airtight.
- Claim 3 (NDC→GTIN-12): recomputed the GS1 mod-10 check digit independently: '3'+'0045044910' → check digit 8 → 300450449108. Matches. One drift: openFDA now returns THREE records for openfda.upc:"0300450449108" (67414-449 Jones Healthcare, 50580-449 Kenvue, 50580-937 Kenvue), not the two claimed. Doesn't affect the mechanism.
- Claim 5 (openFDA): every count matches to the digit as of meta.last_updated 2026-08-28 — 137,590 total / 56,618 OTC / 16,718 OTC with _exists_:openfda.upc / 38,629 with any UPC. The zero-pad gotcha reproduces exactly: "300450449108" → NOT_FOUND, "0300450449108" → hits. Rate limits confirmed on open.fda.gov: 240/min + 1,000/day per IP keyless; 240/min + 120,000/day per key, key free.
- Claim 6: "0062600142290" → {"error":{"code":"NOT_FOUND"}}. Confirmed.
- Claim 7 (tier limits): X-RateLimit-Limit: 100 observed in live response headers. Docs confirm FREE 100 combined + 20 searches/day, 6 lookups/min, batch 2, 1 connection; DEV 20,000+2,000, batch 10, 2 connections; PRO 150,000+20,000, 12 lookups/sec, 6 connections. Coverage reproduced: 062600142290 HIT, 062600142641 HIT, 057800974116 MISS, 064541319854 MISS.
- Claim 8: OPF total 45,010; categories_tags_en=medicines count exactly 112. OFF 0300450449108 → "Tylenol extra strength", countries "United States", brands "". OFF 0062600142290 → "Tynelol", countries "Canada". OFF 0057800974116 → status 0 "product not found". Airtight.
- Claim 9 (Go-UPC): $74.95/5,000, $245/45,000, $795/450,000, trial key by request only, no published free allowance. Confirmed.
- Claim 10 (GEPIR, self-rated medium): confirmed retired 31 Dec 2023, replaced by Verified by GS1; GS1 US Data Hub $500/year for unlimited lookups. One nuance in the project's favour — the free web search is 30 searches PER DAY, not "roughly 30 free searches" total. Also gepir4hosting.gs1.org is still live as a hosting instance for some member organisations, so "dead" is right globally but not universally.
- Claim 12: the SDK 52 changelog says verbatim "expo-barcode-scanner has been removed: it was deprecated in SDK 50 and slated for removal in SDK 51." Confirmed; expo-barcode-scanner's last npm publish is 13.0.1 on 2024-04-23.
- Stack versions: every pin is the current npm latest — expo 57.0.18 (2026-08-28), expo-camera 57.0.4 (2026-08-20), expo-mlkit-ocr 0.2.7 MIT (2026-05-06), fuse.js 7.5.0 (Apache-2.0), bwip-js 4.11.4, jsbarcode 3.12.3, expo-build-properties 57.0.15. None deprecated. SDK 57 = React Native 0.86 confirmed (57.0.17 bumped to RN 0.86.3).
- Web build: verified in expo-camera 57.0.4's own shipped source (build/web/WebBarcodeScanner.js line 46 and src/web/WebBarcodeScanner.ts line 69). It reads globalThis.BarcodeDetector and falls back to `await import('barcode-detector')`. package.json has "barcode-detector": "^3.0.0" as a hard dependency, and barcode-detector 3.2.2 pins zxing-wasm at exactly 3.1.3. The researcher's description of this mechanism is precisely right.

ADDITIONAL GOTCHAS THE RESEARCHER MISSED (none fatal, all worth a line in the risk section):

1. The "free" Vision API fallback needs a credit card and has no spend cap. Cloud Vision setup lists "Enable billing" as a mandatory step — "Verify that billing is enabled for your Google Cloud project" — before the API can be enabled at all. The 1,000 free units/month is a tiered discount, not a hard ceiling: unit 1,001 onward bills automatically at $1.50/1,000. Worse, an API key shipped inside a React Native bundle is trivially extractable, so a leaked key on a no-budget student project bills the student. Mitigation the plan should name: restrict the key to the Vision API only and set a Cloud Billing budget alert, or drop the fallback and require the dev build. (https://docs.cloud.google.com/vision/docs/setup, https://cloud.google.com/vision/pricing)

2. "Web build works with no extra effort" carries a runtime third-party CDN dependency. zxing-wasm does not bundle its .wasm — its README states "a `.wasm` binary file needs to be served somewhere... the serve path is automatically assigned a jsDelivr CDN URL upon build," resolving to https://fastly.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/…. So on exactly the browsers the plan cites as the reason for the polyfill (iOS Safari, Firefox), the first scan blocks on a jsDelivr fetch. A stage demo on venue wifi, an offline demo, or any strict CSP breaks scanning with no error surfaced through expo-camera. Fix is one call to prepareZXingModule({overrides:{locateFile}}) pointing at a self-hosted copy. (https://github.com/Sec-ant/zxing-wasm README, "Configuring .wasm Serving")

3. expo-mlkit-ocr is a maintenance risk the study presents as settled. 16,552 downloads last month against expo-camera's 7,859,705 — roughly 0.2%. Single maintainer (rbayuokt). Last publish 2026-05-06, three months before SDK 57 shipped, so it has never been released against RN 0.86. Its version history runs backwards — 1.0.0 (2025-05-20) → 2.0.0 → 2.0.1 (2025-06-24) → 0.2.0 (2026-05-01) → 0.2.7 — i.e. the package was reset to a pre-1.0 line, which is what you'd expect from a rewrite, not from something "production-ready" (that phrase is the author's own npm description, not a third-party assessment). Its README also says the failure mode requires BOTH settings: "Without `deploymentTarget: \"16.0\"` and `useFrameworks: \"static\"`, you will get: Cannot find native module 'ExpoMlkitOcr'." The study's stack section names only deploymentTarget. Add useFrameworks: "static" or budget a debugging session.

4. UPCitemdb's ToS is thinner than a dependency deserves. The URL the study cites a sibling of, https://www.upcitemdb.com/wp/docs/main/development/terms-of-service/, is a 404; the live terms at https://devs.upcitemdb.com/termsofservice grant only "a limited, non-exclusive, non-transferable and terminable license to access and use the Service solely for Customer's operations" and say nothing about caching, redistribution, or database construction. Since chain step 5 explicitly self-heals the local product_barcodes table from lookups, the app would persist third-party data under a license that neither permits nor forbids it, from a keyless tier revocable without notice. Low stakes for a portfolio project; name it rather than assume it.

5. The chain's expected pre-OCR hit rate is never stated. Step 2's predicate only fires on US-labeled packages, and claim 5's own figure says just 29.5% of openFDA OTC records carry a UPC at all; step 3 is measured at 2/6 on national brands and 0/4 on store brands. The realistic combined yield of steps 1-3 on a Toronto shelf, before the seeded table exists, is low — which argues for the seeded table rather than against the plan, but the study should say the number out loud so the demo doesn't over-promise.



## trust-safety — refuted: True


### Correction 1
**Original claim:** CLAIM 9: Health Canada's "Same active ingredient group number" link is "the authoritative, government-hosted equivalence list" — and the recommendation puts Badge B ("Same ingredient + strength as Advil") "on every alternative" driven off that AIG group.

**Correction:** OVERSTATED, and dangerously so for a medicine-finder. The AIG number encodes ONLY (a) number of active ingredients, (b) ingredient identity group, (c) strength group. By Health Canada's own definition it encodes NO route of administration and NO dosage form — so an AIG group is a same-ingredient-and-strength list, NOT an equivalence or alternatives list. Decisive counterexample I pulled live: AIG 0102009008 contains BOTH drug_code 60256 / DIN 02236961 "ACETAMINOPHEN" (PHARMEL INC), which is acetaminophen 650 MG, route=Rectal, form=Suppository, AND drug_code 62325 / DIN 02238885 "TYLENOL ARTHRITIS PAIN 8H" (KENVUE CANADA INC.), which is acetaminophen 650 MG, route=Oral, form=Tablet (Extended-Release). Same AIG, different route, and immediate-vs-extended release. An alternatives list built on ai_group_no alone will offer a rectal suppository as a swap for an oral tablet, and an 8-hour extended-release tablet as a swap for an immediate-release one. The researcher's "ONE ACCURACY TRAP YOU MUST NOT WALK INTO" section correctly warns that AIG != bioequivalence, but omits this second, larger trap. FIX: the alternatives query must intersect ai_group_no with route (/api/drug/route/?id=) and pharmaceutical form (/api/drug/form/?id=), and Badge B's wording must not imply interchangeability across forms.

**Source:** https://health-products.canada.ca/api/drug/drugproduct/?id=60256&type=json and https://health-products.canada.ca/api/drug/drugproduct/?id=62325&type=json (both ai_group_no 0102009008); routes/forms via https://health-products.canada.ca/api/drug/route/?id=60256&type=json (Rectal) vs https://health-products.canada.ca/api/drug/route/?id=62325&type=json (Oral); AIG definition footnote 5 on https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=13452


### What held up
SCOPE OF THE REFUTATION: only Claim 9's "equivalence list" framing is overstated. The study's headline verdict (FEASIBLE_FREE) and its central recommendation (drop the word "pharmacist"; assert a source, not a reviewer) both survive scrutiny intact. This is an unusually well-sourced piece of research — I could not break the other 11 claims, and most quotes matched the primary source character-for-character.

VERIFIED VERBATIM (I re-read the primary source in each case):

1. Pharmacy Act, 1991 s.10(1), s.10(2), s.12 — exact, including the $25,000 / $50,000 fines and the amendment cite "2007, c. 10, Sched. B, s. 18 (4)". Note s.11 was repealed by 2021, c. 25, Sched. 25, s. 26 (doesn't affect the argument). Fetched via curl; ontario.ca/laws is a JS shell that WebFetch cannot read.
2. OGL-Canada 2.0 — non-endorsement clause, attribution string, the "worldwide, royalty-free, perpetual, non-exclusive... including for commercial purposes" grant, and governing law (Ontario) all exact. BONUS SUPPORT the researcher missed: canada.ca's Trademark notice separately bans reproducing "the Canada wordmark, the Arms of Canada, and the flag symbol... whether for commercial or non-commercial purposes, without prior written authorization" — an independent second reason not to put GoC branding on the badge.
3. canada.ca non-commercial reproduction terms — exact, all three conditions. (canada.ca hard-blocks this environment over HTTP/2 and 403s WebFetch; read via Wayback snapshot 20260829051517, i.e. yesterday.) Confirmed applicable: health-products.canada.ca's own footer links to https://www.canada.ca/en/transparency/terms.html, and the DPD dataset on open.canada.ca carries license_id "ca-ogl-lgo" / "Open Government Licence - Canada", so both Claim 2 and Claim 3 attach to the right material.
4. Health Canada Comparative Bioavailability Standards — exact. Dates confirmed (Adopted 2012/12/08, Revised 2018/06/08, Effective 2018/09/01). The critical subtlety is REAL: s.2.1 criterion 1 is a 90% CI on AUC_T, criterion 2 is a bare point estimate of relative mean Cmax with no CI. The 2018 change log literally records "From: ...should be between 80.0% - 125.0%... To: ...should be within 80.0% - 125.0%..." at Section 2.1. s.2.1.1.6 (AUC 90% CI 90.0-112.0%, Cmax 90% CI 80.0-125.0%) and s.2.1.1.1 (Cmin not less than 80.0%) both confirmed.
5. FDA Statistical Approaches to Establishing Bioequivalence — confirmed as a FINAL guidance, cover reads "May 2026", CDER, Biopharmaceutics/Generic Drugs. https://www.fda.gov/media/163638/download returns HTTP 200, application/pdf, exactly 623,868 bytes as claimed. Both quoted sentences extracted verbatim from the PDF text. Federal Register 91 FR 32056 (2026-05-29) confirms it finalizes the 5 Dec 2022 draft and replaces the 2 Feb 2001 guidance. The Canada-vs-FDA contrast the researcher draws (FDA does apply a 90% CI to Cmax, Canada does not) is correct and is the most valuable technical finding in the study.
6. Health Canada "Safety and Effectiveness of Generic Drugs" — all three quotes exact, and the page footer confirms "Updated: April 2012 Original: April 2001", so the recency caveat is warranted.
7. FDA Generic Drugs Q&A — both quotes exact, plus the third one ("Bioequivalence generally means the generic drug delivers the same amount of active ingredient... at the same rate and to the same extent"). MINOR: the cited URL now 301s to https://www.fda.gov/drugs/generic-drugs/generic-drugs-questions-answers — cite the destination, since WebFetch 404s on the old path even though curl follows it.
8. FDA Generic Drug Facts — five-point list exact, "Content current as of: 11/01/2021" exact, and the 30% / nearly 85% price figures exact.
9. Mechanics all confirmed even though the framing is overstated: /dpd-bdpp/info?lang=eng&code=13452 returns 200 with DIN 01933531, Marketed, 2025-05-22, HALEON CANADA ULC, Tablet, Oral, NON-PRESCRIPTION DRUGS, M01AE01, AIG 0108883004, IBUPROFEN 200 MG. The literal anchor <a href="/dpd-bdpp/search-fast-recherche-rapide?lang=eng&no=0108883004">Same active ingredient group number</a> is present in the page source. The AIG group page returns 61 products. Monograph https://pdf.hres.ca/dpd_pm/00080634.PDF returns 200, application/pdf, exactly 655,238 bytes. The AIG footnote does include "The strength group has a tolerance of -2% to +10%" (it uses a non-breaking hyphen, U+2011, so a naive grep for "-2%" misses it).
10. DPD JSON API confirmed: ai_group_no present on every record; the ADVIL CAPLETS record matches field-for-field; ADVIL CAPLETS/TABLETS/GEL CAPLETS/LIQUI-GELS all 0108883004 and CHILDREN'S ADVIL 0108883005; activeingredient?ingredientname=ibuprofen returns exactly 209 records; ?din=01933531 returns 200. No auth, no key, no quota, no billing card observed.
11. HONcode is genuinely dead. Confirmed the September 2022 notice text including "Despite all our efforts, it is no longer possible to maintain it", discontinuation 15 December 2022, and I independently reproduced healthonnet.org failing to resolve (curl exit, HTTP 000) while fda.gov, nngroup.com and health-products.canada.ca all returned 200 in the same batch.
12. NN/g "Trustworthiness in Web Design" — "In 1999 Jakob Nielsen listed 4 ways..." and both quoted sentences exact.

ALSO CHECKED AND SOUND (from the recommendation body, not the numbered claims): the two NN/g icon-usability quotes are exact ("Icon labels should be visible at all times, without any interaction from the user" / "fails to translate well on touch devices"); WCAG 2.2 SC 2.5.8 24x24 CSS px and SC 1.4.1 are the right citations; the NHS figures trace to Rowlands et al. 2015 (43% of working-age adults, rising to 61% with numbers) — correctly rounded, though they are England-specific and a Canadian app should say so; "Category IV Monograph" is still live Health Canada terminology, so that caveat stands.

LIBRARY / VERSION CLAIMS — all correct, which is rare: react-native-spotlight-tour dist-tags.latest is 4.0.0, licence MIT, repo pushed_at 2026-08-17T21:23:35Z, not archived. Issue #202 is real, still open, created 2026-01-06T22:45:31Z, title matches word-for-word ("Tooltip not rendering on iOS with Expo 54 + New Architecture (Fabric)..."). @react-native-async-storage/async-storage latest is 3.1.1 (published 2026-05-29). RN 0.82 is confirmed New-Architecture-only (newArchEnabled=false and RCT_NEW_ARCH_ENABLED=0 are ignored).

ADDITIONAL GOTCHAS THE STUDY DID NOT FLAG:

A. NO BARCODE/UPC. The task asked whether DPD exposes UPC — the answer is it used to and no longer does. The /api/drug/packaging/ object still has a `upc` field, but the documentation states: "The Universal Product Code. As of May 1, 2025, UPC values have been removed from the packaging file." The sample response in Health Canada's own docs shows "upc":"". Same May 2025 change collapsed package_size / package_size_unit / package_type into a free-text `product_information` string. So any barcode-scan-the-box feature is dead on arrival from DPD, and package-size parsing is now string-mangling, not structured data.

B. NO PRICES ANYWHERE. Nothing in DPD carries retail price, and Health Canada's API intro says outright: "For information on where these products are sold, please contact the individual company directly." The recommendation's line "Prices on this page are illustrative and are not from a pharmacy" is therefore not optional politeness — it is the only honest option. Good that the study already conceded this.

C. STATUS IS A SECOND CALL. Claim 10 says "the badge and the alternatives list share one field", but the /api/drug/drugproduct/ record has NO status field (keys are drug_code, class_name, drug_identification_number, brand_name, descriptor, number_of_ais, ai_group_no, company_name, last_update_date). The renamed FR4 filter "Health Canada listed only" needs current status Marketed, which requires either /api/drug/status/?id={drug_code} (returns {"status":"Marketed","history_date":"2025-05-22",...}) or the query param ?status=2. Good news I verified: ?status=2 DOES compose with ?brandname= and ?din= (brandname=advil drops from 48 to 25 records), so the filter is cheap — but it is a second parameter the study didn't mention, and the AIG group page does NOT filter by status, so "See every product Health Canada puts in this group" will include cancelled and dormant DINs.

D. react-native-spotlight-tour 4.0.0 was published 2025-06-23 — over 14 months without a release. The 2026-08-17 repo push is commit activity, not a release. The study calls every alternative "stale or 0.x" while treating 4.0.0 as current; by its own standard 4.0.0 is also stale. It also pulls three runtime deps (@floating-ui/react-native, react-fast-compare, react-native-responsive-dimensions) and peer-requires react-native-svg >=12.1.0. This strengthens rather than weakens the build-it-in-house recommendation.

E. Badge B's referent is ambiguous. "Same ingredient + strength as Advil" — but "Advil" spans at least seven AIGs (0108883004 for 200 mg, 0108883002 for extra strength, 0108883003 for 12 Hour, 0108883005 for Children's, etc.). The badge must name the specific product and strength, not the brand family.
