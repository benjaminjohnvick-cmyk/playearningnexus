import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapString } from "../../sdk/settings.ts";
import { localizeItems, userCurrency } from "../../sdk/localize-price.ts";
import { type RateTable } from "../../sdk/currency.ts";

// localizePrices — the reusable hook any shop/catalog screen calls to show prices in the user's LOCAL currency.
// Give it a list of items each with a base-currency price; it returns them with display_price / display_currency /
// display_formatted using the cached live FX rates. DISPLAY ONLY — the authoritative price stays in the base unit
// and orders are charged in Site Cash. Gated behind CURRENCY_LIVE_FX_ENABLED (when off, returns items unchanged).
//
// Body: { items:[{...,price_usd}], price_field?, currency? }  → localized items + display_currency.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items as Array<Record<string, unknown>> : [];
    const priceField = String(body?.price_field || "price_usd");

    if (!snapBool("CURRENCY_LIVE_FX_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, display_currency: null, items, note: "Live FX off — prices shown in base currency." });
    }

    const base = (snapString("FX_BASE_CURRENCY", "USD") || "USD").toUpperCase();
    const target = String(body?.currency || "").toUpperCase() || userCurrency(user as Record<string, unknown>, base);
    if (target === base) {
      return Response.json({ ok: true, enabled: true, display_currency: base, items, note: "User currency is the base — no conversion needed." });
    }

    const [rateRow] = await db.filter("CurrencyRate", { base }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if (!rateRow?.rates) {
      return Response.json({ ok: true, enabled: true, display_currency: null, items, note: "No cached rates yet — run currencyRates. Prices left in base currency." });
    }

    const table: RateTable = { base, rates: rateRow.rates as Record<string, number> };
    const localized = localizeItems(items, table, target, { priceField });

    return Response.json({
      ok: true, enabled: true, display_currency: target, base, fetched_at: rateRow.fetched_at ?? null,
      items: localized,
      note: `Prices shown in ${target} are approximate live conversions (base ${base}); orders are charged in Site Cash.`,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
