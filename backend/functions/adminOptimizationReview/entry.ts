import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// adminOptimizationReview (ADMIN) — everything the AI Optimization dashboard needs: pending
// recommendations awaiting approval, recently applied changes and their measured outcomes/lift, the
// per-setting learning memory, and the latest signal snapshot. Read-only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const [pending, recentRecs, outcomes, learning, signals, experiments] = await Promise.all([
      db.filter("OptimizationRecommendation", { status: "pending" }, "-created_at", 100).catch(() => []),
      db.filter("OptimizationRecommendation", {}, "-created_at", 50).catch(() => []),
      db.filter("OptimizationOutcome", {}, "-applied_at", 100).catch(() => []),
      db.filter("AILearningState", {}, "-updated_at", 200).catch(() => []),
      db.filter("OptimizationSignal", {}, "-collected_at", 600).catch(() => []),
      db.filter("OptimizationExperiment", {}, "-created_at", 50).catch(() => []),
    ]);

    // Latest value per metric from the signal history.
    const latestByMetric: Record<string, unknown> = {};
    for (const s of signals as any[]) if (!(s.metric in latestByMetric)) latestByMetric[s.metric] = s.value;

    // Time-series per metric (oldest→newest) for the trend chart.
    const series: Record<string, Array<{ t: string; v: number }>> = {};
    for (const s of (signals as any[]).slice().reverse()) {
      const m = String(s.metric);
      (series[m] ||= []).push({ t: String(s.collected_at ?? ""), v: Number(s.value) || 0 });
    }

    return Response.json({
      pending, recent_recommendations: recentRecs, outcomes, learning,
      latest_snapshot: latestByMetric, series, experiments,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
