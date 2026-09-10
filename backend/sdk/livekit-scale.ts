// livekit-scale.ts — autoscaling for the LIVE-HOSTING media tier (LiveKit SFU + TURN), the mirror of
// infra-scale.ts for a DIFFERENT service and a DIFFERENT load signal.
//
// The app autoscaler (infra-scale.ts) scales stateless WEB replicas by requests/min. Live hosting is a separate
// media tier whose cost is driven by CONCURRENT VIEWERS (egress), so it scales on that signal instead:
//   desired nodes = ceil(concurrent viewers / viewers-per-node), clamped [min, max], stepped per tick.
// Crucially it can scale to ZERO: while nobody is live (and hosting is counsel-gated off, so nobody is), the
// media tier runs 0 nodes = $0. It only spins up when real viewers arrive. Same guard/budget discipline as the
// app scaler: never above the emergency ceiling, budget-derived soft cap, bounded step, safe-until-credentialed.
//
// Providers (a SEPARATE pool from the app — you don't scale web replicas when viewers grow):
//   • "none"    — decide/recommend only (default). Use until you've provisioned a LiveKit node pool.
//   • "webhook" — POST { desired, reason } to LIVEKIT_SCALE_WEBHOOK_URL, a small endpoint you control that adds/
//                 removes SFU (and TURN) nodes on your host (Hetzner/OVH/Vultr/AWS). Provider-agnostic.
//   • "railway" — set the LiveKit service's replica count via the Railway API (LIVEKIT_RAILWAY_SERVICE_ID +
//                 LIVEKIT_RAILWAY_ENVIRONMENT_ID, reusing RAILWAY_TOKEN).

import { snapBool, snapNumber, snapString } from "./settings.ts";

export type LkScaleProvider = "none" | "webhook" | "railway";

// ── Pure: desired node count from concurrent-viewer load (scale-to-zero capable, unit-testable) ────────────
export function computeDesiredNodes(
  viewers: number, current: number,
  opts: { perNode: number; min: number; max: number; maxStep: number },
): { desired: number; reason: string } {
  const per = Math.max(1, Number(opts.perNode) || 1);
  const min = Math.max(0, Math.floor(opts.min) || 0);          // min CAN be 0 → scale to zero when idle
  const max = Math.max(min, Math.floor(opts.max) || min);
  const cur = Math.max(0, Math.floor(current) || 0);
  const v = Math.max(0, Number(viewers) || 0);
  // No viewers → 0 nodes (unless a standing floor is configured). Otherwise ceil to capacity.
  const need = v === 0 ? min : Math.max(Math.max(1, min), Math.min(max, Math.ceil(v / per)));
  const step = Math.max(1, Math.floor(opts.maxStep) || 1);
  let desired = need;
  if (need > cur) desired = Math.min(need, cur + step);
  else if (need < cur) desired = Math.max(need, cur - step);
  desired = Math.max(min, Math.min(max, desired));
  const dir = desired > cur ? "up" : desired < cur ? "down" : "hold";
  return { desired, reason: `viewers=${v} / ${per} per node → need ${need} (${min}–${max}); ${dir} to ${desired} from ${cur}` };
}

// ── Config ────────────────────────────────────────────────────────────────────────────────────────────────
export const lkScaleEnabled = () => snapBool("LIVEKIT_SCALE_ENABLED", true);
export const lkScaleProvider = (): LkScaleProvider => {
  const p = (snapString("LIVEKIT_SCALE_PROVIDER", "none") || "none").trim().toLowerCase();
  return (["none", "webhook", "railway"] as string[]).includes(p) ? (p as LkScaleProvider) : "none";
};
export const lkViewersPerNode = () => Math.max(1, Math.round(snapNumber("LIVEKIT_SCALE_VIEWERS_PER_NODE", 1000)));
export const lkScaleMin = () => Math.max(0, Math.round(snapNumber("LIVEKIT_SCALE_MIN_NODES", 0)));
export const lkScaleHardMax = () => Math.max(lkScaleMin(), Math.round(snapNumber("LIVEKIT_SCALE_MAX_NODES", 20)));
export const lkScaleMaxStep = () => Math.max(1, Math.round(snapNumber("LIVEKIT_SCALE_MAX_STEP", 3)));
export const lkCostPerNode = () => Math.max(1, snapNumber("LIVEKIT_SCALE_COST_PER_NODE_USD_MO", 40));
export const lkMonthlyBudget = () => Math.max(0, snapNumber("LIVEKIT_SCALE_MONTHLY_BUDGET_USD", 0));
export const lkBurstEnabled = () => snapBool("LIVEKIT_SCALE_BURST_ABOVE_BUDGET", true);
/** Node ceiling implied by the monthly budget, or null when no budget is set. */
export const lkBudgetMaxNodes = (): number | null => {
  const b = lkMonthlyBudget();
  if (b <= 0) return null;
  return Math.max(lkScaleMin(), Math.floor(b / lkCostPerNode()));
};
/** NORMAL soft ceiling: budget-disciplined, never above the hard max. */
export const lkScaleSoftMax = () => {
  const hard = lkScaleHardMax();
  const bcap = lkBudgetMaxNodes();
  return Math.max(lkScaleMin(), bcap === null ? hard : Math.min(hard, bcap));
};
/** Burst-aware ceiling for a given viewer load (soft normally; hard max when a surge needs it). Pure. */
export function lkScaleCeilingForLoad(viewers: number): { ceiling: number; softMax: number; hardMax: number; bursting: boolean } {
  const softMax = lkScaleSoftMax();
  const hardMax = lkScaleHardMax();
  const per = lkViewersPerNode();
  const demand = Math.ceil((Math.max(0, Number(viewers) || 0)) / per);
  const bursting = lkBurstEnabled() && demand > softMax && hardMax > softMax;
  return { ceiling: bursting ? hardMax : softMax, softMax, hardMax, bursting };
}

// ── Real action (network, guarded, never throws) ──────────────────────────────────────────────────────────
export interface LkScaleResult { ok: boolean; provider: LkScaleProvider; desired: number; applied: boolean; reason: string; }
export async function scaleLivekit(provider: LkScaleProvider, desired: number, reason: string): Promise<LkScaleResult> {
  try {
    if (provider === "none") return { ok: true, provider, desired, applied: false, reason: "provider 'none' — decision only, no action taken" };

    if (provider === "webhook") {
      const url = (snapString("LIVEKIT_SCALE_WEBHOOK_URL", "") || "").trim();
      if (!url) return { ok: false, provider, desired, applied: false, reason: "LIVEKIT_SCALE_WEBHOOK_URL not set" };
      const secret = (snapString("LIVEKIT_SCALE_WEBHOOK_SECRET", "") || "").trim();
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(secret ? { "Authorization": `Bearer ${secret}` } : {}) },
        body: JSON.stringify({ desired, reason, tier: "livekit-sfu" }),
      }).then((x) => x.ok).catch(() => false);
      return { ok: r, provider, desired, applied: r, reason: r ? "LiveKit scaling webhook called" : "webhook call failed" };
    }

    // railway — set the LiveKit service's replica count via serviceInstanceUpdate. For a single-region service
    // `numReplicas` is correct; for a multi-region service Railway requires the count under `multiRegionConfig`
    // (a bare numReplicas updates the UI but doesn't scale actual instances). Set LIVEKIT_RAILWAY_REGION to the
    // service's region to use the multi-region shape; leave it empty for the single-region default.
    const token = (snapString("RAILWAY_TOKEN", "") || "").trim();
    const serviceId = (snapString("LIVEKIT_RAILWAY_SERVICE_ID", "") || "").trim();
    const envId = (snapString("LIVEKIT_RAILWAY_ENVIRONMENT_ID", "") || "").trim();
    if (!token || !serviceId || !envId) return { ok: false, provider, desired, applied: false, reason: "RAILWAY_TOKEN / LIVEKIT_RAILWAY_SERVICE_ID / LIVEKIT_RAILWAY_ENVIRONMENT_ID not all set" };
    const region = (snapString("LIVEKIT_RAILWAY_REGION", "") || "").trim();
    const input: Record<string, unknown> = region
      ? { multiRegionConfig: { [region]: { numReplicas: desired } } }
      : { numReplicas: desired };
    const query = `mutation($serviceId:String!,$environmentId:String!,$input:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(serviceId:$serviceId, environmentId:$environmentId, input:$input) }`;
    const r = await fetch("https://backboard.railway.app/graphql/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ query, variables: { serviceId, environmentId: envId, input } }),
    }).then((x) => x.json()).catch(() => null) as Record<string, unknown> | null;
    const ok = !!r && !r.errors;
    return { ok, provider, desired, applied: ok, reason: ok ? `Railway LiveKit replicas set to ${desired}${region ? ` in ${region}` : ""}` : "Railway API error (verify ids/scopes/region)" };
  } catch (e) {
    return { ok: false, provider, desired, applied: false, reason: String((e as Error)?.message || e) };
  }
}
