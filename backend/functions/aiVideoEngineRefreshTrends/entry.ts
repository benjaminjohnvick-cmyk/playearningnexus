import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { trendProvider, trendGeo, videoEngineEnabled, parseGoogleTrendsRss, type TrendSignal } from "../../sdk/video-engine.ts";

// aiVideoEngineRefreshTrends — refresh the live trend pool that grounds concepts (Mint-Mobile-style
// news-jacking). Providers:
//   • "auto"   — SEARCH THE INTERNET: fetch Google-Trends daily trending searches (real, current, no API key),
//                then let the AI curate them (brand-safe filter + category/angle/hashtags). Falls back to
//                "llm" if the fetch fails. This is the default and what a daily scheduled run uses.
//   • "llm"    — ask the model from its own knowledge (no live fetch).
//   • "manual" — the admin passes a { trends: [...] } list.
//   • "none"   — trend layer off.
// Persists each as a VideoTrend row. Admin only (the daily scheduler calls it as the seed-admin service user).

const RSS_HEADERS = { "user-agent": "Mozilla/5.0 (compatible; GetGoodsGratis-TrendBot/1.0)" };
const NEWS_KEEP = 40;

async function fetchFirstRss(urls: string[]): Promise<string> {
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: RSS_HEADERS });
      if (!r.ok) continue;
      const t = await r.text();
      if (t && /<item[\s>]/i.test(t)) return t;
    } catch { /* try next */ }
  }
  return "";
}

function normList(raw: Record<string, unknown>[], now: string): Record<string, unknown>[] {
  return raw.map((t) => ({
    topic: String(t.topic ?? "").slice(0, 160),
    source: String(t.source ?? "auto").slice(0, 40),
    momentum: Math.max(0, Math.min(100, Number(t.momentum) || 50)),
    hashtags: Array.isArray(t.hashtags) ? t.hashtags.slice(0, 8).map(String) : [],
    category: String(t.category ?? "").slice(0, 60),
    angle_hint: String(t.angle_hint ?? "current-event").slice(0, 40),
    captured_at: now, created_at: now,
  })).filter((t) => t.topic);
}

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
    const limit = Math.min(40, Math.max(5, Number(body.limit) || 25));

    let trends: Record<string, unknown>[] = [];
    let liveCount = 0, curated = false, sourceUrl = "";

    // ── MANUAL ────────────────────────────────────────────────────────────────────────────────────────
    if (provider === "manual" && Array.isArray(body.trends)) {
      trends = normList(body.trends.map((t: Record<string, unknown>) => ({ ...t, source: t.source ?? "manual" })), now);
    }
    // ── NONE ──────────────────────────────────────────────────────────────────────────────────────────
    else if (provider === "none") {
      return Response.json({ ok: true, provider, refreshed: 0, note: "Trend provider is 'none' — trend layer off." });
    }
    // ── AUTO (live internet) or LLM ─────────────────────────────────────────────────────────────────────
    else {
      let live: TrendSignal[] = [];
      if (provider === "auto") {
        const geo = String(body.geo ?? trendGeo());
        const override = String(body.rss_url ?? "").trim();
        const urls = [
          ...(override ? [override] : []),
          `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`,
          `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}`,
        ];
        const xml = await fetchFirstRss(urls);
        if (xml) { live = parseGoogleTrendsRss(xml); liveCount = live.length; sourceUrl = "google-trends"; }
      }

      if (live.length) {
        // Curate the LIVE topics with the AI: keep brand-safe ones, assign category/angle/hashtags, keep momentum.
        const topics = live.slice(0, limit).map((t) => t.topic);
        try {
          const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `These are REAL topics trending right now (from Google Trends): ${JSON.stringify(topics)}.
A play-to-earn / rewards / savings brand ("Get Goods Gratis") wants to make short reactive videos about the brand-safe ones (news-jacking, in the spirit of Mint Mobile's topical marketing).
For EACH topic you keep, return: topic (verbatim), brand_safe (true/false — false for tragedies, politics, disasters, adult/violent), category, angle_hint (one of: news-jack, current-event, trending-meme, seasonal, viral-audio, brand-moment), and up to 3 hashtags. Drop nothing from the list — mark unsafe ones brand_safe:false.`,
            response_json_schema: {
              type: "object",
              properties: { items: { type: "array", items: { type: "object", properties: {
                topic: { type: "string" }, brand_safe: { type: "boolean" }, category: { type: "string" },
                angle_hint: { type: "string" }, hashtags: { type: "array", items: { type: "string" } },
              }, required: ["topic"] } } },
            },
          }).catch(() => null) as Record<string, unknown> | null;
          const items = (res?.items as Record<string, unknown>[]) || [];
          if (items.length) {
            curated = true;
            const momByTopic = new Map(live.map((t) => [t.topic, t.momentum]));
            trends = normList(items
              .filter((it) => it.brand_safe !== false)
              .map((it) => ({
                topic: it.topic, source: "google-trends",
                momentum: momByTopic.get(String(it.topic)) ?? 55,
                category: it.category, angle_hint: it.angle_hint, hashtags: it.hashtags,
              })), now);
          }
        } catch { /* curation failed — use raw live below */ }
        if (!trends.length) trends = normList(live.slice(0, limit) as unknown as Record<string, unknown>[], now);
      }

      // Fallback: no live results (fetch blocked / provider "llm") → ask the model from its own knowledge.
      if (!trends.length) {
        const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `List the ${limit} biggest things trending RIGHT NOW across social media (TikTok, X, Instagram, YouTube) and current news/events that a play-to-earn / rewards / savings brand could tastefully make a short reactive video about (news-jacking, à la Mint Mobile).
For each: topic, source (tiktok|x|instagram|youtube|google-trends|news), momentum (0-100), hashtags (up to 4), category, angle_hint (news-jack|current-event|trending-meme|seasonal|viral-audio|brand-moment). Brand-safe only (no tragedies/politics/disasters).`,
          add_context_from_internet: true,
          response_json_schema: { type: "object", properties: { trends: { type: "array", items: { type: "object", properties: {
            topic: { type: "string" }, source: { type: "string" }, momentum: { type: "number" },
            hashtags: { type: "array", items: { type: "string" } }, category: { type: "string" }, angle_hint: { type: "string" },
          }, required: ["topic"] } } } },
        }).catch(() => null) as Record<string, unknown> | null;
        trends = normList(((res?.trends as Record<string, unknown>[]) || []).map((t) => ({ ...t, source: t.source ?? "llm" })), now);
      }
    }

    // Persist (cap at limit).
    const finalTrends = trends.slice(0, limit);
    let saved = 0;
    for (const t of finalTrends) {
      await db.create("VideoTrend", t).then(() => saved++).catch(() => null);
    }
    return Response.json({
      ok: true, provider, refreshed: saved,
      live_fetched: liveCount, curated, source: sourceUrl || provider,
      trends: finalTrends.slice(0, NEWS_KEEP), captured_at: now,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
