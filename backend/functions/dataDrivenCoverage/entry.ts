import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import {
  dataDrivenCoverageEnabled, buildCoverageReport, snapshotCoverage, coverageTrend, humanReviewQueue,
} from "../../sdk/data-driven-coverage.ts";

// dataDrivenCoverage (admin/internal) — the single-page "is my site data-driven?" report. Rolls the autonomy
// kernel, the optimizer registry, and the OptimizationSignal/AgentPerformanceLog stores into two numbers:
// BUILD coverage (is the data-driven loop fully wired — reads ~100% even before launch) and LIVE coverage (how
// much real data is actually flowing through it yet — grows with traffic). Also returns the human-in-the-loop
// queue: the AI-prepared outputs on the by-design gates (money/identity/legal) awaiting a human's approval, so
// "AI does the work → a human signs off" is visible and actionable in one place. Read-only unless snapshot=true
// (which writes the two headline numbers as OptimizationSignal rows so the dashboard can trend them over time).
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    if (!dataDrivenCoverageEnabled()) return Response.json({ ok: true, enabled: false, note: "Data-driven coverage report is OFF." });
    const body = await req.json().catch(() => ({}));
    const freshDays = Math.max(1, Number(body.fresh_days) || 3);

    const report = await buildCoverageReport(freshDays);
    if (body.snapshot === true) await snapshotCoverage(report);

    const [trend, queue] = await Promise.all([
      coverageTrend(60),
      humanReviewQueue(100),
    ]);

    return Response.json({ ok: true, enabled: true, ...report, trend, human_review_queue: queue });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
