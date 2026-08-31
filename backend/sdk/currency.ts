// currency.ts — pure currency conversion + metadata. The LIVE rates are fetched by currencyRates from an
// internet FX feed (Frankfurter by default) and cached; this file holds the deterministic math and the currency
// metadata (symbol, decimals) so conversion is testable and consistent. Conversion here is for DISPLAY/pricing
// help — Site Cash stays a closed-loop unit and all authoritative money handling stays server-side.

export interface CurrencyMeta { code: string; symbol: string; name: string; decimals: number; }

/** A seed of common currencies (extend freely). `decimals` drives rounding/formatting. */
export const CURRENCIES: CurrencyMeta[] = [
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", decimals: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
  { code: "CAD", symbol: "$", name: "Canadian Dollar", decimals: 2 },
  { code: "AUD", symbol: "$", name: "Australian Dollar", decimals: 2 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", decimals: 2 },
  { code: "MXN", symbol: "$", name: "Mexican Peso", decimals: 2 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", decimals: 2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", decimals: 2 },
  { code: "KRW", symbol: "₩", name: "South Korean Won", decimals: 0 },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc", decimals: 2 },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", decimals: 2 },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", decimals: 2 },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", decimals: 0 },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", decimals: 2 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2 },
];

const META: Record<string, CurrencyMeta> = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));
/** Is this a currency we support in the picker/rates? Pure. */
export function isSupportedCurrency(code: string): boolean { return !!META[String(code).toUpperCase()]; }
export function currencyMeta(code: string): CurrencyMeta { return META[String(code).toUpperCase()] ?? { code: String(code).toUpperCase(), symbol: "", name: String(code).toUpperCase(), decimals: 2 }; }

function roundTo(n: number, decimals: number): number { const f = Math.pow(10, Math.max(0, decimals)); return Math.round((Number(n) || 0) * f) / f; }

export interface RateTable { base: string; rates: Record<string, number>; }

/** Convert `amount` from → to using a rate table expressed relative to `table.base` (rates[base] === 1).
 *  Cross-rate: amount / rate[from] * rate[to]. Returns null if a needed rate is missing. Pure. */
export function convertAmount(amount: number, from: string, to: string, table: RateTable): number | null {
  const a = Number(amount) || 0;
  const F = String(from).toUpperCase(), T = String(to).toUpperCase(), B = String(table.base).toUpperCase();
  const rate = (c: string): number | null => c === B ? 1 : (typeof table.rates[c] === "number" ? table.rates[c] : null);
  const rf = rate(F), rt = rate(T);
  if (rf == null || rt == null || rf === 0) return null;
  const inBase = a / rf;
  return roundTo(inBase * rt, currencyMeta(T).decimals);
}

/** Format an amount with the currency symbol + correct decimals. Pure. */
export function formatMoney(amount: number, code: string): string {
  const m = currencyMeta(code);
  const v = roundTo(Number(amount) || 0, m.decimals).toFixed(m.decimals);
  return `${m.symbol}${v}${m.symbol ? "" : " " + m.code}`;
}

/** Is a cached rate table stale given an age in minutes? Pure. */
export function ratesStale(fetchedAtISO: string, maxAgeMinutes: number): boolean {
  const t = Date.parse(String(fetchedAtISO || "")) || 0;
  return (Date.now() - t) > Math.max(1, maxAgeMinutes) * 60_000;
}
