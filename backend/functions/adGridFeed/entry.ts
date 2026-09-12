import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adgridThumbnailsPerSession, adgridThumbnailPrice, INTEREST_QUESTION } from "../../sdk/adgrid.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { adGridAccess } from "../../sdk/adgrid-access.ts";
import { normalizeTargeting, userMatchesTargeting } from "../../sdk/ad-targeting.ts";
import { resolveAdMedia } from "../../sdk/ad-media.ts";
import { rankByLearnedAffinity, loadTargetingModel } from "../../sdk/ad-targeting-ai.ts";

// adGridFeed (authenticated) — the daily grid of thumbnails. Premium users always get it; non-premium users
// get it from the non-reserved slice (or with a reallocated slot), else they're told to use BitLabs. Each
// thumbnail carries its 2 questions + the permanent Option E interest question.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const n = adgridThumbnailsPerSession();
    const today = new Date().toISOString().slice(0, 10);

    // ACCESS GATE (server-side): premium/granted always; non-premium from the non-reserved slice under cap.
    const isPremium = await isPremiumUser(user.id);
    const grants = await db.filter("AdGridSlotGrant", { user_id: user.id, granted_date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const activeAds = await db.filter("AdGridAd", { status: "active" }, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
    const sessionsToday = await db.filter("AdGridSession", { user_id: user.id, day: today }, "-created_date", 10).catch(() => []) as unknown[];
    const access = adGridAccess({
      isPremium, hasGrant: !!(grants && grants[0]),
      activeAdCount: (activeAds || []).length, nonPremiumSessionsUsedToday: (sessionsToday || []).length,
    });
    if (!access.allowed) {
      return Response.json({ thumbnails: [], available: 0, adgrid_allowed: false, use_provider: access.provider, reason: access.reason });
    }

    // Suppress products the user marked "not interested", and ones already answered today.
    const priorResponses = await db.filter("AdGridResponse", { user_id: user.id }, "-created_date", 5000).catch(() => []) as Record<string, unknown>[];
    const notInterested = new Set<string>();
    const answeredToday = new Set<string>();
    for (const r of (priorResponses || [])) {
      if (r.interested === false) notInterested.add(String(r.ad_id));
      if (String(r.day) === today) answeredToday.add(String(r.ad_id));
    }

    const ads = await base44.asServiceRole.entities.AdGridAd.filter({ status: "active" }, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
    // Cohort targeting: a targeted PPC ad only shows to users whose Know-Your-Customer answers match its
    // cohort; untargeted ads show to everyone. Same matcher used by the interstitial + social placements.
    const kycAnswers = (user?.kyc_answers as Record<string, unknown> | undefined) ?? null;
    let eligible = (ads || []).filter((a) =>
      !notInterested.has(String(a.id)) &&
      !answeredToday.has(String(a.id)) &&
      userMatchesTargeting(normalizeTargeting(a.targeting), kycAnswers, user as Record<string, unknown> | undefined),
    );

    // Self-learning AI layer: order the eligible ads by learned cohort affinity for THIS user (a relevance
    // bias only — it never excludes an ad or changes an advertiser's chosen targeting). No-ops when the
    // model is empty or the AI layer is off/killed.
    const model = await loadTargetingModel(db).catch(() => null);
    eligible = rankByLearnedAffinity(eligible, model, kycAnswers);

    const thumbnails = eligible.slice(0, n).map((a) => ({
      ad_id: a.id,
      product_name: a.product_name,
      image_url: a.image_url || null,
      // Advertiser audio/video creative (falls back to the thumbnail image when off/absent). The PPC survey
      // UI plays the video with the questions in a bar beneath it.
      ...resolveAdMedia(a),
      questions: [
        ...((a.questions as any[]) || []).map((q) => ({ q: q.q, options: q.options })),
        { q: INTEREST_QUESTION, options: ["Yes", "No"], is_interest: true },   // permanent Option E
      ],
    }));

    return Response.json({
      thumbnails,
      thumbnails_per_session: n,
      price_per_thumbnail: adgridThumbnailPrice(),
      session_goal_usd: Math.round(n * adgridThumbnailPrice() * 100) / 100,
      available: eligible.length,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
