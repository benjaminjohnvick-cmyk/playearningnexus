import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { Core } from "../../sdk/integrations.ts";
import { getBool, getNumber, getString, snapBool } from "../../sdk/settings.ts";
import { withAdDisclosure } from "../../sdk/disclosure.ts";
import { aiPaused, logAiAction } from "../../sdk/ai-control.ts";
import { adLearningInsights, prioritizeByLearning, AD_AGENT } from "../../sdk/ad-learning.ts";
import { usableTrends, type TrendSignal } from "../../sdk/video-engine.ts";

// aiTrendSocialAds (INTERNAL/ADMIN, scheduled) — reactive, current-events social ADS for the business, in the
// spirit of Mint Mobile's topical marketing. It rides the SAME live trend pool the AI Video Engine already
// refreshes each morning (VideoTrend — real Google-Trends daily searches, AI-curated for brand safety), picks
// the hottest brand-safe trends, and has the AI write an ON-BRAND, news-jacking social ad for each. The ads are
// queued as #ad-disclosed platform_own_ad SocialMediaPosts on CONSENTING members' accounts (member approval by
// default), biased by the self-learning loop (best platforms + copy that lands). They flow into the same
// tracking/optimization as every other ad: outcomes become OptimizationSignal + AgentLearningMemory, and the
// ad-metrics dashboard measures the own-ad social performance. Respects the global AI pause + the enable flag.
export const aiTrendSocialAdsEnabled = () => snapBool("AI_TREND_SOCIAL_ADS_ENABLED", true);

export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    if (!aiTrendSocialAdsEnabled()) return Response.json({ enabled: false, reason: "trend social ads disabled" });
    if (await aiPaused().catch(() => false)) return Response.json({ enabled: true, paused: true, generated: 0 });
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const bizName = await getString("PREMIUM_OWN_AD_BUSINESS", "Get Goods Gratis");
    const maxTrends = Math.max(1, Math.round(Number(body.max_trends) || await getNumber("TREND_SOCIAL_ADS_MAX", 3)));
    const maxPosts = Math.max(1, Math.round(await getNumber("PREMIUM_ADS_MAX_POSTS_PER_RUN", 200)));
    const perTrendMembers = Math.max(1, Math.round(await getNumber("TREND_SOCIAL_ADS_MEMBERS_PER_TREND", 25)));
    const postStatus = (await getBool("PREMIUM_ADS_REQUIRE_APPROVAL", true)) ? "pending_approval" : "scheduled";

    // Hottest brand-safe trends from the live pool the video engine refreshes (aiVideoEngineRefreshTrends).
    const rows = (await db.filter("VideoTrend", {}, "-created_at", 80).catch(() => [])) as Record<string, unknown>[];
    const signals: TrendSignal[] = rows
      .filter((r) => r.brand_safe !== false)
      .map((r) => ({ topic: String(r.topic ?? ""), source: String(r.source ?? ""), momentum: Number(r.momentum) || 0, hashtags: Array.isArray(r.hashtags) ? r.hashtags as string[] : [], category: String(r.category ?? ""), angle_hint: String(r.angle_hint ?? "current-event") } as TrendSignal));
    const top = usableTrends(signals).slice(0, maxTrends);
    if (!top.length) return Response.json({ enabled: true, generated: 0, reason: "no brand-safe trends in the pool yet (run aiVideoEngineRefreshTrends first)" });

    // Consenting members + learned platform priority.
    const optedIn = (await base44.asServiceRole.entities.User.filter({ ppc_social_ads_opt_in: true }, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[];
    const optedIds = new Set(optedIn.map((u) => u.id));
    if (!optedIds.size) return Response.json({ enabled: true, generated: 0, reason: "no consenting members" });
    const insights = await adLearningInsights().catch(() => null);
    const conns = prioritizeByLearning(
      (await base44.asServiceRole.entities.SocialMediaConnection.filter({}, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[],
      insights?.rankedPlatforms ?? [],
    ).filter((c) => optedIds.has(c.user_id));

    let totalPosts = 0; const made: Record<string, unknown>[] = [];
    for (const t of top) {
      if (totalPosts >= maxPosts) break;
      // On-brand, news-jacking ad copy for this trend.
      let copy = "";
      try {
        const out = await Core.InvokeLLM({
          prompt: `A play-to-earn / rewards / savings brand, "${bizName}", wants ONE short, witty social AD that news-jacks a trending topic, in the spirit of Mint Mobile's topical marketing.\n` +
            `Trending topic: "${t.topic}" (category: ${t.category || "general"}; angle: ${t.angle_hint || "current-event"}).\n` +
            `Rules: reference the trend cleverly, tie it back to earning/saving/shopping with ${bizName}, keep it upbeat and brand-safe, max 220 chars, 1-2 emojis, no hashtags (a disclosure is appended automatically). Return ONLY the post text.`,
        }) as string;
        if (typeof out === "string" && out.trim()) copy = out.trim().slice(0, 240);
      } catch { /* fall through */ }
      if (!copy) copy = `While everyone's talking about ${t.topic}, ${bizName} is busy turning your everyday play & shopping into real rewards. 💸`;
      const content = withAdDisclosure(copy);

      let postsForTrend = 0;
      for (const conn of conns) {
        if (totalPosts >= maxPosts || postsForTrend >= perTrendMembers) break;
        await base44.asServiceRole.entities.SocialMediaPost.create({
          user_id: conn.user_id, platform: conn.platform, content,
          status: postStatus, auto_posted: true, post_type: "platform_own_ad", disclosed: true,
          trend_topic: t.topic, trend_angle: t.angle_hint || "current-event", created_at: new Date().toISOString(),
        }).catch(() => null);
        postsForTrend++; totalPosts++;
      }
      made.push({ topic: t.topic, momentum: t.momentum, posts: postsForTrend, copy });
    }

    await logAiAction({
      agent: AD_AGENT, action: "trend_social_ads", target: "platform_own_ad",
      status: postStatus === "pending_approval" ? "queued" : "applied", reversible: true,
      summary: `AI queued ${totalPosts} trend-reactive own ad(s) across ${made.length} trending topic(s) to consenting members` +
        (insights?.rankedPlatforms?.length ? `; prioritized platforms: ${insights.rankedPlatforms.slice(0, 4).join(", ")}` : ""),
      detail: { trends: made.map((m) => ({ topic: m.topic, posts: m.posts })), post_status: postStatus },
    }).catch(() => null);

    return Response.json({
      enabled: true, generated: totalPosts, trends_used: made.length,
      post_status: postStatus, trends: made,
      note: "Trend-reactive own ads queued (disclosed, member-approval by default). They feed the same self-learning loop and the ad-metrics own-ad social tracking.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
