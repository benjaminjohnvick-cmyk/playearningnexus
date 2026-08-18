import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  computeAdvertiserMetrics,
  benchmarkComparison,
  ppcBenchmarks,
  advertiserReportsEnabled,
} from "../../sdk/advertiser-metrics.ts";

// advertiserPerformance (auth, read-only) — the on-demand advertiser dashboard read. Returns the conventional
// PPC metric set (impressions, clicks, CTR, CPC, conversions, CPA, revenue, ROAS/ROI) + social/engagement
// attribution for the CALLER, computed from real activity, plus the benchmark comparison and the latest stored
// AI weekly report (summary + recommendations) if one exists. Measures actual performance and benchmarks it
// against standard PPC norms — it NEVER guarantees an ROI, and below the data threshold it says so. Never charges.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!advertiserReportsEnabled()) return Response.json({ enabled: false, reason: "reports disabled" });

    const uid = String(user.id);
    const body = await req.json().catch(() => ({}));
    const windowDays = Math.max(1, Math.round(Number(body.window_days) || 7));

    const metrics = await computeAdvertiserMetrics(uid, windowDays);
    const comparison = benchmarkComparison(metrics);
    const benchmarks = ppcBenchmarks();

    // Latest stored AI report (from the weekly sweep) — the summary + recommendations, if any.
    let latestReport: Record<string, unknown> | null = null;
    try {
      const reports = (await db.filter("AdvertiserReport", { advertiser_id: uid }, "-created_date", 1).catch(() => [])) as Record<string, unknown>[];
      latestReport = reports && reports[0] ? reports[0] : null;
    } catch { /* optional */ }

    return Response.json({
      enabled: true,
      advertiser_id: uid,
      window_days: windowDays,
      metrics,
      benchmarks,
      comparison,
      latest_report: latestReport
        ? {
          generated_at: latestReport.generated_at,
          summary: latestReport.summary,
          recommendations: latestReport.recommendations,
          substantiated: latestReport.substantiated,
        }
        : null,
      disclaimer: "Performance figures are measured from your real activity and shown with their basis. " +
        "Benchmarks are industry context, not a promise — we do not guarantee any ROI.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
