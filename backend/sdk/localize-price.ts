// localize-price.ts — pure helpers to show shop prices in each user's LOCAL currency for DISPLAY, using the
// cached live FX rates (currency.ts / currencyRates). The authoritative price stays in the base unit and Site
// Cash is the closed-loop unit that's actually charged — the localized figure is an approximate display
// convenience, always shown alongside a "charged in <base>" note by the caller.

import { convertAmount, formatMoney, currencyMeta, type RateTable } from "./currency.ts";

// Minimal region → currency map to infer a user's currency from their locale/country when they haven't set one.
const REGION_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", UK: "GBP", EU: "EUR", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", IE: "EUR", NL: "EUR",
  JP: "JPY", CN: "CNY", IN: "INR", CA: "CAD", AU: "AUD", BR: "BRL", MX: "MXN", NG: "NGN", ZA: "ZAR", KR: "KRW",
  CH: "CHF", SE: "SEK", PH: "PHP", ID: "IDR", TR: "TRY", AE: "AED",
};

/** Resolve a user's display currency: explicit user.currency → region from country/locale → default. Pure. */
export function userCurrency(user: Record<string, unknown> | null | undefined, defaultCur = "USD"): string {
  const explicit = String(user?.currency ?? "").toUpperCase();
  if (explicit && explicit.length === 3) return explicit;
  const country = String(user?.country ?? "").toUpperCase();
  if (REGION_CURRENCY[country]) return REGION_CURRENCY[country];
  const locale = String(user?.locale ?? "");
  const region = (locale.split(/[-_]/)[1] || "").toUpperCase();
  if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  return String(defaultCur || "USD").toUpperCase();
}

export interface LocalizeOpts { priceField?: string; from?: string; }

/** Add display_price / display_currency / display_formatted to each item, converting its `priceField` (in `from`,
 *  default the table base) into `target`. Leaves display null when a rate is missing. Returns copies. Pure. */
export function localizeItems<T extends Record<string, unknown>>(items: T[], table: RateTable, target: string, opts: LocalizeOpts = {}): Array<T & { display_currency: string; display_price: number | null; display_formatted: string | null }> {
  const field = opts.priceField || "price_usd";
  const from = (opts.from || table.base || "USD").toUpperCase();
  const to = String(target || table.base).toUpperCase();
  return (items || []).map((it) => {
    const raw = Number(it?.[field]);
    let display_price: number | null = null, display_formatted: string | null = null;
    if (Number.isFinite(raw)) {
      const conv = to === from ? Math.round(raw * Math.pow(10, currencyMeta(to).decimals)) / Math.pow(10, currencyMeta(to).decimals) : convertAmount(raw, from, to, table);
      if (conv != null) { display_price = conv; display_formatted = formatMoney(conv, to); }
    }
    return { ...it, display_currency: to, display_price, display_formatted };
  });
}
