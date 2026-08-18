import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { computeAdvertiserMetrics, benchmarkComparison, ppcBenchmarks, advertiserReportsEnabled } from "../../sdk/advertiser-metrics.ts";

// advertiserWeeklyReport (scheduled service-role, or manual per-advertiser) — the automatic weekly AI
// performance report for EVERY advertiser across ALL tiers/offers. It measures the conventional PPC metric set
// (impressions, clicks, CTR, CPC, conversions, CPA, revenue, ROAS/ROI) + social/engagement-driven traffic and
// revenue from REAL data, benchmarks it against standard PPC norms, and has the AI write concrete
// recommendations. It NEVER guarantees an ROI and NEVER invents numbers — below the data threshold it reports
// "still gathering data." Stores an AdvertiserReport record (for the dashboard) and emails the advertiser.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!advertiserReportsEnabled()) return Response.json({ skipped: true, reason: "reports disabled" });

    const body = await req.json().catch(() => ({}));
    const windowDays = Math.max(1, Math.round(Number(body.window_days) || 7));

    // Manual single-advertiser call (authenticated), else scheduled sweep of all advertisers.
    let advertiserIds: string[] = [];
    const me = await base44.auth.me().catch(() => null);
    if (me?.id && body.self === true) {
      advertiserIds = [String(me.id)];
    } else {
      const ids = new Set<string>();
      for (const [entity, field] of [["AdListing", "owner_user_id"], ["FoundingAdvertiser", "user_id"], ["Tier2ScalingPlan", "user_id"]] as const) {
        const rows = (await base44.asServiceRole.entities[entity].list("-created_date", 2000).catch(() => [])) as Record<string, unknown>[];
        for (const r of rows) { const v = r[field]; if (v) ids.add(String(v)); }
      }
      advertiserIds = [...ids];
    }

    const bench = ppcBenchmarks();
    let generated = 0, emailed = 0, gathering = 0;
    for (const uid of advertiserIds) {
      const metrics = await computeAdvertiserMetrics(uid, windowDays).catch(() => null);
      if (!metrics) continue;
      const comparison = benchmarkComparison(metrics);

      // AI recommendations — grounded ONLY in the measured metrics; explicitly no ROI guarantees.
      let recommendations: string[] = [];
      let summary = "";
      if (metrics.substantiated) {
        try {
          const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `You are a PPC performance analyst. Using ONLY these measured weekly metrics for one advertiser, ` +
              `write a 1-sentence plain summary and 3-5 specific, actionable recommendations to improve results. ` +
              `Compare to standard PPC benchmarks. NEVER promise or guarantee a return or ROI — recommend, don't promise.\n\n` +
              `Metrics: ${JSON.stringify(metrics)}\nBenchmarks: ${JSON.stringify(bench)}\nComparison: ${JSON.stringify(comparison)}`,
            response_json_schema: { type: "object", properties: { summary: { type: "string" }, recommendations: { type: "array", items: { type: "string" } } } },
          });
          summary = String(ai?.summary || "");
          recommendations = Array.isArray(ai?.recommendations) ? ai.recommendations.slice(0, 6).map(String) : [];
        } catch { /* AI best-effort */ }
      } else {
        gathering++;
        summary = metrics.basis;
        recommendations = ["Keep your campaign running — we'll surface benchmarked performance and tailored recommendations once there's enough traffic to measure reliably."];
      }

      const report = {
        advertiser_id: uid, window_days: windowDays, generated_at: new Date().toISOString(),
        metrics, benchmarks: bench, comparison, summary, recommendations,
        substantiated: metrics.substantiated,
        disclaimer: "Performance figures are measured from real activity and shown with their basis. Benchmarks are industry context, not a promise; we do not guarantee any ROI.",
      };
      await db.create("AdvertiserReport", report).catch(() => null);
      generated++;

      // Email the advertiser (best-effort).
      try {
        const u = (await base44.asServiceRole.entities.User.filter({ id: uid }).catch(() => []))[0] as Record<string, unknown> | undefined;
        if (u?.email) {
          const lines = comparison.map((c) => `• ${c.metric}: ${c.value}${c.unit} (benchmark ${c.benchmark}${c.unit}${c.verdict !== "n/a" ? `, ${c.verdict}` : ""})`).join("\n");
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: String(u.email), from_name: "Advertiser Insights",
            subject: `Your weekly ad performance report`,
            body: `${summary}\n\nThis week (${windowDays}d):\n${lines}\n\nRecommendations:\n${recommendations.map((r) => `• ${r}`).join("\n")}\n\n${report.disclaimer}`,
          }).catch(() => null);
          emailed++;
        }
      } catch { /* email optional */ }
    }

    return Response.json({ ok: true, advertisers: advertiserIds.length, reports_generated: generated, emailed, still_gathering: gathering });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
