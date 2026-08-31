import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapString } from "../../sdk/settings.ts";
import { convertAmount, formatMoney, currencyMeta, CURRENCIES, type RateTable } from "../../sdk/currency.ts";

// convertCurrency — convert an amount between currencies using the latest LIVE rates (cached by currencyRates,
// checked against the internet feed). For display/pricing help; Site Cash stays a closed-loop unit and
// authoritative money handling stays server-side. Gated behind CURRENCY_LIVE_FX_ENABLED.
//
// Body: { amount, from, to }  → { amount, converted, formatted, rate_base, fetched_at }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("CURRENCY_LIVE_FX_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, currencies: CURRENCIES, note: "Live FX is off (CURRENCY_LIVE_FX_ENABLED)." });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount) || 0;
    const from = String(body?.from || snapString("FX_BASE_CURRENCY", "USD")).toUpperCase();
    const to = String(body?.to || "").toUpperCase();
    if (!to) return Response.json({ error: "`to` currency required" }, { status: 400 });

    const base = (snapString("FX_BASE_CURRENCY", "USD") || "USD").toUpperCase();
    const [cached] = await db.filter("CurrencyRate", { base }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if (!cached?.rates) return Response.json({ ok: false, error: "No cached rates yet — run currencyRates first." }, { status: 409 });

    const table: RateTable = { base, rates: cached.rates as Record<string, number> };
    const converted = convertAmount(amount, from, to, table);
    if (converted == null) return Response.json({ ok: false, error: `No rate for ${from}→${to}.` }, { status: 422 });

    return Response.json({
      ok: true, enabled: true,
      amount, from, to, converted,
      formatted: formatMoney(converted, to),
      to_meta: currencyMeta(to),
      rate_base: base, fetched_at: cached.fetched_at ?? null,
      note: `Converted using live rates (base ${base}, fetched ${cached.fetched_at ?? "n/a"}).`,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
