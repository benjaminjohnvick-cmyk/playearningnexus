import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapString, snapNumber } from "../../sdk/settings.ts";
import { ratesStale, type RateTable } from "../../sdk/currency.ts";

// currencyRates — fetches LIVE exchange rates from an internet FX feed (Frankfurter by default: no key needed)
// and caches them (CurrencyRate). This is what keeps currency conversion checked against a live feed. Refreshes
// only when the cache is stale (FX_CACHE_MINUTES) unless force=true. Gated behind CURRENCY_LIVE_FX_ENABLED.
// Scheduled hourly; also callable on demand.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("CURRENCY_LIVE_FX_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, note: "Live FX is off (CURRENCY_LIVE_FX_ENABLED)." });
    }

    const body = await req.json().catch(() => ({}));
    const base = (snapString("FX_BASE_CURRENCY", "USD") || "USD").toUpperCase();
    const maxAge = Math.max(1, snapNumber("FX_CACHE_MINUTES", 60));
    const providerBase = snapString("FX_PROVIDER_URL", "https://api.frankfurter.dev/v1/latest");

    // Serve the cache if fresh.
    const [cached] = await db.filter("CurrencyRate", { base }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if (cached && body.force !== true && !ratesStale(String(cached.fetched_at || ""), maxAge)) {
      return Response.json({ ok: true, enabled: true, base, rates: cached.rates, fetched_at: cached.fetched_at, cached: true });
    }

    // Fetch live rates. Frankfurter: GET <base_url>?base=USD → { base, rates: { EUR: .., ... } }.
    const url = `${providerBase}${providerBase.includes("?") ? "&" : "?"}base=${encodeURIComponent(base)}`;
    let rates: Record<string, number> = {};
    let ok = false;
    try {
      const res = await fetch(url, { headers: { "accept": "application/json" } });
      if (res.ok) {
        const j = await res.json() as { rates?: Record<string, number>; base?: string };
        if (j?.rates && typeof j.rates === "object") { rates = j.rates; ok = true; }
      }
    } catch { ok = false; }

    if (!ok) {
      // Fall back to the last cached table if the feed is unreachable.
      if (cached?.rates) return Response.json({ ok: true, enabled: true, base, rates: cached.rates, fetched_at: cached.fetched_at, cached: true, note: "Live feed unreachable — served last cached rates." });
      return Response.json({ ok: false, error: "FX feed unreachable and no cache available." }, { status: 503 });
    }

    const table: RateTable = { base, rates };
    const fetchedAt = new Date().toISOString();
    await db.create("CurrencyRate", { base, rates, provider: providerBase, fetched_at: fetchedAt, created_at: fetchedAt }).catch(() => null);

    return Response.json({ ok: true, enabled: true, base, rates: table.rates, fetched_at: fetchedAt, cached: false, note: `Live rates refreshed from the feed (base ${base}).` });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
