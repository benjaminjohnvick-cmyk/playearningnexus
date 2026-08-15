import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { recommendAtPurchase, type FunnelSignals } from "../../sdk/ai-funnel.ts";
import { tier1FinancedLive } from "../../sdk/tier1-financed.ts";

// aiFunnelRecommend (Gate 1 — fit) — a recommendation from the conversation signals, BEFORE purchase.
// Deterministic + logged. The suitability guard means a financial product is never recommended as an upsell
// unless it is live AND ability-to-repay is confirmed.
//   Body: { signals: {goal,capacity,hesitation,ability_to_repay}, current_key?: string }
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
    const currentKey = body.current_key ? String(body.current_key) : null;

    // Which financial products are actually live right now (all default OFF).
    const liveKeys = new Set<string>();
    if (await tier1FinancedLive(jurisdiction)) liveKeys.add("tier1_financed");
    const isLive = (key: string) => liveKeys.has(key);

    const rec = recommendAtPurchase(signals, currentKey, isLive);

    // Log the decision (owner-scoped) for the AI-oversight feed.
    try {
      await db.create("FunnelJourney", {
        user_id: user.id, gate: "fit", current_key: rec.current_key, recommend_key: rec.recommend_key,
        direction: rec.direction, reason: rec.reason, blocked_reason: rec.blocked_reason ?? null,
        signals, at: new Date().toISOString(),
      }, user.id);
    } catch { /* logging is best-effort */ }

    return Response.json({ recommendation: rec });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
