import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordRevenue, recordSubsidy } from "../../sdk/revenue.ts";
import {
  extensionEnabled, extensionOwnAdsEnabled, extensionRewardsDefaultEnrolled,
  grantablePointsForOneAd, pointsToUsd,
} from "../../sdk/extension.ts";

// extensionAdReward (authenticated) — credit closed-loop Site Points for one viewed ad on the extension's OWN
// surface (new-tab / popup). Requires the user to be reward-enrolled (opt-out) and the own-ads layer on. Bounded
// by the daily + lifetime caps (returns capped:true, credits 0, when a cap is hit). Points are non-cashable. If
// the ad's real value is reported, it's booked as `advertising`; the user's points are always a subsidy (cost).
//   { ad_unit?, advertiser_id?, ad_revenue_usd? } → { ok, credited_points, credited_usd, capped } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!extensionEnabled() || !extensionOwnAdsEnabled()) return Response.json({ error: "Extension ads aren't available right now." }, { status: 403 });

    const u = user as Record<string, unknown>;
    const enrolled = extensionRewardsDefaultEnrolled() ? u.extension_rewards_opt_out !== true : u.extension_rewards_opt_in === true;
    if (!enrolled) return Response.json({ error: "You've opted out of extension rewards." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const uid = String(user.id);

    const grantPts = await grantablePointsForOneAd(uid);
    if (grantPts <= 0) return Response.json({ ok: true, credited_points: 0, credited_usd: 0, capped: true, note: "You've reached today's earning limit — come back tomorrow." });

    const newBal = await adjustUserBalance(uid, grantPts, { field: "points" }).catch(() => null);
    if (newBal === null) return Response.json({ error: "Couldn't credit the reward. Please try again." }, { status: 500 });

    await db.create("ExtensionReward", {
      user_id: uid, kind: "own_ad", points: grantPts, day: new Date().toISOString().slice(0, 10),
      ad_unit: String(body.ad_unit || ""), advertiser_id: String(body.advertiser_id || ""), promotional: true, at: new Date().toISOString(),
    }).catch(() => null);

    await recordSubsidy({ type: "earnback_subsidy", amount_usd: pointsToUsd(grantPts), user_id: uid, ref: "extension_ad", funded_by: "advertiser_pool", meta: { source: "extension_own_ad" } }).catch(() => null);
    const adRev = Math.max(0, Number(body.ad_revenue_usd) || 0);
    if (adRev > 0) await recordRevenue({ type: "advertising", amount_usd: adRev, business_id: String(body.advertiser_id || "") || null, ref: "extension_ad", meta: { source: "extension_own_ad" } }).catch(() => null);

    return Response.json({ ok: true, credited_points: grantPts, credited_usd: pointsToUsd(grantPts), capped: false, new_balance_points: Number(newBal) || 0 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
