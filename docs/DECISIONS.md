# Architecture Decision Records — MediSense

Each ADR records a decision, why it was taken, and what would reverse it.
Evidence lives in `RESEARCH.md`.

---

## ADR-001 — Expo / React Native, not a Next.js PWA

**Decision.** Build with Expo + React Native, exporting to web as a secondary target.

**Why.** Camera barcode scanning, geolocation and maps are all stated functional requirements
(FR4, FR-map). The deciding fact is that `expo-camera`'s web build falls back to the
`barcode-detector` ZXing-WASM polyfill when `globalThis.BarcodeDetector` is absent, so barcode
scanning works on iOS Safari *and* natively from one codebase. A Next.js PWA would give only the
web half and would still have to hand-roll the same polyfill.

**Reverses if.** The project drops the camera requirement.

---

## ADR-002 — Target Expo SDK 54, not 57

**Decision.** Pin to SDK 54.

**Why.** This machine has Command Line Tools but not Xcode.app — no iOS Simulator, no
`expo run:ios`. App Store Expo Go is pinned to SDK 54 (55/56/57 awaiting Apple approval), so SDK 54
is the only configuration that runs on a physical iPhone here at zero cost. The verification plan is
re-running the study's four timed tasks on a phone, so device testing is not optional. Nothing in
this build needs an SDK 55+ feature.

**Reverses if.** Xcode gets installed — then SDK 57 costs nothing extra.

---

## ADR-003 — Bundled SQLite index, not a runtime API

**Decision.** Ship a prebuilt SQLite + FTS5 database as a bundle asset. Build-time scripts fetch and
join the source data; the phone never calls Health Canada.

**Why.** Three independent reasons. (1) The DPD API has **no `ai_group_no` query parameter** and
silently ignores unknown params — returning the full unfiltered dataset rather than erroring — so
the core equivalence query is impossible online. (2) The study measured 42.51 s for search tasks;
a local FTS5 query is sub-50 ms with no cold start. (3) DPD publishes no rate limit and no SLA;
a mobile app fanning out per-product calls could be throttled with no warning.

**Reverses if.** Never, for this dataset. Prices could later refresh over the network.

---

## ADR-004 — Equivalence key is `ai_group_no` ∩ route ∩ form ∩ schedule

**Decision.** Never group on `ai_group_no` alone.

**Why.** The Active Ingredient Group number encodes ingredient identity and strength only. Of 7,057
multi-product groups, 45.1% span more than one dosage form and 19.2% span more than one route.
AIG `0102009008` contains acetaminophen 650 mg rectal suppository alongside Tylenol Arthritis 8H
oral extended-release tablet. AIG `0102009003` contains an 80 mg chewable tablet alongside
80 mg/mL oral drops. Grouping on AIG alone offers a suppository as a swap for a caplet.

The schedule re-filter is equally load-bearing: prescription products share groups with their OTC
counterparts (Nexium 24HR sits with 12 prescription esomeprazole products).

**This is a safety constraint, not a display preference.** It is enforced by a build-time assertion.

**Reverses if.** Never.

---

## ADR-005 — The badge asserts a source, not a reviewer

**Decision.** Replace "Pharmacist Verified" with `Health Canada listed · DIN <n>`. Rename the
"pharmacist verified only" filter to "Health Canada listed only". No fictional pharmacist persona,
no fabricated credential.

**Why.** Three independent reasons, in order of force:

1. **Legal.** Ontario *Pharmacy Act, 1991* s.10(2): "No person other than a member shall hold
   himself or herself out as a person who is qualified to practise in Ontario as a pharmacist."
   s.12 makes contravention an offence with a fine up to $25,000 (first offence).
2. **Licensing.** OGL-Canada 2.0 forbids using the Information "in a way that suggests any official
   status or that the Information Provider endorses you." canada.ca's trademark notice separately
   bars reproducing the Canada wordmark or flag symbol.
3. **Usability.** This is the study's own finding. A participant said: "I don't know exactly what
   pharmacist-verified means." Another: "all of them should be pharmacist verified anyways."
   Asserting a checkable source fixes the comprehension failure that a softer badge would not.

**This is the one deliberate deviation from the design document.** It should be flagged in any
write-up as a reasoned ethical correction, not an unimplemented requirement.

**Reverses if.** The user prefers the persona as explicitly-labelled sample data. Research rates
that strictly worse — users skim past "sample data" labels — but it is a one-component change.

---

## ADR-006 — Two accuracy limits on the equivalency copy

**Decision.** (a) A shared AIG is stated as "same active ingredient at the same strength", never as
"Health Canada found these bioequivalent". (b) The 80–125% rule is presented as general context on
how Canada approves generics, never as a claim about the pair on screen. (c) Where a bioequivalence
citation is made, Canada's rule is stated correctly.

**Why.** Many Canadian OTC products are authorised under a Category IV Monograph with no comparative
bioavailability study at all, so for many pairs no bioequivalence finding exists. Separately, Canada
puts the 90% confidence interval on **AUC_T only** — Cmax is a relative-mean point estimate. The FDA
applies the CI to both. Citing Health Canada while stating the FDA rule turns the most persuasive
fact in the app into its most embarrassing error.

Also: inactive ingredients genuinely can differ between brand and generic and can matter for
allergies. The copy says so.

**Reverses if.** Never.

---

## ADR-007 — (SUPERSEDED by ADR-017)  Prices: real ratios where they exist, deterministic seed elsewhere, always disclosed

**Decision.** Three layers. Brand:generic ratios from the ODB Formulary where computable (7
ingredients). The pCPA Tiered Pricing Framework as cited context. Per-pharmacy shelf prices from a
committed deterministic PRNG — `mulberry32(fnv1a(din + ':' + osmId))`, clamped ±12%. Every price
string is prefixed `Est.`

**Why.** No public API returns retail shelf prices at Canadian pharmacies. Health Canada's own API
guide says "For information on where these products are sold, please contact the individual company
directly." Scraping retailers would breach their terms.

The ODB Formulary is real and free but far thinner than it first appears: only 8 OTC groups have a
brand-vs-generic spread, 7 computable. Acetaminophen — the flagship category — yields zero, because
ODB omits `individualPrice` for brands flagged `notABenefit="Y"`. The pCPA tier generalization does
not hold either (clotrimazole 82%, senna 100%).

Determinism is non-negotiable: the same pharmacy must show the same price on every launch.

**Consequence.** Where no saving exists, the app says "no saving on this product" rather than
forcing a fake discount.

**Reverses if.** A real price feed becomes available. None exists today.

---

## ADR-008 — Symptom search is a closed picker, frozen at build time

**Decision.** 22 hand-curated symptoms, each row citing a Health Canada Labelling Standard or FDA
monograph. openFDA is used offline as an evidence generator. **Runtime use of RxClass `may_treat` is
banned.**

**Why.** RxClass is the obvious-looking answer and a future contributor will reach for it. Its
Headache class (19 members) omits acetaminophen and ibuprofen entirely while including belladonna
alkaloids and butalbital. Its Nasal Obstruction class has two members. Wiring it up live ships
clinically wrong results.

A closed vocabulary is simultaneously the safety control and the reason the feature is buildable.

**Consequence.** The app is a *product finder indexed by label text*, not a symptom checker. It
shows "products whose approved Canadian label lists this symptom." It never names a condition the
user did not type, never ranks by "effectiveness", and has no dose calculator. Ranking sorts within
an ingredient class and groups across classes — never a flat price sort, which would put a $3
antihistamine above a $9 decongestant for nasal congestion.

**Reverses if.** Never.

---

## ADR-009 — `react-native-maps`, not `expo-maps`

**Decision.** Use `react-native-maps`.

**Why.** The design requires markers displaying a price. `expo-maps` markers accept only image
references via `expo-image`'s `useImage` — never React children — so rendering `Est. $8.99` on a
marker would require pre-rasterising an image per price. It is also alpha, absent from Expo Go,
iOS 17+ only, and Apple-Maps-only on iOS.

**Guard.** Do not let a well-meaning refactor swap this. Marker perf: start
`tracksViewChanges={true}`, flip to `false` after first paint.

**Reverses if.** `expo-maps` gains a children API.

---

## ADR-010 — Pharmacy locations from OpenStreetMap, baked at build time

**Decision.** One Overpass query at build time → GeoJSON in the bundle. Not Google Places.

**Why.** Overpass returns 701 pharmacies inside the Toronto boundary, free, no billing account, with
real brands. Google Places charges $32.00/1,000 after 5,000 calls/month and requires a billing
account with a real card even to consume the free tier. Overpass fair use for a distributed
application is ~100 queries/day, so runtime querying would breach it and make the demo
non-deterministic.

**Obligation.** ODbL requires attribution — `© OpenStreetMap` must stay reachable on the map. With
no nav bar, the map corner is the only place for it.

**Gap.** Only ~55% of records carry housenumber+street. Tab 4 falls back to passing raw `lat,lng`
to the directions URL, which both Google and Apple accept.

---

## ADR-011 — Barcode lookup is a hand-seeded table with a first-class miss path

**Decision.** Own the `product_barcode` table. Resolution chain: local table → openFDA
(zero-padded 13-digit) → UPCitemdb trial → **OCR fallback in the same screen** → manual search.

**Why.** Health Canada removed every UPC from the DPD packaging file on 2025-05-01 — the field is
present but empty in all 58,239 rows. openFDA has 16,160 US OTC barcodes but a real Canadian Tylenol
UPC returns NOT_FOUND. UPCitemdb's free tier hit 2/6 Canadian national brands and **0/4 Life Brand
generics** — precisely the products "Alternatives" exists to surface. GS1 Canada is paid membership.

**Consequence.** The miss path is a designed flow, not an error state, and it keeps the 13.34 s
budget by switching to OCR mode in place with no screen transition.

**Gotcha.** iOS AVFoundation adds a leading zero to UPC-A and expo-camera strips it. A naive
"strip leading zeros" corrupts genuinely zero-prefixed UPCs like Life Brand's `057800` range. Try
both 12- and 13-digit forms.

---

## ADR-012 — The design system carries weight; the palette stays near-monochrome

**Decision.** Keep the design document's near-monochrome direction, but rebuild the primitives it
was expressed in: real vector icons instead of Unicode text glyphs, two border weights instead of
one hairline, palette-aware elevation, a type scale with real jumps, and warm-neutral greys instead
of pure white against pure `#E6E6E6`. One accent hue (blue) is added and is reserved for
interaction and data disclosures; green stays reserved for verification and red for the logo pin
and emergencies.

**Why.** "Common black and white themes throughout, minimal layout" was read literally in the first
build, which produced something that read as an unfinished wireframe rather than as restraint. Four
specific causes, each fixed here:

1. **Unicode glyphs as icons** — `⌕ ▣ ♡ ◷ ⚙ › ⌄ ● ○ ✓ ⓘ ◐ ☀ ☾ ▤ ◉ ⌂ ↗ ⧉ ➤`. These come from
   whatever fallback font the platform picks, so their stroke weight, optical size and baseline all
   differ from each other and from the UI text beside them. At 2x on a desktop they are visibly
   hairline. Replaced by Ionicons + MaterialCommunityIcons through one semantic `Icon` component
   (`src/components/Icon.tsx`), so every glyph in the app is one family at one weight.
2. **One border weight for everything.** `line` was used both for a divider inside a card and for
   the edge of the card itself, so on a light ground the cards dissolved into the page. There are
   now two: `line` for internal rules, `lineMid` for surface edges.
3. **No elevation at all.** Every surface sat in the same plane. `elevation(palette, level)` is
   palette-aware — shadows in light mode, a lifted surface and a brighter border in dark, where a
   black shadow on a near-black ground is not depth but nothing.
4. **A flat type scale.** 28 / 20 / 15 / 13 / 11 is five steps inside a 17pt range, so nothing was
   clearly larger than anything else. The scale now opens at 40 with negative tracking on the
   display sizes and positive tracking on the overline sizes.

**Consequence.** `theme.ts` grew from a colour list into a token system, and every component moved
from a module-level `StyleSheet.create` to a `makeStyles(palette)` factory so both palettes and the
elevation model resolve per-render.

**Not done.** No custom typeface. A webfont would diverge web from native and add a network
dependency to first paint for a marginal gain over the platform UI faces; the stack in `WebStyles`
prefers each platform's own.

---

## ADR-013 — Two layouts, not one stretched: a reading measure and a grid measure

**Decision.** `CONTENT_MAX` (720) for prose, product detail and the tab bar; `WIDE_MAX` (1080) for
results, the landing grid and the app bar. Below 700px nothing changes at all.

**Why.** The first web pass rendered the phone layout full-bleed — a product card was 1,374px wide
at 1440px, with the price stranded 1,200px from the name. The second pass centred everything at one
680px measure, which stopped the stretching but left a strip of phone floating on a grey field.
Neither is a desktop layout. A page has two jobs: prose is bounded by legibility (past ~75
characters a line is measurably harder to track back from, and no amount of screen width changes
that), and tiled content is bounded by the tiles.

**Consequence.** Screens that are neither — the camera modal, the four dialogs, the red-flag
screen — get their own bounded card rather than either measure. The map is the one deliberate
full-bleed surface.

**Rejected.** A persistent left nav on desktop. The design's no-nav-bar decision came out of the
team's own testing ("the navigation bar indeed made things more confusing"), and re-adding one on
the web only would fork the interaction model between platforms for no finding that asked for it.

---

## ADR-014 — Inside `<Link asChild>`, all styling lives on an inner View

**Decision.** A `Pressable` inside expo-router's `<Link asChild>` carries only accessibility props.
Sizing goes on the `Link`; every visual style goes on a plain `View` inside the Pressable, via the
children-as-function form.

**Why.** `Link asChild` renders through Radix's `Slot`, which merges the two style props with
`{ ...slotStyle, ...childStyle }`. That is object spread: a child style that is a **function** —
`({ pressed }) => [...]`, the normal Pressable idiom — spreads to `{}`, and an array spreads to
`{0:…, 1:…}`. Either way the child's style is silently discarded. There is no warning and no error;
the component simply renders unstyled.

**How it showed up.** The product tab bar. The selected tab was invisible on desktop — white label
on the default light ground, because the dark fill never reached the DOM — and on mobile the icon
and label had been laying out side by side, which was previously misdiagnosed as the `<a>` element
not inheriting React Native's column default. The real cause was the same one: the Pressable was
rendering with no style at all, so it never got a `flexDirection` either.

**Scope.** This is the only `asChild` usage in the app. If another is added, the same rule applies.


## ADR-015 — The landing suggests; it does not present the whole symptom vocabulary

**Decision.** The landing shows one short row of mixed starting points — a few common symptoms and
a few common brands, undifferentiated — with the full closed list of 22 symptoms behind a sheet.

**Why.** Symptom search is a source requirement (FR4) and ADR-008 fixes it to a closed, curated
vocabulary. Neither of those says the vocabulary belongs on the landing page. Laying all 22 out as
a tile grid under "What's bothering you?" put roughly 900px of chrome above the fold and made the
first screen read as a symptom checker — the one thing ADR-008 exists to say this app is not.

The Figma's own pattern is a single mixed suggestion grid — "Advil, Headache, Ibuprofen Tablet,
Unisom" — symptoms and brands side by side with no ceremony. This restores that.

**Not a reduction in scope.** Every one of the 22 is still reachable, still typed into the same
search, and still gated by the same red-flag and caution logic.


## ADR-016 — Search filters are shared session state, not screen state

**Decision.** `SearchFilters` lives in a context provider at the root. The landing and the results
screen both read and write it. It is not persisted.

**Why.** The Figma puts Filters in the persistent header chip row on *every* screen, so the control
has to work from every screen. Holding the state inside the results screen made that impossible,
and the workaround that shipped was worse than the gap: pressing Filters on the landing ran
`search(query || 'pain')`, so the control silently performed a search for the word "pain" and
navigated away from the page you were on.

Sharing the state also makes the control worth having on the landing at all — a filter set before
searching is still set when the results arrive.

**Why not persisted.** A price band silently still applied a week later produces an empty result
screen with no visible cause. Session-scoped is the honest lifetime for a transient control.

## ADR-017 — Real prices only. Where none exists, none is shown.

**Supersedes ADR-007.** ADR-007 said no public source carries Canadian retail shelf prices, so
prices would be generated from a committed seed, prefixed `Est.`, and disclosed in a modal showing
the formula. That was an honest treatment of a dishonest number, and the number had to go.

**Decision.**
1. The seeded price generator is deleted (`src/lib/pricing.ts`, `build/6-seed-prices.ts`). There is
   no field called `price` and no `base_price` anywhere in the project.
2. A product shows a price **only** where a Canadian government publishes one for its exact DIN —
   92 of 1,024. Every other product shows *no price*, plus a link to the retailer's own search.
3. Any published price ships as a `BenefitPrice` object carrying `amountPerUnit`, `unit`, `basis`
   and `source`. The basis is not optional and never sits behind a tap: a payer price rendered as
   "$1.23" beside a medicine is read as a shelf price by everyone, so the digits and the caveat
   render in one block. A build gate asserts every price contains the string "not a shelf price".
4. Pharmacy price markers and the modelled stock flag are gone. A generated dollar figure pinned to
   "Shoppers Drug Mart, 0.2 km" was a specific false claim about an identifiable business.
5. The price-band filter and "sort by cost" are gone; `publishedPriceOnly` replaces them.

**Why not scrape a retailer.** A 23-source survey (12 retail, 9 government, 2 aggregator), each
probed with live requests and adversarially re-verified, returned **zero** viable sources. Two
independent reasons stack:

- *Contractual.* Every retailer carrying a real price forbids it. Walmart Canada, verbatim: "You
  agree, further, not to use … any engine, software, tool, agent or other device or mechanism
  (including without limitation … spiders, robots …) **to scrape, navigate or search this Site**".
  Amazon.ca, Costco, Rexall, Uniprix and Voilà ("personal and non-commercial use only") say the
  same in their own words. robots.txt permitting a path does not override an express contract, and
  a 403 from a WAF is an operator refusal, not an invitation.
- *Structural, and unfixable by permission.* No free DIN→GTIN bridge exists — confirmed at both
  ends. Health Canada's API returns no `upc`/`gtin`, and its packaging table has `upc`,
  `package_size`, `package_size_unit` and `package_type` at **0% fill across all 58,239 rows**. So
  matching would be fuzzy brand-name matching across products differing only by strength, pack size
  and children's variant. A silently wrong price on a medicine is worse than no price.

**Why the government prices are still worth showing.** They are real, openly licensed, joined on an
exact DIN, and *per unit* — which is comparable between two products without knowing either pack
size, the exact comparison this app exists to make. Six equivalence groups carry a genuine
published gap (Diflucan One $15.65/capsule vs six fluconazole generics at $3.94).

**What they are not.** A per-unit public-plan reimbursement ceiling, excluding pharmacy markup,
dispensing fee and tax. Apo-Ibuprofen at $0.0309/tablet implies $1.55 for 50 caplets against $8–12
at a till — understated 5–8×. Saskatchewan's own formulary says it plainly: "exclusive of mark-ups".

**Sources used.** Ontario Drug Benefit Formulary Edition 43 (OGL-Ontario 1.0) — 62 products; Nova
Scotia Pharmacare Formulary, Socrata `wyjy-2gt4` (OGL-Nova Scotia 1.1) — 30 more, including
Claritin Allergy, which Ontario does not list. Total price-related network traffic: **two requests
per build**, both to open-data hosts with an explicit commercial-use grant.

**Rejected, so nobody re-litigates it.** RAMQ, Alberta, BC, Saskatchewan, Manitoba, NIHB, CIHI and
open.canada.ca all publish reimbursement ceilings rather than retail prices, and several (BC,
Saskatchewan, Alberta, NIHB, CIHI) carry no licence permitting redistribution at all. New
Brunswick's formulary sits inside a `Disallow:` path and must not be fetched.

**Purchase links are search links, never product links.** We cannot resolve which of a retailer's
SKUs is a given DIN, and sending someone to Advil Plus Acetaminophen when they asked about Advil is
worse than showing nothing — they would buy it. Costco, Uniprix and Familiprix are excluded
entirely: all three prohibit deep linking. Linking is a person navigating, not our fetcher
crawling; the build pipeline never touches a retail host.

## ADR-018 — Retail prices are hand-observed, because the automated match is unsound

**Context.** The owner asked for automated retail price collection, noting that academic use gives
latitude on robots.txt. That is broadly true, and it is also beside the point here — robots.txt was
never the obstacle. Walmart's robots.txt explicitly *allows* the product pages
(`Allow: /en/ip/*/*`) and lists its sitemaps. What forbids collection is the Terms of Use, which is
a contract rather than a crawling convention, and no reading of robots.txt changes it.

**But the decisive objection is not legal, it is that the match does not work.** Measured, not
argued, against Walmart's own product titles from its published sitemap:

- Requiring brand token AND ingredient AND exact strength — the strictest rule the data supports —
  yields 107 matches out of 1,024.
- **64 of those 107 (60%) attach the wrong brand's price.**
- They fail in one systematic direction: the *brand's* price lands on the *generic*.
  `Apo-Acetaminophen` → Tylenol. `Acetaminophen Tablets 325 MG` → Tylenol. `Apo-Ibuprofen` →
  Equate. One matched an adult product to `Acetaminophen Chewable Tablets 80 MG`, a children's
  formulation — the same class of error the A4 audit caught with Infants' Tylenol.

For an app whose entire thesis is "the generic costs less", inverting brand and generic prices on
60% of matches does not degrade the product, it reverses it.

**This is not fixable by tightening the rule.** The generics have no distinguishing string:
"Acetaminophen Tablets 325 MG" (Vita Health) is textually identical to every other acetaminophen
325 mg tablet on the market. The field that would disambiguate is the UPC, and Health Canada
deleted every UPC from the DPD on 2025-05-01 — verified: 0 of 58,239 packaging rows carry one.

**Decision.** Retail prices enter through `build/data/observed-prices.ts`: a committed table a
person fills in from an actual shelf, reading the DIN off the carton and the price off the tag.
That makes the join exact by construction, because a human did it. It is primary research, it is
citable, and it is the only route to a price on the flagship brands — Advil, Tylenol, Reactine,
Claritin, Benadryl, Aleve, Voltaren — for none of which any Canadian government publishes a price.

Each row carries pack size (so the per-unit figure is computable and comparable), store, city, date
and observer initials. Rows expire at 180 days rather than going stale. Build gates enforce all of
it. Observed prices outrank government ones: a price somebody paid beats a payer's ceiling.

**Correction to the retailer links shipped under ADR-017.** Well.ca was removed after its terms
were read directly: it requires *written approval before linking* and restricts its content to
"personal, non-commercial home use only". Amazon.ca's conditions render client-side and could not
be verified, so it was removed too. Walmart remains — its Terms restrict extracting content but say
nothing about inbound links — alongside a plain web search.
