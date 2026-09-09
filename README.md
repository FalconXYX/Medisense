# MediSense

An over-the-counter medicine finder for Canada. Search by brand, ingredient or symptom, see which
products Health Canada considers equivalent, what they cost, and where to buy them.

This implements the CSC318 design project by Studio 24 (Yehyun, Parth, Grace, Franklin, Tony,
Yenah) — a full user-centred design cycle that produced a Figma prototype and an 8-participant
usability study, but no code. `design/CSC318 A3.pdf` is the source document.

## Run it

```bash
npm install
npm start          # then press w for web, or scan the QR with Expo Go
```

Expo **SDK 54**, so it runs in App Store Expo Go on a physical phone with no Xcode required.

To rebuild the drug catalogue from source (takes ~2 minutes, mostly network):

```bash
npm run data:all
```

## What is real, and what is not

The app's whole claim is "this one is cheaper", so it matters which parts are true.

| | Source |
|---|---|
| Medicines, ingredients, strengths, DINs | **Real** — Health Canada Drug Product Database |
| Which products are equivalent | **Real** — Health Canada Active Ingredient Group, narrowed to route and form |
| Ingredient purpose and uses | **Real** — openFDA, single-ingredient labels only, shown as *US labelling, for reference* |
| Dose | **Not shown** — no Canadian dosing source, and another product's dose is not this one's |
| Pharmacies and their locations | **Real** — OpenStreetMap, 692 in Toronto |
| Brand-vs-generic price ratios | **Real for 3 ingredients** — Ontario Drug Benefit Formulary |
| The dollar figure at each pharmacy | **Estimated** — no public source has retail shelf prices |

Every price is rendered with an `Est.` prefix and links to a screen showing the formula and seed.
No Canadian pharmacy publishes shelf prices, and this app has no access to them.

**There is no "Pharmacist Verified" badge.** The design called for one, and it cannot ship: Ontario's
*Pharmacy Act* restricts the title, and the Health Canada data licence forbids implying
endorsement. It also failed in testing — participants could not say what it meant. The app asserts a
**source** instead of a reviewer: `Health Canada listed · DIN 01933531`, with a link to the record.
See `docs/DECISIONS.md` ADR-005.

## Layout

```
app/            expo-router screens
src/            components, data layer, pricing model, theme
build/          the data pipeline — run in CI, never on the phone
assets/         medisense.json (the bundled catalogue) + medisense.db (for inspection)
docs/           RESEARCH.md, DECISIONS.md, PROGRESS.md, screens/
design/         the original assignment PDF and Figma exports
```

## Features

- **Search** by brand, ingredient or symptom, with a closed 22-symptom vocabulary and hard stops
  for presentations that need urgent care rather than a shelf medicine
- **Equivalents** from Health Canada's own active-ingredient grouping, narrowed to the same route,
  dosage form and strength
- **Lens** — point the camera at a package and it reads what is printed on it (prototype; on-device
  OCR on web)
- **Map** of real Toronto pharmacies with estimated prices, on iOS, Android and the web
- **Dark mode**, following the system by default
- Responsive from a 375px phone to a desktop browser

## Audit

A 20-agent audit of the finished build confirmed 158 findings, 12 critical — including a product
page that rendered another product's dosing (Infants' Tylenol showed adult 500 mg gelcap
directions) and a red-flag matcher that answered "bloody diarrhea" with Imodium. All critical
findings are fixed and guarded by `npm run data:verify`. See `docs/AUDIT.md`.

## Documentation

- **`docs/DECISIONS.md`** — the eleven architecture decisions and what would reverse each
- **`docs/RESEARCH.md`** — the feasibility study behind them, with adversarial corrections
- **`docs/AUDIT.md`** — the audit, what it found, and what was done about each finding
- **`docs/PROGRESS.md`** — what is built, what the build proved, and what is left
- **`docs/screens/`** — screenshots of every screen, captured from the running app

## The one thing to know before changing the data pipeline

Equivalence is `ai_group_no` **∩ route ∩ dosage form ∩ strength ∩ non-prescription**. Health
Canada's Active Ingredient Group encodes ingredient identity and *usually* strength — 45% of
multi-product groups span more than one dosage form, and nine groups mixed strengths outright,
including a children's syrup at a quarter of the adult dose it was offered as an equivalent to.
Grouping on the group number alone offers a rectal suppository as a swap for an oral caplet and
mixes prescription products in with OTC ones. The build asserts all of it — comparing members
against each other's real fields, not against a key derived from those fields, which is how the
first version of the check managed to be tautological. See ADR-004.

---

Not medical advice. This app displays public drug records; it does not diagnose. Talk to a
pharmacist or doctor before starting, stopping or switching a medicine.

Contains information licensed under the Open Government Licence – Canada. Health Canada does not
endorse this application. Pharmacy locations © OpenStreetMap contributors (ODbL).
