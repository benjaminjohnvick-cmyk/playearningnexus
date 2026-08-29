import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { trendProvider, videoEngineEnabled } from "../../sdk/video-engine.ts";

// aiVideoEngineRefreshTrends — refresh the pool of live trending topics / current events that ground the
// engine's concepts (Mint-Mobile-style news-jacking). Source is admin-tunable:
//   • "llm"    — ask a web-aware model for what's trending right now, filtered to the platform's themes
//   • "manual" — the admin passes a { trends: [...] } list in the body
//   • "none"   — the trend layer is off; this just clears nothing and returns
// Persists each trend as a VideoTrend row (topic, source, momentum, hashtags, category, angle_hint, captured_at).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!videoEngineEnabled()) return Response.json({ error: "The AI Video Engine is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const provider = String(body.provider ?? trendProvider());

    let trends: Record<string, unknown>[] = [];

    if (provider === "manual" && Array.isArray(body.trends)) {
      trends = body.trends.map((t: Record<string, unknown>) => ({
        topic: String(t.topic ?? "").slice(0, 160),
        source: String(t.source ?? "manual").slice(0, 40),
        momentum: Math.max(0, Math.min(100, Number(t.momentum) || 50)),
        hashtags: Array.isArray(t.hashtags) ? t.hashtags.slice(0, 8).map(String) : [],
        category: String(t.category ?? "").slice(0, 40),
        angle_hint: String(t.angle_hint ?? "").slice(0, 40),
      })).filter((t) => t.topic);
    } else if (provider === "llm") {
      const prompt = `List the ${Math.min(30, Number(body.limit) || 20)} biggest things trending RIGHT NOW across social media (TikTok, X, Instagram, YouTube), Google Trends, and current news/events that a play-to-earn / rewards / savings brand could tastefully make a short reactive video about (news-jacking, in the spirit of Mint Mobile's topical marketing).
For each, give: topic (short), source (tiktok|x|instagram|youtube|google-trends|news), momentum (0-100 how hot it is now), hashtags (up to 4), category, and angle_hint — one of: news-jack, current-event, trending-meme, seasonal, viral-audio, brand-moment.
Only include items that are genuinely current and brand-safe (no tragedies, no politics, no disasters). Prefer consumer/tech/gaming/finance/pop-culture moments.`;
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            trends: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" }, source: { type: "string" }, momentum: { type: "number" },
                  hashtags: { type: "array", items: { type: "string" } }, category: { type: "string" }, angle_hint: { type: "string" },
                },
                required: ["topic"],
              },
            },
          },
        },
      }).catch(() => null);
      const raw = (res && (res as Record<string, unknown>).trends) as Record<string, unknown>[] | undefined;
      trends = (raw || []).map((t) => ({
        topic: String(t.topic ?? "").slice(0, 160),
        source: String(t.source ?? "news").slice(0, 40),
        momentum: Math.max(0, Math.min(100, Number(t.momentum) || 50)),
        hashtags: Array.isArray(t.hashtags) ? t.hashtags.slice(0, 8).map(String) : [],
        category: String(t.category ?? "").slice(0, 40),
        angle_hint: String(t.angle_hint ?? "").slice(0, 40),
      })).filter((t) => t.topic);
    } else {
      return Response.json({ ok: true, provider, refreshed: 0, note: "Trend provider is 'none' — trend layer off." });
    }

    let saved = 0;
    for (const t of trends) {
      await db.create("VideoTrend", { ...t, captured_at: now, created_at: now }).then(() => saved++).catch(() => null);
    }
    return Response.json({ ok: true, provider, refreshed: saved, trends: trends.slice(0, 30), captured_at: now });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
