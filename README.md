# MediSense

An over-the-counter medicine finder for Canada. Search by brand, ingredient or symptom, and see
which products Health Canada considers equivalent — the same active ingredient, at the same
strength, in the same form — so you can tell when the cheaper box is the same medicine.

**Live:** [parthjain.ca/Medisense](https://parthjain.ca/Medisense/) ·
[parthplato.github.io/Medisense](https://parthplato.github.io/Medisense/)

It implements a CSC318 design project by Studio 24 (Yehyun, Parth, Grace, Franklin, Tony, Yenah),
which ran a full user-centred design cycle — research, Figma prototype, 8-participant usability
study — and wrote no code.[^design]

```bash
npm install
npm start        # w for web, or scan the QR with Expo Go on a phone
```

## What's real

Nearly all of it. The catalogue is Health Canada's, and so is the equivalence:

- **1,024** marketed non-prescription products, with their real DINs, ingredients and strengths
- **476** equivalence groups, from Health Canada's own Active Ingredient Group numbers
- **692** Toronto pharmacies, from OpenStreetMap
- **22** symptoms, each hand-checked against a labelling standard

## What's not

**Prices, mostly.** 92 of 1,024 products carry a real price, published by Ontario or Nova Scotia.
Those are per-unit amounts a public drug plan reimburses a pharmacy — not shelf prices — and the
app says so next to every one. The other 932 show no price at all, because no Canadian retailer
publishes prices in a form anyone may reuse, and Health Canada deleted every barcode in 2025, so
there is no reliable way to match a medicine to a product on a shelf.[^prices]

**Dose is never shown.** There is no Canadian dosing source, and another product's dose is not this
one's.[^dose]

**There is no "Pharmacist Verified" badge**, though the design called for one. Ontario's *Pharmacy
Act* restricts the title and the Health Canada licence forbids implying endorsement — and it failed
in testing anyway, since participants could not say what it meant. The app names a **source**
instead of a reviewer: `Health Canada listed · DIN 01933531`, linked to the record.[^badge]

---

[^design]: `design/CSC318 A3.pdf` is the source document. The build applies every fix the study
recommended; `docs/PROGRESS.md` tracks what is done and what is left.

[^prices]: 23 possible price sources were checked and none is both lawful and correctly matchable —
`docs/DECISIONS.md` ADR-017 has the survey, ADR-018 the measurement that settled it (60% of the
strictest automated matches attached the wrong brand's price). Real retail prices can be added by
hand in `build/data/observed-prices.ts`.

[^dose]: An earlier build showed Infants' Tylenol with adult 500 mg gelcap directions. That, and
157 other findings from a 20-agent audit, are in `docs/AUDIT.md`. The 12 critical ones are fixed and
held by 22 build-time checks (`npm run data:verify`).

[^badge]: ADR-005. All 18 decisions, and what would reverse each, are in `docs/DECISIONS.md`;
`docs/RESEARCH.md` has the feasibility work behind them.

**Before touching the data pipeline:** equivalence is `ai_group_no` ∩ route ∩ form ∩ strength ∩
non-prescription. The group number alone offers a rectal suppository as a swap for an oral caplet —
45% of multi-product groups span more than one dosage form. ADR-004.

```
app/       screens (expo-router)      build/     the data pipeline, run in CI
src/       components, data, theme    docs/      decisions, research, audit, screenshots
```

---

Not medical advice. This displays public drug records; it does not diagnose. Talk to a pharmacist
before starting, stopping or switching a medicine.

Contains information licensed under the Open Government Licence – Canada, – Ontario and – Nova
Scotia. Health Canada does not endorse this application. Pharmacy locations © OpenStreetMap
contributors (ODbL).
