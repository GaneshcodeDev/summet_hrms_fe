/**
 * Shared currency formatting (Phase 17 hardening — section 22).
 *
 * Sites carry an optional `currency` string like "INR (₹)" or "USD ($)"
 * (see Site.currency, set via the site onboarding wizard / site-form.tsx).
 * Every amount in the app is still stored as a plain number with no
 * currency tag of its own — this helper is what turns "site.currency" into
 * a symbol at display time, replacing hardcoded "₹" literals. No FX
 * conversion: an amount is always shown in the site it belongs to, never
 * converted to another currency.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SGD: "$",
};

/** Extracts the ISO-ish code from a Site.currency value like "INR (₹)" — falls back to INR when unset, matching every existing hardcoded "₹" call site this replaces. */
function currencyCode(siteCurrency?: string): string {
  if (!siteCurrency) return "INR";
  const match = siteCurrency.match(/^[A-Z]{3}/);
  return match ? match[0] : "INR";
}

export function currencySymbol(siteCurrency?: string): string {
  return CURRENCY_SYMBOLS[currencyCode(siteCurrency)] ?? "₹";
}

/** e.g. formatCurrency(45000, site.currency) -> "₹45,000". Locale-aware grouping via toLocaleString, matching the existing `n.toLocaleString("en-IN")` convention. */
export function formatCurrency(amount: number, siteCurrency?: string, locale = "en-IN"): string {
  return `${currencySymbol(siteCurrency)}${amount.toLocaleString(locale)}`;
}
