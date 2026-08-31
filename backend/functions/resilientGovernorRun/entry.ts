import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber, snapString, setSetting, invalidateSettingsCache } from "../../sdk/settings.ts";
import { resilientAutoDecide, type ResilientState, type ResilientThresholds } from "../../sdk/scale-governor.ts";

// resilientGovernorRun — the scaling-helper AI's monitor for on-device fallback. On a schedule (every minute) it
// reads current load, decides the resilient state with hysteresis, and writes RESILIENT_AUTO_STATE — which
// systemLoadSignal serves to clients, so users are automatically switched to on-device mode BEFORE the server
// tips over, and switched back when load subsides. This is the PROACTIVE layer; the client's own timeout/offline
// detection (resilient-mode.js) is the reactive safety net that also protects users even without a perfect
// metric. Gated by RESILIENT_MODE_ENABLED (forces 'normal' while off). Admin / seed-admin.
//
// Load input, best-first: (1) `metrics.requests_per_min` in the body (from an uptime/health monitor), else
// (2) a proxy from recent activity volume (InteractionEvent count in the last minute), else 0.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const enabled = snapBool("RESILIENT_MODE_ENABLED", false);

    // 1) load signal
    let loadRpm = Math.max(0, Number(body?.metrics?.requests_per_min) || Number(body?.requests_per_min) || 0);
    let source = "provided";
    if (loadRpm === 0) {
      const sinceISO = new Date(Date.now() - 60000).toISOString();
      const recent = await db.count("InteractionEvent", { created_date: { $gte: sinceISO } }).catch(() => 0);
      loadRpm = Number(recent) || 0; source = "activity-proxy(InteractionEvent/min)";
    }

    const t: ResilientThresholds = {
      degradeUp: Math.max(1, snapNumber("RESILIENT_DEGRADE_RPM", 800)),
      overloadUp: Math.max(1, snapNumber("RESILIENT_OVERLOAD_RPM", 1500)),
      degradeDown: Math.max(0, snapNumber("RESILIENT_DEGRADE_DOWN_RPM", 500)),
      overloadDown: Math.max(0, snapNumber("RESILIENT_OVERLOAD_DOWN_RPM", 1000)),
    };
    const current = ((snapString("RESILIENT_AUTO_STATE", "normal") || "normal").trim() as ResilientState);
    const decided: ResilientState = enabled ? resilientAutoDecide(loadRpm, current, t) : "normal";

    let changed = false;
    if (decided !== current) {
      if (body.dry_run !== true) { await setSetting("RESILIENT_AUTO_STATE", decided, `resilientGovernor:${user.email ?? user.id}`).catch(() => null); invalidateSettingsCache(); }
      changed = true;
    }

    return Response.json({
      ok: true, enabled, load_rpm: loadRpm, source,
      previous_state: current, state: decided, changed, thresholds: t,
      note: !enabled ? "Resilient mode OFF — state forced 'normal'; enable RESILIENT_MODE_ENABLED to let it switch users to on-device automatically."
        : changed ? `Auto-switched users to '${decided}' at ${loadRpm} req/min.`
        : `Holding '${decided}' (load ${loadRpm} req/min within the band).`,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
