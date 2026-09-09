/**
 * Hand-observed retail prices.
 *
 * WHY THIS FILE EXISTS. Automated retail price collection was measured and rejected (ADR-017,
 * ADR-018). The blocker is not the law and not robots.txt — it is that the match cannot be made
 * correctly. With brand + ingredient + exact strength all required, 60% of matches against
 * Walmart's own product titles attached the WRONG brand's price, and they did it systematically in
 * one direction: the brand's price onto the generic. "Acetaminophen Tablets 325 MG" (Vita Health)
 * is textually identical to every other acetaminophen 325 mg tablet, and Health Canada deleted
 * every UPC from the DPD on 2025-05-01, so there is nothing left to disambiguate with.
 *
 * A person standing in front of the shelf has the one thing the matcher lacks: they can read the
 * DIN off the actual box and the price off the actual tag. That makes the join exact. This is
 * primary research, it is citable, and it is the only route to a real price on the flagship brands
 * — Advil, Tylenol, Reactine, Claritin, Benadryl, Aleve, Voltaren — none of which any Canadian
 * government publishes a price for.
 *
 * HOW TO ADD A ROW
 *   1. Find the product. Read the DIN off the carton — it is printed as "DIN 01933531", usually on
 *      the back near the barcode. Do not guess it from the name.
 *   2. Record the price on the shelf tag, the pack size printed on the box, the store, and the date.
 *   3. Add a row below. `observedBy` is your initials, so a reader knows a human saw this.
 *
 * RULES ENFORCED BY build/8-verify.ts
 *   - the DIN must exist in the catalogue
 *   - packSize must be a positive integer and packUnit must be stated
 *   - observedOn must be an ISO date, and rows older than 180 days are DROPPED at build time
 *     rather than shown stale
 *   - price must be > 0 and < 200
 *
 * These are real prices at one store on one day. They are not a national price and they will drift.
 * The app labels them exactly that way.
 */
export interface ObservedPrice {
  /** Read off the carton, not inferred from the name. */
  din: string
  /** What the shelf tag said, in CAD, before tax. */
  price: number
  /** The number of units in the pack, printed on the box. Makes the price comparable. */
  packSize: number
  /** "caplets", "tablets", "mL", "g" … as printed. */
  packUnit: string
  /** Where. A real store, named. */
  store: string
  /** City, so a reader can judge whether it is representative. */
  city: string
  /** ISO date the price was seen. */
  observedOn: string
  /** Initials of whoever stood there and looked. */
  observedBy: string
  /** Anything worth knowing — a sale tag, a club price, a bulk pack. */
  note?: string
}

/**
 * DELIBERATELY EMPTY.
 *
 * Nothing may be invented here. An entry with a plausible-looking price and a real store name is
 * indistinguishable from the seeded data this whole change removed, except that it would be harder
 * to detect. Add rows only from an actual observation.
 *
 * Example of the shape (commented out — it is not a real observation):
 *   { din: '01933531', price: 12.99, packSize: 72, packUnit: 'caplets',
 *     store: 'Shoppers Drug Mart', city: 'Toronto', observedOn: '2026-09-07', observedBy: 'PJ' },
 */
export const OBSERVED_PRICES: ObservedPrice[] = []
