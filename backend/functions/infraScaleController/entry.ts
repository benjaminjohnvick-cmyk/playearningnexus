import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";
import {
  computeDesiredInstances, scaleInfra, infraScaleProvider,
  infraScaleMin, infraScaleMax, infraScalePerInstance, infraScaleMaxStep,
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
    const decision = computeDesiredInstances(load, current, {
      perInstance: infraScalePerInstance(), min: infraScaleMin(), max: infraScaleMax(), maxStep: infraScaleMaxStep(),
    });

    let action = { ok: true, provider, desired: decision.desired, applied: false, reason: enabled ? "would act" : "gated off — decision only" };
    if (!dryRun && decision.desired !== current) {
      action = await scaleInfra(provider, decision.desired, decision.reason);
    }

    return Response.json({
      ok: true, enabled, dry_run: dryRun, provider,
      current_instances: current, desired_instances: decision.desired,
      decision: decision.reason, action,
      bounds: { min: infraScaleMin(), max: infraScaleMax(), per_instance_rpm: infraScalePerInstance(), max_step: infraScaleMaxStep() },
      note: enabled
        ? "Scales capacity via your cloud API (same code, more instances) — capped, never rewrites code."
        : "Infra auto-scale is OFF — preview only. Set INFRA_SCALE_PROVIDER + credentials and enable INFRA_SCALE_ENABLED to let it act.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
