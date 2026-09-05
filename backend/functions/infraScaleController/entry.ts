import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { verifyJwt } from "../../sdk/auth.ts";
import { snapBool, snapString, setSetting } from "../../sdk/settings.ts";
import {
  computeDesiredInstances, scaleInfra, infraScaleProvider,
  infraScaleMin, infraScaleMax, infraScalePerInstance, infraScaleMaxStep,
  infraScaleMonthlyBudget, infraScaleCostPerInstance, infraScaleBudgetMaxInstances,
  infraScaleHardMax, infraScaleBurstEnabled, infraScaleCeilingForLoad,
} from "../../sdk/infra-scale.ts";

// infraScaleController — the ACTING, in-platform, Claude-based scaling agent. Each tick it takes the live load,
// computes how many instances the platform should be running, and — when enabled — calls your cloud's scaling
// API (webhook→Lambda, or Railway) to set that instance count. It scales CAPACITY (more copies of the same
// stateless code), never rewrites code and never touches production source. Hard-capped: never below MIN, never
// above MAX, and only steps a bounded amount per tick, so it cannot runaway-provision or runaway-spend. Gated by
// INFRA_SCALE_ENABLED — preview-only (decides, does not act) while off. Wire to a monitor/scheduler every minute.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Authorize: an admin user (admin panel), OR the scheduler's server-signed service token.
    // NB: base44.auth.me() THROWS "Unauthorized" (not returns null) when the token's user row is absent —
    // which is exactly the case for the scheduler's seed-admin service user when that row isn't seeded — so
    // we catch it instead of letting it 500. A valid server-signed JWT is proof of an internal/scheduler
    // caller (only the backend holds the signing secret), so we accept that alongside the scheduled marker.
    const user = await base44.auth.me().catch(() => null);
    let authorized = user?.role === "admin";
    if (!authorized && body?.scheduled === true) {
      const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const payload = bearer ? await verifyJwt(bearer).catch(() => null) : null;
      if (payload) authorized = true;
    }
    if (!authorized) return Response.json({ error: "Forbidden (admin or scheduler only)." }, { status: 403 });

    const enabled = snapBool("INFRA_SCALE_ENABLED", false);
    const dryRun = body.dry_run === true || !enabled;
    const provider = infraScaleProvider();

    // Load signal, best-first (mirrors resilientGovernorRun so the scheduler needn't pass metrics):
    // (1) explicit body.requests_per_min/load, else (2) a proxy from recent activity volume
    // (InteractionEvent count in the last minute), else 0.
    let load = Math.max(0, Number(body.requests_per_min) || Number(body.load) || 0);
    let loadSource = "provided";
    if (load === 0) {
      const sinceISO = new Date(Date.now() - 60000).toISOString();
      const recent = await db.count("InteractionEvent", { created_date: { $gte: sinceISO } }).catch(() => 0);
      load = Number(recent) || 0; loadSource = "activity-proxy(InteractionEvent/min)";
    }

    // Current instance count, best-first: (1) explicit body.current_instances, else (2) the count the governor
    // last applied (tracked in INFRA_SCALE_CURRENT_INSTANCES), else (3) 0 = "never run" so the first tick
    // reconciles the host up to the minimum. Tracking makes step-limiting and up/down decisions correct across
    // stateless scheduled runs without querying the host each tick.
    const trackedStr = snapString("INFRA_SCALE_CURRENT_INSTANCES", "");
    const tracked = trackedStr === "" ? 0 : Math.max(0, Math.round(Number(trackedStr) || 0));
    const current = body.current_instances !== undefined ? Math.max(0, Number(body.current_instances) || 0) : tracked;

    // Burst-aware ceiling: budget-disciplined soft max normally, emergency hard max when a real surge needs it.
    const ceil = infraScaleCeilingForLoad(load);
    const decision = computeDesiredInstances(load, current, {
      perInstance: infraScalePerInstance(), min: infraScaleMin(), max: ceil.ceiling, maxStep: infraScaleMaxStep(),
    });
    const bursting = decision.desired > ceil.softMax;

    let action = { ok: true, provider, desired: decision.desired, applied: false, reason: enabled ? "would act" : "gated off — decision only" };
    if (!dryRun && decision.desired !== current) {
      action = await scaleInfra(provider, decision.desired, decision.reason);
      // Persist the applied count as the new 'current' so the next tick decides from reality, not an assumption.
      if (action.applied) await setSetting("INFRA_SCALE_CURRENT_INSTANCES", String(decision.desired), `infraScaleGovernor:${user.email ?? user.id}`).catch(() => null);
    }

    return Response.json({
      ok: true, enabled, dry_run: dryRun, provider,
      load_rpm: load, load_source: loadSource,
      current_instances: current, desired_instances: decision.desired,
      decision: decision.reason, action,
      bounds: {
        min: infraScaleMin(), soft_max: ceil.softMax, hard_max: ceil.hardMax,
        per_instance_rpm: infraScalePerInstance(), max_step: infraScaleMaxStep(),
      },
      burst: {
        enabled: infraScaleBurstEnabled(), bursting,
        note: bursting
          ? `Load exceeds the budgeted ${ceil.softMax}-replica soft cap — auto-bursting toward the ${ceil.hardMax}-replica emergency ceiling to stay up; will fall back once load subsides.`
          : infraScaleBurstEnabled()
            ? "Within budget. Would auto-burst above the soft cap (up to the emergency ceiling) if a surge required it."
            : "Auto-burst OFF — the governor hard-freezes at the budget soft cap even under a spike.",
      },
      budget: {
        monthly_usd: infraScaleMonthlyBudget(), cost_per_instance_usd_mo: infraScaleCostPerInstance(),
        budget_max_instances: infraScaleBudgetMaxInstances(),
        est_normal_monthly_usd: ceil.softMax * infraScaleCostPerInstance(),
        est_normal_yearly_usd: ceil.softMax * infraScaleCostPerInstance() * 12,
        est_burst_ceiling_monthly_usd: ceil.hardMax * infraScaleCostPerInstance(),
        note: infraScaleMonthlyBudget() > 0
          ? "Soft max = min(emergency ceiling, floor(budget / cost/instance)). Steady-state cost tracks the soft cap; burst spend applies only for the minutes a surge lasts."
          : "No dollar cap set — INFRA_SCALE_MAX_INSTANCES alone bounds cost.",
      },
      note: enabled
        ? "Scales capacity via your cloud API (same code, more instances) — capped, never rewrites code."
        : "Infra auto-scale is OFF — preview only. Set INFRA_SCALE_PROVIDER + credentials and enable INFRA_SCALE_ENABLED to let it act.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
