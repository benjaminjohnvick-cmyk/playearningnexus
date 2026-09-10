import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { newFeedbackAgg, addFeedback, finalizeFeedback, type FeedbackAgg, type FeedbackKind } from "../../sdk/feedback.ts";

// feedbackStatus — the admin rollup of everything the site has learned from customer interactions: per-surface
// and per-domain feedback (mostly IMPLICIT — conversions, completions, dwell — collected automatically), the
// net sentiment, and the loudest problems (reports). Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    // Stream ALL feedback events in bounded memory (keyset scan). The per-surface / per-domain accumulators are
    // bounded by the number of DISTINCT keys, so the rollup is correct at any table size — no 10k cap silently
    // truncating the numbers, and never the whole table materialized in memory.
    const bySurface: Record<string, FeedbackAgg> = {};
    const byDomain: Record<string, FeedbackAgg> = {};
    let implicit = 0, explicit = 0, total = 0;
    const IMPLICIT = new Set(["conversion", "completion", "dwell"]);
    for await (const batch of db.scan("FeedbackEvent", {}, 2000)) {
      for (const r of batch) {
        total++;
        const k = String(r.kind ?? "");
        if (IMPLICIT.has(k)) implicit++; else explicit++;
        const row = { kind: r.kind as FeedbackKind, value: Number(r.value) || 0, weight: Number(r.weight) };
        addFeedback((bySurface[String(r.surface ?? "?")] ??= newFeedbackAgg()), row);
        const d = String(r.domain ?? ""); if (d) addFeedback((byDomain[d] ??= newFeedbackAgg()), row);
      }
    }

    const rollup = (m: Record<string, FeedbackAgg>) => Object.entries(m)
      .map(([key, agg]) => ({ key, ...finalizeFeedback(agg) }))
      .sort((a, b) => b.count - a.count);

    // Most-recent reports come from a dedicated small indexed query (globally recent, not just within a cap).
    const reportRows = await db.filter("FeedbackEvent", { kind: "report" }, "-created_at", 20).catch(() => []) as Record<string, unknown>[];
    const reports = reportRows.map((r) => ({ surface: r.surface, subject_id: r.subject_id, comment: r.comment, at: r.at }));

    return Response.json({
      total,
      mix: { implicit, explicit, implicit_pct: total ? Math.round((implicit / total) * 100) : 0 },
      surfaces: rollup(bySurface).slice(0, 40),
      domains: rollup(byDomain),
      recent_reports: reports,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
