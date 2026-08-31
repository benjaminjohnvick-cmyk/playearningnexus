import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { setSetting, effectiveSettings, invalidateSettingsCache } from "../../sdk/settings.ts";
import { autoScaleEnabled, scaleLeversFromSettings, decideScale, type ScaleMetrics } from "../../sdk/scale-governor.ts";

// scaleGovernorRun — the GATED auto-scale job. Reads live load metrics, decides which scale levers to flip (up
// under load, back down when it subsides, with hysteresis), and applies the changes by writing settings the
// rest of the platform reads (render provider → serverless GPU, caches on, read-replica routing, render/worker
// concurrency, AI tier). While AUTO_SCALE_ENABLED is off it is PREVIEW-ONLY — it reports what it WOULD flip and
// changes nothing. Metrics come from the caller (a monitor/scheduler) or default to 0. Admin / seed-admin;
// wire to the scheduler to run every few minutes.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const enabled = autoScaleEnabled();
    const dryRun = body.dry_run === true || !enabled;
    const m = (body.metrics || {}) as Partial<ScaleMetrics>;
    const metrics: ScaleMetrics = {
      active_users: Math.max(0, Number(m.active_users) || 0),
      requests_per_min: Math.max(0, Number(m.requests_per_min) || 0),
      queue_depth: Math.max(0, Number(m.queue_depth) || 0),
      render_per_day: Math.max(0, Number(m.render_per_day) || 0),
      db_read_qps: Math.max(0, Number(m.db_read_qps) || 0),
    };

    const levers = scaleLeversFromSettings();
    const all = await effectiveSettings().catch(() => []) as Array<{ key: string; value: string }>;
    const current: Record<string, string> = {};
    for (const l of levers) current[l.key] = String(all.find((s) => s.key === l.key)?.value ?? l.base);

    const decision = decideScale(levers, metrics, current);

    if (!dryRun && decision.changes.length) {
      for (const c of decision.changes) await setSetting(c.key, c.to, `scaleGovernor:${user.email ?? user.id}`).catch(() => null);
      invalidateSettingsCache();
    }

    return Response.json({
      ok: true, enabled, dry_run: dryRun, metrics,
      at_scale: decision.at_scale, scaled_levers: decision.scaled_count,
      changes: decision.changes,
      note: enabled
        ? (decision.changes.length ? "Applied scale changes." : "No change — load is within the current tier's band.")
        : "Auto-scale is OFF — preview only; showing what WOULD flip. Enable AUTO_SCALE_ENABLED to let it switch automatically.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
