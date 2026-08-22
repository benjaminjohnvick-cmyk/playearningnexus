import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { socialImpressionsForAdvertiser, socialImpressionsValueUsd } from "../../sdk/social-amplification.ts";

// advertiserSocialValue — report the delivered ad VALUE an advertiser has earned from user-amplified social
// posts: total reach, estimated impressions, and $ value (at the same CPM the value guarantee uses). Feeds the
// advertiser's ad-value total and their measured ROI report. Measured, never guaranteed.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const advertiserId = (user.role === "admin" && body.advertiser_id) ? String(body.advertiser_id) : user.id;
    const windowDays = Math.max(1, Math.min(Number(body.window_days) || 30, 365));
    const sinceISO = new Date(Date.now() - windowDays * 86400000).toISOString();

    const agg = await socialImpressionsForAdvertiser(db, advertiserId, sinceISO).catch(() => ({ posts: 0, reach: 0, impressions: 0, value_usd: 0 }));

    return Response.json({
      success: true, advertiser_id: advertiserId, window_days: windowDays,
      social: {
        posts: agg.posts, reach: agg.reach, estimated_impressions: agg.impressions,
        value_usd: agg.value_usd,
        value_check_usd: socialImpressionsValueUsd(agg.impressions),
      },
      basis: `${agg.posts.toLocaleString()} member posts reached ${agg.reach.toLocaleString()} followers → ~${agg.impressions.toLocaleString()} estimated impressions (measured per confirmed post; estimated at the platform view-rate; counts as delivered advertising value, not a guaranteed result).`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
