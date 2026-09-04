import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  extensionEnabled, extensionOwnAdsEnabled, extensionAffiliateEnabled, extensionTrackingEnabled,
  extensionRewardsDefaultEnrolled, extensionTrackingRequireOptin, extensionRewardPerImpressionPoints,
  extensionRewardDailyCapUsd, extensionAffiliateUserSharePct, grantablePointsForOneAd, pointsToUsd, rewardTotals,
  extensionWebstoreUrl,
} from "../../sdk/extension.ts";

// extensionConfig (authenticated) — powers the extension's own surfaces + the in-app extension settings. Returns
// which layers are on, the reward rates, the user's enrollment state, and whether an own-inventory ad can still
// be rewarded now (caps). No third-party page content and no ads here — config + the user's own state only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!extensionEnabled()) return Response.json({ enabled: false });

    const u = user as Record<string, unknown>;
    const grantable = await grantablePointsForOneAd(String(user.id));
    const { todayUsd } = await rewardTotals(String(user.id));

    // Rewards default-enrolled (opt-out): enrolled unless the user opted out.
    const rewardsEnrolled = extensionRewardsDefaultEnrolled() ? u.extension_rewards_opt_out !== true : u.extension_rewards_opt_in === true;
    // Tracking (Layer B): only active for users who explicitly opted in.
    const trackingActive = extensionTrackingEnabled() && (!extensionTrackingRequireOptin() || u.extension_tracking_opt_in === true);

    return Response.json({
      enabled: true,
      webstore_url: extensionWebstoreUrl(),
      layers: {
        own_ads: extensionOwnAdsEnabled(),        // show our own inventory on the extension surfaces
        affiliate: extensionAffiliateEnabled(),   // affiliate cashback on genuinely-referred sales
        tracking: extensionTrackingEnabled(),     // the opt-in browsing layer (Layer B)
      },
      rewards: {
        enrolled: rewardsEnrolled,
        per_ad_points: extensionRewardPerImpressionPoints(),
        ad_available: grantable > 0,
        earned_today_usd: todayUsd,
        daily_cap_usd: extensionRewardDailyCapUsd(),
        affiliate_user_share_pct: extensionAffiliateUserSharePct(),
      },
      prefs: {
        installed: u.extension_installed === true,
        rewards_opt_out: u.extension_rewards_opt_out === true,
        tracking_opt_in: u.extension_tracking_opt_in === true,
        tracking_active: trackingActive,
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
