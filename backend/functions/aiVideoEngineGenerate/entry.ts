import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  videoEngineEnabled, spaceSize, sampleConcepts, attachTrends, scoreConcept, screenConcept,
  dailyConceptBudget, videoPlaybookFor, VIDEO_DIMENSIONS,
  type TrendSignal, type VideoConcept,
} from "../../sdk/video-engine.ts";

// aiVideoEngineGenerate — the CHEAP, phased "generate concepts" step. Samples the concept space (ε-greedy,
// biased by the self-learning playbook), grounds each concept in a live trend (news-jacking), builds a
// templated micro-brief, screens it for compliance, and gives it a 0–100 predictive score — all WITHOUT
// rendering any video or (by default) calling the LLM per concept, so thousands of concepts cost almost
// nothing. Persists them as VideoConcept rows (phase="concept"). Winners get real scripts + renders later
// via aiVideoEngineRenderWinners. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!videoEngineEnabled()) return Response.json({ error: "The AI Video Engine is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const day = now.slice(0, 10);

    // Batch size, capped by the daily concept budget minus what's already been generated today.
    const requested = Math.max(1, Math.min(Number(body.batch_size) || 200, 5000));
    const usedToday = await db.count("VideoConcept", { day, phase: "concept" }).catch(() => 0);
    const remainingToday = Math.max(0, dailyConceptBudget() - usedToday);
    if (remainingToday <= 0) return Response.json({ error: "Daily concept budget reached.", used_today: usedToday, budget: dailyConceptBudget() }, { status: 429 });
    const batch = Math.min(requested, remainingToday);
    const seed = String(body.seed ?? `${day}-${usedToday}`);

    // Self-learning playbook re-biases the sample toward what's currently winning.
    const playbook = await videoPlaybookFor(db, now).catch(() => null);

    // Sample the space, then ground each concept in a live trend.
    let concepts: VideoConcept[] = sampleConcepts(batch, { top: playbook?.top ?? {}, seed });
    const useTrends = body.use_trends !== false;
    let trends: TrendSignal[] = [];
    if (useTrends) {
      const rows = await db.filter("VideoTrend", {}, "-created_at", 60).catch(() => []) as Record<string, unknown>[];
      trends = (rows || []).map((r) => ({
        topic: String(r.topic ?? ""), source: String(r.source ?? ""), momentum: Number(r.momentum) || 0,
        hashtags: Array.isArray(r.hashtags) ? (r.hashtags as string[]) : [], category: String(r.category ?? ""),
        angle_hint: String(r.angle_hint ?? ""), captured_at: String(r.captured_at ?? ""),
      }));
    }
    const enriched = attachTrends(concepts, trends, seed);

    // Build a compliance-safe micro-brief + predictive score for each, and persist.
    const persisted: Record<string, unknown>[] = [];
    for (const e of enriched) {
      const c = e.concept;
      const tag = (d: string) => c[d as keyof VideoConcept] ?? "";
      const trendLine = e.trend ? ` Tie it to what's trending now: "${e.trend.topic}"${e.trend.hashtags?.length ? ` (${e.trend.hashtags.join(" ")})` : ""}.` : "";
      const brief = `A ${tag("duration")} ${tag("visual_style")} short-form video. Open with a ${tag("hook")} hook on a ${tag("opening_shot")} shot, ${tag("pacing")} pacing, ${tag("caption_style")} captions, ${tag("music")} music${tag("voice") !== "none" ? `, ${tag("voice")} voice` : ""}. Theme: ${tag("theme")}. CTA style: ${tag("cta_style")} (${tag("trend_angle")}).${trendLine} Sell the experience and delivered value — never a financial return.`;
      const scr = screenConcept({ concept: c, script: brief });
      const score = scoreConcept({ concept: c, script: brief }, playbook ?? undefined);
      const doc = {
        attributes: c,
        trend: e.trend ?? null,
        brief,
        predictive_score: score,
        compliant: scr.ok,
        phase: "concept",
        day,
        created_at: now,
      };
      const saved = await db.create("VideoConcept", doc).catch(() => null) as Record<string, unknown> | null;
      persisted.push({ id: saved?.id ?? null, attributes: c, trend: e.trend ?? null, predictive_score: score, compliant: scr.ok, brief });
    }

    // Sort the returned preview by predictive score so the admin sees the strongest concepts first.
    persisted.sort((a, b) => (Number(b.predictive_score) || 0) - (Number(a.predictive_score) || 0));

    return Response.json({
      ok: true,
      generated: persisted.length,
      used_today: usedToday + persisted.length,
      daily_budget: dailyConceptBudget(),
      space_size: spaceSize(),
      dimensions: VIDEO_DIMENSIONS,
      trends_used: trends.length,
      playbook_top: playbook?.top ?? {},
      concepts: persisted.slice(0, 100),
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
