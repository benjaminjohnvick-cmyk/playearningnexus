import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { verifyJwt } from "../../sdk/auth.ts";
import { snapBool, snapString, setSetting } from "../../sdk/settings.ts";
import {
  computeDesiredNodes, scaleLivekit, lkScaleEnabled, lkScaleProvider,
  lkViewersPerNode, lkScaleMin, lkScaleSoftMax, lkScaleHardMax, lkScaleMaxStep,
  lkScaleCeilingForLoad, lkMonthlyBudget, lkCostPerNode, lkBudgetMaxNodes, lkBurstEnabled,
} from "../../sdk/livekit-scale.ts";
import { hostingFloor } from "../../sdk/cost-floor.ts";

// livekitScaleController — autoscaling for the LIVE-HOSTING media tier (LiveKit SFU + TURN). The app autoscaler
// (infraScaleController) scales web replicas by requests/min; this one scales SFU NODES by CONCURRENT VIEWERS,
// the signal that actually drives live-video egress cost. Each tick it reads live viewers (summed from active
// LiveKit sessions), computes the node count needed at the cost-floor bitrate, and — when enabled + a node pool
// is wired — sets it. It SCALES TO ZERO when nobody is live: while hosting stays counsel-gated off there are no
// sessions, so it holds 0 nodes = $0, and only spins up when real viewers arrive. Hard-capped, budget-disciplined,
// bounded per tick, safe-until-credentialed. Gated by LIVEKIT_SCALE_ENABLED (preview-only while off). Run each
// minute. See LIVEKIT-HOSTING-COST-MODEL.md and COST-FLOOR-AND-LLAMA-ROUTING.md.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Authorize: an admin user OR the scheduler's server-signed service token (same pattern as infraScaleController).
    const user = await base44.auth.me().catch(() => null);
    let authorized = user?.role === "admin";
    if (!authorized && body?.scheduled === true) {
      const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const payload = bearer ? await verifyJwt(bearer).catch(() => null) : null;
      if (payload) authorized = true;
    }
    if (!authorized) return Response.json({ error: "Forbidden (admin or scheduler only)." }, { status: 403 });

    const enabled = lkScaleEnabled();
    const dryRun = body.dry_run === true || !enabled;
    const provider = lkScaleProvider();

    // Load signal = CONCURRENT VIEWERS. Best-first: (1) explicit body.concurrent_viewers, else (2) sum of
    // viewer_tokens across active LiveKit sessions (tracked by sessionLiveKitToken). Zero while hosting is off.
    let viewers = Math.max(0, Number(body.concurrent_viewers) || 0);
    let loadSource = "provided";
    let activeSessions = 0;
    if (viewers === 0 && !(Number(body.concurrent_viewers) === 0 && body.force_zero === true)) {
      const rows = (await base44.asServiceRole.entities.GameSession
        .filter({ status: "active" }).catch(() => [])) as Array<Record<string, unknown>>;
      const live = rows.filter((r) => String(r.transport ?? "") === "livekit");
      activeSessions = live.length;
      viewers = live.reduce((sum, r) => sum + Math.max(0, Number(r.viewer_tokens ?? 0)), 0);
      loadSource = "active-livekit-sessions(sum viewer_tokens)";
    }

    // Current node count from tracked governor state (empty = never run → 0).
    const trackedStr = snapString("LIVEKIT_SCALE_CURRENT_NODES", "");
    const tracked = trackedStr === "" ? 0 : Math.max(0, Math.round(Number(trackedStr) || 0));
    const current = body.current_nodes !== undefined ? Math.max(0, Number(body.current_nodes) || 0) : tracked;

    // Burst-aware ceiling: budget soft cap normally, emergency hard max when a real surge needs it.
    const ceil = lkScaleCeilingForLoad(viewers);
    const decision = computeDesiredNodes(viewers, current, {
      perNode: lkViewersPerNode(), min: lkScaleMin(), max: ceil.ceiling, maxStep: lkScaleMaxStep(),
    });
    const bursting = decision.desired > ceil.softMax;

    let action = { ok: true, provider, desired: decision.desired, applied: false, reason: enabled ? "would act" : "gated off — decision only" };
    const changed = decision.desired !== current;
    if (!dryRun && (changed || body?.scheduled === true)) {
      action = await scaleLivekit(provider, decision.desired, decision.reason);
      if (action.applied && changed) {
        await setSetting("LIVEKIT_SCALE_CURRENT_NODES", String(decision.desired), `livekitScaleGovernor:${user?.email ?? user?.id ?? "scheduler"}`).catch(() => null);
      }
    }

    const floor = hostingFloor();
    const perNode = lkViewersPerNode();
    return Response.json({
      ok: true, enabled, dry_run: dryRun, provider,
      concurrent_viewers: viewers, load_source: loadSource, active_sessions: activeSessions,
      current_nodes: current, desired_nodes: decision.desired,
      decision: decision.reason, action,
      capacity: {
        viewers_per_node: perNode, total_viewer_capacity: decision.desired * perNode,
        floor_bitrate_kbps: floor.maxBitrateKbps, gb_per_viewer_hour: Number(floor.gbPerViewerHour.toFixed(3)),
        per_room_viewer_cap: floor.maxViewersPerRoom,
      },
      bounds: { min: lkScaleMin(), soft_max: ceil.softMax, hard_max: ceil.hardMax, max_step: lkScaleMaxStep() },
      burst: {
        enabled: lkBurstEnabled(), bursting,
        note: bursting
          ? `Viewers exceed the ${ceil.softMax}-node soft cap — auto-bursting toward the ${ceil.hardMax}-node ceiling to stay up; falls back once viewers subside.`
          : lkBurstEnabled()
            ? "Within budget. Would auto-burst above the soft cap (up to the emergency ceiling) if a viewer surge required it."
            : "Auto-burst OFF — hard-freezes at the budget soft cap even under a spike.",
      },
      budget: {
        monthly_usd: lkMonthlyBudget(), cost_per_node_usd_mo: lkCostPerNode(),
        budget_max_nodes: lkBudgetMaxNodes(),
        est_monthly_usd: decision.desired * lkCostPerNode(),
        est_soft_cap_monthly_usd: ceil.softMax * lkCostPerNode(),
        note: viewers === 0
          ? "No live viewers → 0 nodes → $0. The media tier costs nothing until someone is actually live."
          : "Node cost = desired nodes × cost/node. Scales to zero when live viewers drop to zero.",
      },
      note: enabled
        ? "Live-hosting media tier scales on concurrent viewers (0 when idle). Provider 'none' decides only; set LIVEKIT_SCALE_PROVIDER + a node-pool webhook/Railway service to let it act."
        : "LiveKit autoscaling is OFF — preview only. Enable LIVEKIT_SCALE_ENABLED and wire a provider to let it act.",
      reminder: "Live hosting itself stays counsel-gated (SESSION_HOSTING_ENABLED off). This scaler only sizes the media tier for whatever live load exists — which is zero until hosting is cleared and turned on.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
