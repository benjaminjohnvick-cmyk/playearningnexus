import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { aggregateFeedback } from "../../sdk/feedback.ts";

// feedbackStatus — the admin rollup of everything the site has learned from customer interactions: per-surface
// and per-domain feedback (mostly IMPLICIT — conversions, completions, dwell — collected automatically), the
// net sentiment, and the loudest problems (reports). Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const rows = await db.filter("FeedbackEvent", {}, "-created_at", 10000).catch(() => []) as Record<string, unknown>[];

    const bySurface: Record<string, Record<string, unknown>[]> = {};
    const byDomain: Record<string, Record<string, unknown>[]> = {};
    let implicit = 0, explicit = 0;
    const IMPLICIT = new Set(["conversion", "completion", "dwell"]);
    for (const r of rows) {
      const k = String(r.kind ?? "");
      if (IMPLICIT.has(k)) implicit++; else explicit++;
      (bySurface[String(r.surface ?? "?")] ??= []).push(r);
      const d = String(r.domain ?? ""); if (d) (byDomain[d] ??= []).push(r);
    }

    const rollup = (m: Record<string, Record<string, unknown>[]>) => Object.entries(m)
      .map(([key, rs]) => ({ key, ...aggregateFeedback(rs.map((r) => ({ kind: r.kind as never, value: Number(r.value) || 0, weight: Number(r.weight) }))) }))
      .sort((a, b) => b.count - a.count);

    const reports = rows.filter((r) => r.kind === "report").slice(0, 20).map((r) => ({ surface: r.surface, subject_id: r.subject_id, comment: r.comment, at: r.at }));

    return Response.json({
      total: rows.length,
      mix: { implicit, explicit, implicit_pct: rows.length ? Math.round((implicit / rows.length) * 100) : 0 },
      surfaces: rollup(bySurface).slice(0, 40),
      domains: rollup(byDomain),
      recent_reports: reports,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
