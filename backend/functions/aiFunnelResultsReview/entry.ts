import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { reviewOnResults, findProduct, type FunnelSignals } from "../../sdk/ai-funnel.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";
import { earnHistory } from "../../sdk/goods-advance.ts";
import { tier1FinancedLive } from "../../sdk/tier1-financed.ts";
import { advanceProgramLive } from "../../sdk/goods-advance.ts";

// aiFunnelResultsReview (Gate 2 — results) — after the commitment window, recommend up / down / hold from
// the customer's REAL results on the product's metric (attributed sales / earnings / engagement value).
// Truthful individualized numbers only. Suitability guard still applies to any financial upsell.
//   Body: { signals?: {...} }   (reads the caller's active FunnelJourney for product + window)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    if (!(await isEnabled("ai_funnel", jurisdiction))) {
      return Response.json({ error: "The concierge is not available.", code: "funnel_off" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const signals = (body.signals ?? {}) as FunnelSignals;

    const rows = await db.filter("FunnelJourney", { user_id: user.id, kind: "active" }, "-created_date", 1).catch(() => []);
    const journey = rows && rows[0] ? rows[0] as Record<string, unknown> : null;
    if (!journey) return Response.json({ error: "No active funnel journey to review." }, { status: 400 });

    const currentKey = String(journey.current_key);
    const product = findProduct(currentKey);
    if (!product) return Response.json({ error: "Product no longer in catalog." }, { status: 400 });

    const windowStart = String(journey.window_start || journey.committed_at || new Date().toISOString());
    const windowDays = Number(journey.window_days) || product.window_days;
    const startMs = Date.parse(windowStart);
    const windowMet = Number.isFinite(startMs) && (Date.now() - startMs) >= windowDays * 86400000;
    const upsellAttempts = Number(journey.upsell_attempts) || 0;

    // Pull the REAL result on this product's metric (individualized — never a projection).
    let resultsUsd = 0;
    if (product.metric === "attributed_sales") {
      resultsUsd = await attributedSalesUsd(db, String(user.id), windowStart).catch(() => 0);
    } else {
      // earnings / engagement → the member's own generated value over the window (best-effort).
      const hist = await earnHistory(String(user.id), Math.max(1, windowDays)).catch(() => ({ totalUsd: 0 } as { totalUsd: number }));
      resultsUsd = Number((hist as { totalUsd?: number }).totalUsd) || 0;
    }

    const liveKeys = new Set<string>();
    if (await tier1FinancedLive(jurisdiction)) liveKeys.add("tier1_financed");
    if (await advanceProgramLive(jurisdiction)) liveKeys.add("goods_advance");
    const isLive = (key: string) => liveKeys.has(key);

    const rec = reviewOnResults({ currentKey, resultsUsd, windowMet, upsellAttempts, signals }, isLive);

    try {
      await db.create("FunnelJourney", {
        user_id: user.id, kind: "review_log", gate: "results", current_key: currentKey,
        recommend_key: rec.recommend_key, direction: rec.direction, results_usd: resultsUsd,
        window_met: windowMet, reason: rec.reason, blocked_reason: rec.blocked_reason ?? null, at: new Date().toISOString(),
      }, user.id);
    } catch { /* best-effort */ }

    return Response.json({ recommendation: rec, results_usd: resultsUsd, window_met: windowMet, window_days: windowDays });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
