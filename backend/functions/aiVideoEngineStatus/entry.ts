import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  videoEngineEnabled, spaceSize, currentSpace, VIDEO_DIMENSIONS,
  dailyConceptBudget, renderBudget, explorationPct, trendProvider,
  videoPlaybookFor, videoRecommendations,
} from "../../sdk/video-engine.ts";

// aiVideoEngineStatus — the admin dashboard payload: the size of the concept space, today's budgets and how
// much remains, the leaderboard (top concepts by predictive score, and tested ones by measured performance),
// the self-learning playbook + recommendations, and trend freshness. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const now = new Date().toISOString();
    const day = now.slice(0, 10);
    const budget = renderBudget();

    const [conceptsToday, renderedToday, testedTotal, topConcepts, topTested, trendRows, playbook] = await Promise.all([
      db.count("VideoConcept", { day, phase: "concept" }).catch(() => 0),
      db.count("VideoConcept", { day, phase: "rendered" }).catch(() => 0),
      db.count("VideoConcept", { phase: "tested" }).catch(() => 0),
      db.filter("VideoConcept", { phase: "concept", compliant: true }, "-predictive_score", 20).catch(() => []) as Promise<Record<string, unknown>[]>,
      db.filter("VideoConcept", { phase: "tested" }, "-performance", 20).catch(() => []) as Promise<Record<string, unknown>[]>,
      db.filter("VideoTrend", {}, "-created_at", 12).catch(() => []) as Promise<Record<string, unknown>[]>,
      videoPlaybookFor(db, now).catch(() => null),
    ]);

    const leaderboard = (topConcepts || []).map((r) => ({
      id: r.id, predictive_score: r.predictive_score, attributes: r.attributes, trend: r.trend, phase: r.phase,
    }));
    const measured = (topTested || []).map((r) => ({
      id: r.id, performance: r.performance, outcome_weight: r.outcome_weight, attributes: r.attributes, metrics: r.metrics,
    }));

    return Response.json({
      enabled: videoEngineEnabled(),
      space: {
        size: spaceSize(),
        dimensions: VIDEO_DIMENSIONS,
        values: currentSpace(),
      },
      budgets: {
        concepts_per_day: dailyConceptBudget(),
        concepts_used_today: conceptsToday,
        concepts_remaining_today: Math.max(0, dailyConceptBudget() - conceptsToday),
        render: budget,
        rendered_today: renderedToday,
        render_remaining_today: Math.max(0, budget.daily_render_max - renderedToday),
        spend_used_today_usd: Math.round(renderedToday * budget.est_cost_per_render_usd * 100) / 100,
        exploration_pct: explorationPct(),
      },
      trends: { provider: trendProvider(), recent: trendRows, count: (trendRows || []).length },
      leaderboard,
      measured,
      tested_total: testedTotal,
      learning: {
        sample_size: playbook?.sample_size ?? 0,
        top: playbook?.top ?? {},
        recommendations: playbook ? videoRecommendations(playbook) : [],
      },
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
