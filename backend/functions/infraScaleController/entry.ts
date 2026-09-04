import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const enabled = snapBool("INFRA_SCALE_ENABLED", false);
    const dryRun = body.dry_run === true || !enabled;
    const provider = infraScaleProvider();

    const load = Math.max(0, Number(body.requests_per_min) || Number(body.load) || 0);
    const current = Math.max(0, Number(body.current_instances) || infraScaleMin());
    // Burst-aware ceiling: budget-disciplined soft max normally, emergency hard max when a real surge needs it.
    const ceil = infraScaleCeilingForLoad(load);
    const decision = computeDesiredInstances(load, current, {
      perInstance: infraScalePerInstance(), min: infraScaleMin(), max: ceil.ceiling, maxStep: infraScaleMaxStep(),
    });
    const bursting = decision.desired > ceil.softMax;

    let action = { ok: true, provider, desired: decision.desired, applied: false, reason: enabled ? "would act" : "gated off — decision only" };
    if (!dryRun && decision.desired !== current) {
      action = await scaleInfra(provider, decision.desired, decision.reason);
    }

    return Response.json({
      ok: true, enabled, dry_run: dryRun, provider,
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
