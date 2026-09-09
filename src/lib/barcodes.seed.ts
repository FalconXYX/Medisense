/**
 * Hand-entered barcodes.
 *
 * ADR-011 — this table is manual data entry, and that is the honest scope of the barcode feature.
 * No free or paid API maps a Canadian OTC barcode to a drug product, so coverage is exactly what
 * someone has typed in here.
 *
 * TO ADD ONE: read the UPC off a real package, or take it from a Shoppers Drug Mart product URL —
 * they embed it as `variantCode`, e.g.
 *   https://www.shoppersdrugmart.ca/p/BB_062600142290?variantCode=062600142290
 * (Direct fetches of those pages return 200; they are not blocked.)
 * Then map it to a `drug_code` from the catalogue:
 *   sqlite3 assets/medisense.db "SELECT drug_code, din, brand_name FROM product WHERE brand_name LIKE '%ADVIL%'"
 *
 * Known prefixes: 062600 = Kenvue/McNeil Canada, 057800 = Loblaw/Shoppers Life Brand.
 */
export const SEEDED_BARCODES: Record<string, number> = {
  // Populated as packages are scanned in. Deliberately empty rather than fabricated —
  // a wrong barcode mapping on a medicine app is a safety problem, not a data-quality one.
}
