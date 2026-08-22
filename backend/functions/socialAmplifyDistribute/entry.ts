import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { withAdDisclosure } from "../../sdk/disclosure.ts";
import { normalizeTier, socialAmpEnabledForTier, socialPostContribution } from "../../sdk/social-amplification.ts";

// socialAmplifyDistribute — queue an advertiser's AI social ad to consenting members (all three tiers) for
// one-tap posting. Only opted-in members with connected accounts, #ad-disclosed. Creates queued SocialMediaPost
// rows tagged with the advertiser + tier; the member taps Post, then socialAmplifyConfirm records the reach.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tier = normalizeTier(body.tier);
    if (!socialAmpEnabledForTier(tier)) return Response.json({ error: "Social amplification is disabled for this tier." }, { status: 403 });

    const content = String(body.content ?? "").trim();
    if (!content) return Response.json({ error: "Ad content is required." }, { status: 400 });
    const disclosed = withAdDisclosure(content);         // FTC #ad disclosure
    const limit = Math.max(1, Math.min(Number(body.limit) || 500, 2000));

    // Eligible = members who opted in to social ads. Bounded batch per call.
    const members = await base44.asServiceRole.entities.User
      .filter({ ppc_social_ads_opt_in: true }, "-created_date", limit).then((r: any) => r || []).catch(() => []) as Record<string, unknown>[];

    let queued = 0, projectedReach = 0, projectedImpressions = 0, projectedValue = 0;
    for (const m of members) {
      const reach = Math.max(0, Number(m.social_reach) || 0);
      if (reach <= 0) continue;
      const c = socialPostContribution(reach);
      await db.create("SocialMediaPost", {
        advertiser_id: user.id, tier, user_id: m.id, content: disclosed,
        creative_id: body.creative_id ?? null, image_url: body.image_url ?? null,
        status: "queued", reach: c.reach, projected_impressions: c.est_impressions,
        created_at: new Date().toISOString(),
      }).catch(() => null);
      queued++; projectedReach += c.reach; projectedImpressions += c.est_impressions; projectedValue += c.value_usd;
    }

    return Response.json({
      success: true, tier, queued,
      projected: { reach: projectedReach, impressions: projectedImpressions, value_usd: Math.round(projectedValue * 100) / 100 },
      note: "Queued to opted-in members for one-tap, #ad-disclosed posting. Reach counts as delivered ad value once each member confirms they posted.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
