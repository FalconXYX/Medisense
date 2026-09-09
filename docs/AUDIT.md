# Audit — findings and what was done

A 20-agent audit ran over the finished build: ten independent auditors (data safety, pipeline
correctness, application logic, honesty of claims, accessibility, runtime behaviour, licensing,
design fidelity, performance, robustness), each followed by an adversarial verifier told to
reproduce every finding and kill the ones that did not hold up. 3,296,440 tokens, 1,241 tool calls.

**158 findings confirmed, 10 rejected by the verifiers** — 12 critical, 39 high, 61 medium, 46 low.

The critical cluster was worse than a normal bug list. Several findings were not "the app is
wrong", they were "the app tells a parent the wrong dose for their child". Those are fixed and are
now guarded by build-time assertions.

## The twelve critical findings, and the fix for each

### 1-4. The product page showed another product's Drug Facts

`getDrugFacts()` keyed openFDA label text by ingredient, then the page rendered the first match as
*this* product's own directions, strength and warnings.

- **Infants' Tylenol** (acetaminophen 80 mg drops) displayed "in each gelcap, Acetaminophen 500 mg"
  and "adults and children 12 years and over take 2 gelcaps every 6 hours".
- **Children's Advil** (100 mg suspension) displayed "in each white tablet, Ibuprofen 200 mg".
- **Reactine Fast Melt Junior** displayed a 2.5 mg chewable's dosing.
- 488 products showed a strength that appears nowhere in their own formula; 49 of them paediatric.
- A three-ingredient cold tablet showed only the acetaminophen liver warning — none of the
  drowsiness, blood-pressure or MAOI warnings its other two ingredients carry.

**Fixed.** Dose and strength from a foreign label are no longer stored at all — `active_ingredient`
and `dosage_and_administration` were removed from the pipeline, so they cannot leak back. The Use
panel now says *"Read the dose on the package — MediSense does not hold Canadian dosing information
for this product, and will not show you another product's."* Warnings render only when this product
has one active ingredient **and** the US label had the same single ingredient; otherwise the panel
explains why it is showing none. The provenance line now appears on every panel the label feeds,
not just the first.

### 5, 9. Products listed ingredients they do not contain, including a known allergen

The openFDA query used `limit=1` against a phrase match, so a single-moiety query returned a
*combination* product's label. Asking for "dextromethorphan" returned a label whose ingredients are
acetaminophen + dextromethorphan + phenylephrine — so every plain DM cough syrup carried an
acetaminophen liver warning. Asking for "pramoxine" returned a triple-antibiotic ointment, so
**Anusol Plus** (a haemorrhoid product) listed **neomycin**, a leading contact allergen it does not
contain — three lines above the app's own advice to check the carton if you have an allergy.

**Fixed.** The pipeline now scans 50 results and keeps only labels whose `openfda.substance_name`
is exactly the one ingredient. 81 of 91 ingredients matched a clean single-ingredient label; the
other 10 exist only in combinations, and their warnings are withheld rather than guessed.

### 6, 8, 31, 32. Products displayed the wrong strength

Two separate causes. Every product inherited its equivalence **group's** ingredient label rather
than its own — Koffex DM (15 mg) displayed 30MG, and two Benylin products displayed exactly double
all five of their ingredients. Separately, 120 liquids showed a bare milligram figure with the
per-volume denominator stripped, so a 15 mg/5 mL syrup read as "15MG" beside a 15 mg tablet.

**Fixed.** Products render their own de-duplicated ingredient list, carrying the denominator
(`ACETAMINOPHEN 160MG / 5ML`). Labels are sorted and trailing zeros trimmed so the same formulation
always reads the same way. A build gate asserts both.

### 7. The red-flag matcher missed the phrasings people actually type

It was literal substring containment over 34 fixed phrases. It failed in both directions:

- **"coughing up blood"** did not match the stored "coughing blood", so it fell through to the
  cough symptom and was answered with dextromethorphan.
- **"bloody diarrhea"** was answered with **Imodium** — loperamide is contraindicated in bloody
  diarrhoea.
- "crushing pain in my chest", "can't breathe", "blood in my stool" all fell through silently.
- Meanwhile **"heat stroke"** and **"food poisoning"** were hard-blocked with a Call 911 screen.

**Fixed.** Rewritten as anchored regular expressions that allow filler words between the parts, with
negative context so "heat stroke" and "food poisoning" no longer fire. A build gate now asserts 13
dangerous phrasings block and 5 innocent ones do not.

### 2. The under-6 hard block fired on the wrong queries

`mentionsYoungChild` was a fixed word list with no notion of an age. It **failed open** for every
numeric phrasing — "cough medicine for my 2 year old", "for my 6 month old", even "cough under 6" —
and **failed closed** for "cough for my son", blocking a child of any age.

**Fixed.** Age is parsed: 0-5 years in any notation, any age in months, "under 6", plus nouns that
imply an infant. "for my son" and "for my 12 year old" correctly pass.

### 1. "heart burn" answered a reflux query with first-aid antibiotics

`matchSymptom` returned the first symptom in array order whose label or synonym appeared as a whole
word. The 4-letter synonym "burn" under *Minor cuts* matched "heart burn" (with a space), and
minor-cuts sits earlier in the array than heartburn — so a reflux query rendered 21 topical
antibiotics and 7 local anaesthetics, with no antacid on screen.

**Fixed.** Candidates are ranked by matched-term length, exact matches win, and comparison also runs
with spaces removed so "heart burn" reaches heartburn. Sleep phrasings ("cant sleep", "trouble
sleeping") now resolve too.

### 11, 29, 34. Symptom results ignored their own class check

Step 9 computed which products agreed with each class's declared ATC code, logged a warning, and
then added **every product containing the ingredient anywhere in its formula**. So *Sore throat* led
with seven Crest mouthwashes, *Muscle pain → topical counterirritant* was 16 oral cough syrups,
*Itchy skin → anti-itch* led with a rectal suppository, and *Hemorrhoids* offered oral Tylenol Sinus
and Visine eye drops.

**Fixed.** The ATC gate is enforced, not reported. Blocked nose went from 153 products to 23,
hemorrhoids from 53 to 7. Where the gate dropped everything, the declared class was wrong rather
than the data — those were corrected (pramoxine is D07, not D04) or deliberately left dropped
(oral phenylephrine only exists here inside combination analgesics).

### 10. The equivalence key did not encode strength

ADR-004 assumed Health Canada's Active Ingredient Group number encoded strength. It does not,
reliably. Nine groups mixed strengths — including **Jack & Jill Bedtime children's syrup (DXM
7.5 mg) offered as an equivalent to Robitussin Honey Nighttime (DXM 30 mg)**, a quarter of the dose.

Worse, the assertion meant to catch this was **tautological**: it compared a product's route and
form against a key *derived from* that route and form, so it could never fail.

**Fixed.** Strength (normalised, with the per-volume denominator) is part of the key. The assertions
now compare members against each other's actual fields — same ingredients, same strengths, same
ingredient *count* — and would have caught this.

### 12. A third of the catalogue could not be found by name

Because a symptom match short-circuited the product lookup entirely, **293 of 838 product names,
typed exactly as printed on the box, rendered a symptom page instead of the product** — "Claritin
Allergy", "Benylin Cough", "Advil Cold and Sinus". For 34 of them the product was not even present
on the page they landed on.

**Fixed.** The product lookup always runs. A symptom page wins only when the query *is* a symptom,
or when it merely mentions one and nothing in the catalogue matches what was typed.

## High findings also fixed

| Finding | Fix |
|---|---|
| Red-flag screen silent to screen readers; focus never moved | Assertive live region + focus move (guarded for web, where `findNodeHandle` throws) |
| `ProductCard` label collapsed the card, deleting form, route and DIN | Container label removed; children read in order |
| `inkTertiary` #9A9A9A was **2.81:1** on white across 32 content uses | #737373 → 4.74:1; verified green → 5.67:1 on its tint |
| `AbortSignal.timeout` does not exist on Hermes — both remote barcode steps were dead code | `AbortController` + timer |
| "Nothing is recorded or uploaded" — the barcode *is* sent to two APIs | Copy corrected: no image leaves the device, the numbers are looked up |
| "N lower-cost alternatives" false on 138 of 231 searches | Counts only members that are actually cheaper; says "N of M cost less" or "none cheaper" |
| ODB formulary citations keyed on ingredient alone, stamped across 42 unrelated groups; 89 fabricated "no saving" claims | Single-ingredient groups, matching dosage form, real saving only → **112 misapplied citations down to 4 genuine ones** |
| "View the Health Canada record" landed on an **empty search form** | Uses the record URL that actually resolves (verified against the live site) |
| Ranitidine still shipped, five years after Health Canada's stop-sale | Withdrawn-ingredient blocklist |
| `TEVA CANADA LIMITED` was in INNOVATORS *and* `TEVA` in GENERIC_HOUSES — 12 Teva generics labelled name-brand | Removed from INNOVATORS |
| ATC allowlist dropped 741 products including **Aspirin 81 mg, Canesten, Robaxacet, Diflucan One** and every anti-itch cream | Widened: G01, J02, M03, D04, D08, B01AC. Catalogue 838 → **1,024** |
| "Closest to you" and the km figure shown as user-relative with no location | Says "closest to downtown Toronto" when location is unknown |
| Stocking presented as fact | Stores tab states plainly that stock and price are estimated |
| "Show all" mounted 264 cards into a plain ScrollView (~2.3 s blocked) | Paged 12 at a time; worst-case initial mount is now **17 cards** |
| Every navigation control dead after a cold load (`POP_TO_TOP` unhandled) — including the red-flag screen's only exit | `goHome()` helper with a `replace('/')` fallback |
| Under-6 block's only CTA led to "Nothing found for 'pharmacy'" | Opens maps to pharmacies nearby |
| "Products whose approved label lists this" — it is a curated ingredient list | Copy now describes what it actually is |

## Build gate

`npm run data:verify` — 17 checks, exits non-zero on any failure. Every one of these encodes a
defect that shipped once:

```
▸ ADR-004 — equivalence is ingredient ∩ route ∩ form ∩ strength ∩ non-prescription
▸ ADR-007 — every price is either cited or flagged as an estimate
▸ Golden searches (advil, tylenol, claritin, benadryl, ibuprofen)
▸ Audit regressions
  ✓ every product shows its own ingredient label, not its group's
  ✓ every group displays one consistent ingredient label
  ✓ no withdrawn ingredient ships
  ✓ no ODB citation claims a non-saving
  ✓ red-flag matcher catches 13 dangerous phrasings and no innocent ones
▸ Runtime dataset matches the database
```

## Second pass — the visual rebuild

Prompted by the plainest possible review: *"everything still looks awful on web and the dark version
looks like shit and tbh so does the normal one — part of it is the outline path is too thin but also
in general it's overly simple."* That was correct, and it was correct about the cause. See ADR-012
through ADR-014 for the decisions; the defects found while making the changes:

| Defect | Fix |
|---|---|
| **`<Link asChild>` silently deletes the child's style.** Radix's Slot merges styles with `{...slot, ...child}`; a Pressable style FUNCTION spreads to `{}`. The selected product tab rendered white-on-white, and the icon/label stacking bug previously blamed on the `<a>` element had the same root cause — the Pressable had no style at all | All visuals moved to an inner View (ADR-014) |
| **`alignSelf: 'stretch'` + `maxWidth` pins to the start edge.** On the red-flag screen the **Call 911** button rendered hard against the left of a 1440px window, 500px from the text it belongs to | `alignSelf: 'center'` + `width: '100%'` |
| A `<Modal>` panel with `flex: 0` gives its ScrollView zero height — the desktop dialog rendered as a scrim with no card in it | `flexGrow: 0 / flexShrink: 1 / flexBasis: auto` |
| The dialog scrim wrapped the card, producing a `<button>` inside a `<button>` — invalid HTML, and the inner control unreachable for some assistive tech | Dismiss target is a sibling behind the card |
| `fontFamily: 'Courier'` in the price formula resolves on Apple platforms and nowhere else | Full monospace stack, per platform |
| Every icon in the app was a Unicode text glyph from an arbitrary fallback font | One `Icon` component, one family, one weight — and every glyph now `aria-hidden` (verified: 24/24 on the results page) |
| Two controls both labelled "MediSense home" — the wordmark and the field's magnifier | The magnifier is decorative wherever the wordmark is visible |
| Blanket `filter: brightness()` hover dimmed the entire subtree, icons included, and did nothing to an already-white element | Background/border transition on the container |
| The price disclosure used the same amber as the safety panels, so a symptom page stacked two yellow warning blocks and the one about the reader's health lost its urgency | Amber is now reserved for health cautions; data disclosures are blue |
| No `tileerror` handling — going offline showed a grey rectangle with "18 pharmacies near here" written confidently under it | Explicit offline card that points at the Stores tab, which still works. Verified by blocking the tile host |
| The web map stayed a sheet of white paper inside a near-black app — OSM publishes no dark raster style, and Leaflet's own zoom and attribution chrome is hard-coded white | Greyscale tiles are additionally inverted in dark mode (safe on a desaturated image — no hues to send to their opposites), and Leaflet's controls follow the palette. The ODbL attribution is themed, never hidden |
| Prose ran the full width of the results column. The column is 1,080px because it holds tiled cards; the safety copy inside it was running ~145 characters a line, about double the point where a reader starts losing the return sweep | Every prose block capped at a 640–720px measure independently of its container |
| The symptom class count sat at the far right of a 1,080px row, a thousand pixels from the heading it belonged to, reading as an unrelated number in the margin | A rule runs between the name and its count |
| At 390pt the placeholder rendered as "Symptoms, ingredients, brand.." — clipped mid-word by the Scan button, which reads as a rendering fault rather than a hint | Full triplet on desktop, "Search medicines" on a phone |
| Pharmacy street addresses clipped to "· 2…" on every card in the two-column Stores grid — the one thing that tab exists to give | Two lines |
| The landing led with a 22-tile **"What's bothering you?"** grid — about 900px of chrome before the fold, and it made the first screen read as a symptom checker, which is precisely what ADR-008 says this app is not | One short mixed suggestion row, the Figma's own pattern ("Advil, Headache, Ibuprofen Tablet, Unisom"). The closed 22-symptom list is intact and one click away, in a sheet |
| The footer's fixed 74px label column wrapped "PHARMACIES" to "PHARMACIE / S", and all four values were underlined, so the page ended in four ragged rules | Four blocks in a wrapping row — label, source, licence — with the underline replaced by a small external-link arrow, and the whole block collapsed behind "Data sources and licences". The disclaimer and the OGL non-endorsement line stay visible; the ODbL notice is still shown persistently on the map itself, beside the data it belongs to |
| **"What is a generic?" answered the question in ~400 words** across four grey slabs, with the actual answer in the second paragraph of the first one. The person opening that panel has already said they do not know the word | Answer in one sentence, the same fact as a diagram, three short lines, and the 80–125% detail last and small. Same information, about half the words. ADR-006's accuracy constraints unchanged |
| **The Filters chip on the landing navigated to a search for the word "pain".** Filters were local state inside the results screen, so the chip on the landing had no panel to open; what it did instead was `search(query \|\| 'pain')`, dropping the user on an ibuprofen results page they never asked for | Filters live in a session-scoped context shared by both screens (ADR-016). The chip opens the panel from anywhere, and a filter set before searching is still set after |
| Filters applied to the Alternatives section only. Setting "Under $10" emptied Alternatives and then listed an $11.18 and a $12.60 product directly beneath it — the filter visibly working in one half of the page and not the other | `applyFilters` also runs over Other matches, and runs *before* the 20-item cap rather than after it |
| With a filter active, the branded card could sit at the top at $22.99 under a "Under $10" filter with no explanation | It is still shown — it is what you searched for, and removing it leaves the alternatives with nothing to be alternatives to — but the card now says so in a line underneath |

## Not yet addressed

Honest list. None are in the critical set.

- **Web barcode scanning cannot resolve a code.** expo-camera's web scanner gates on the literal
  string `'qr'`, so EAN-13/UPC-A never fire on the web build and the miss path is unreachable there.
  Native is unaffected. Needs a different web scanner (ZXing directly).
- **`searchProducts` requires every token to hit**, which empties some ordinary multi-word queries;
  the empty state then blames the catalogue rather than the query.
- **Roughly 100 medium and low findings** remain, mostly copy precision and error-handling gaps.
- The study's four timed tasks have not been re-run against the fixed build.
