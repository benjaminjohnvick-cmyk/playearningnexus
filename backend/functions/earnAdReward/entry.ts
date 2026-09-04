import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordRevenue, recordSubsidy } from "../../sdk/revenue.ts";
import { earnHookEnabled, grantablePointsForOneAd, pointsToUsd } from "../../sdk/earn-hook.ts";

// earnAdReward (authenticated) — credit closed-loop Site Points for ONE COMPLETED, USER-INITIATED in-app
// rewarded ad. This is called by the app AFTER the ad SDK reports a genuine completed rewarded view (the ad is
// never auto-played — the user chose to watch it). The grant is bounded by the daily + lifetime cost caps
// (returns 0 and a friendly note when a cap is hit). Points are non-cashable. If the ad network reports the
// impression's real value, pass it as ad_revenue_usd and it's booked as `advertising` revenue; the user's
// points are always booked as a subsidy (a cost). A per-view token/ad_unit is logged for the caps + audit.
//   { ad_unit?, network?, ad_revenue_usd? } → { ok, credited_points, credited_usd, capped } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!earnHookEnabled()) return Response.json({ error: "This feature isn't available right now." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const uid = String(user.id);

    const grantPts = await grantablePointsForOneAd(uid);
    if (grantPts <= 0) {
      return Response.json({ ok: true, credited_points: 0, credited_usd: 0, capped: true, note: "You've reached today's earning limit — come back tomorrow." });
    }

    // Credit the non-cashable Site Points.
    const newBal = await adjustUserBalance(uid, grantPts, { field: "points" }).catch(() => null);
    if (newBal === null) return Response.json({ error: "Couldn't credit the reward. Please try again." }, { status: 500 });

    // Log the view for the caps + audit (points, day, source).
    await db.create("EarnAdView", {
      user_id: uid, points: grantPts, day: new Date().toISOString().slice(0, 10),
      ad_unit: String(body.ad_unit || ""), network: String(body.network || ""),
      source: "earn_hook", promotional: true, at: new Date().toISOString(),
    }).catch(() => null);

    // The user's reward is a platform-funded subsidy (a cost). If the network reported real ad revenue, book it.
    await recordSubsidy({ type: "earnback_subsidy", amount_usd: pointsToUsd(grantPts), user_id: uid, ref: "earn_hook_ad", funded_by: "advertiser_pool", meta: { source: "earn_hook_reward" } }).catch(() => null);
    const adRev = Math.max(0, Number(body.ad_revenue_usd) || 0);
    if (adRev > 0) await recordRevenue({ type: "advertising", amount_usd: adRev, user_id: uid, ref: "earn_hook_ad", meta: { source: "earn_hook", network: String(body.network || "") } }).catch(() => null);

    return Response.json({
      ok: true, credited_points: grantPts, credited_usd: pointsToUsd(grantPts), capped: false,
      new_balance_points: Number(newBal) || 0,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
