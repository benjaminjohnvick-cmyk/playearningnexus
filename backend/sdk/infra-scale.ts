// infra-scale.ts — the ACTING scaling adapter. This is what lets a Claude-based agent AUTONOMOUSLY scale the
// platform without rewriting a line of code: it adds/removes running instances (capacity) by calling your
// cloud's own scaling API. Scaling = more copies of the SAME stateless code, which is the correct and safe way
// (see AI-SCALING-AGENT.md). Fully GUARDED + CAPPED: does nothing without a provider + credentials, never goes
// below min or above max instances, and every action is bounded so it can't runaway-provision.
//
// Providers:
//   • "none"     — decide/recommend only, take no action (default).
//   • "webhook"  — POST { desired, reason } to INFRA_SCALE_WEBHOOK_URL, a small endpoint you control (a Lambda /
//                  Cloud Function) that calls your platform's scaling API. Provider-agnostic; works with any host.
//   • "railway"  — Railway GraphQL API: set the service's replica count directly (RAILWAY_TOKEN, service/env ids).
//   (AWS ECS/Fargate: use the "webhook" provider pointing at a tiny Lambda that calls UpdateService — SigV4 from
//    here is avoidable and the webhook keeps your AWS creds server-side, which is safer.)

import { snapBool, snapNumber, snapString } from "./settings.ts";

export type InfraProvider = "none" | "webhook" | "railway";

// ── Pure: decide the target instance count from load (unit-tested) ──────────────────────────────────────
/** desired = ceil(load / per-instance capacity), clamped to [min, max]. A step limit avoids giant jumps.
 *  Pure + deterministic. `load` is typically requests/min; `perInstance` its capacity per instance. */
export function computeDesiredInstances(
  load: number, current: number,
  opts: { perInstance: number; min: number; max: number; maxStep: number },
): { desired: number; reason: string } {
  const per = Math.max(1, Number(opts.perInstance) || 1);
  const min = Math.max(1, Math.floor(opts.min) || 1);
  const max = Math.max(min, Math.floor(opts.max) || min);
  const cur = Math.max(0, Math.floor(current) || 0);
  const need = Math.max(min, Math.min(max, Math.ceil((Math.max(0, Number(load) || 0)) / per)));
  // Limit how far we move in one tick (avoid thundering scale-ups/downs).
  const step = Math.max(1, Math.floor(opts.maxStep) || 1);
  let desired = need;
  if (need > cur) desired = Math.min(need, cur + step);
  else if (need < cur) desired = Math.max(need, cur - step);
  desired = Math.max(min, Math.min(max, desired));
  const dir = desired > cur ? "up" : desired < cur ? "down" : "hold";
  return { desired, reason: `load=${load} / ${per} per instance → need ${need} (${min}–${max}); ${dir} to ${desired} from ${cur}` };
}

// ── Config ──────────────────────────────────────────────────────────────────────────────────────────────
export const infraScaleProvider = (): InfraProvider => {
  const p = (snapString("INFRA_SCALE_PROVIDER", "none") || "none").trim().toLowerCase();
  return (["none", "webhook", "railway"] as string[]).includes(p) ? (p as InfraProvider) : "none";
};
export const infraScaleMin = () => Math.max(1, Math.round(snapNumber("INFRA_SCALE_MIN_INSTANCES", 1)));

// ── Cost discipline: a monthly dollar budget derives the NORMAL soft ceiling; an absolute hard ceiling is the
//    burst/runaway guard. ───────────────────────────────────────────────────────────────────────────────────
// Two ceilings:
//   • softMax  = the budget-disciplined normal ceiling = min(configured max, floor(budget / cost/instance)).
//                This is what keeps steady-state cost provably under the year-one $3,000 target.
//   • hardMax  = INFRA_SCALE_MAX_INSTANCES, the ABSOLUTE emergency ceiling and runaway guard. The governor
//                never exceeds this, budget or not.
// When INFRA_SCALE_BURST_ABOVE_BUDGET is ON and live load genuinely needs more than softMax, the governor may
// AUTOMATICALLY burst up to hardMax to keep the app up — then hysteresis scales it back down to softMax once
// load subsides, so the over-budget spend is only for the minutes the surge actually lasts.
export const infraScaleCostPerInstance = () => Math.max(1, snapNumber("INFRA_SCALE_COST_PER_INSTANCE_USD_MO", 12));
export const infraScaleMonthlyBudget = () => Math.max(0, snapNumber("INFRA_SCALE_MONTHLY_BUDGET_USD", 0));
export const infraScaleBurstEnabled = () => snapBool("INFRA_SCALE_BURST_ABOVE_BUDGET", true);
/** The absolute emergency ceiling / runaway guard — configured max-instances, independent of the budget. */
export const infraScaleHardMax = () => Math.max(infraScaleMin(), Math.round(snapNumber("INFRA_SCALE_MAX_INSTANCES", 8)));
/** Instance ceiling implied by the monthly dollar budget, or null when no budget is set. */
export const infraScaleBudgetMaxInstances = (): number | null => {
  const budget = infraScaleMonthlyBudget();
  if (budget <= 0) return null;
  return Math.max(infraScaleMin(), Math.floor(budget / infraScaleCostPerInstance()));
};
/** NORMAL soft ceiling: budget-disciplined, never above the hard max. */
export const infraScaleMax = () => {
  const hard = infraScaleHardMax();
  const budgetCap = infraScaleBudgetMaxInstances();
  const soft = budgetCap === null ? hard : Math.min(hard, budgetCap);
  return Math.max(infraScaleMin(), soft);
};
/** The ceiling to use for a given live load: soft normally, but hardMax when burst is on and demand exceeds
 *  soft (so a real surge can auto-scale past budget up to the emergency ceiling). Pure/deterministic. */
export function infraScaleCeilingForLoad(load: number): {
  ceiling: number; softMax: number; hardMax: number; bursting: boolean;
} {
  const softMax = infraScaleMax();
  const hardMax = infraScaleHardMax();
  const per = infraScalePerInstance();
  const demand = Math.max(infraScaleMin(), Math.ceil((Math.max(0, Number(load) || 0)) / per));
  const bursting = infraScaleBurstEnabled() && demand > softMax && hardMax > softMax;
  return { ceiling: bursting ? hardMax : softMax, softMax, hardMax, bursting };
}
export const infraScalePerInstance = () => Math.max(1, snapNumber("INFRA_SCALE_RPM_PER_INSTANCE", 600));
export const infraScaleMaxStep = () => Math.max(1, Math.round(snapNumber("INFRA_SCALE_MAX_STEP", 2)));

// ── Real action (network, guarded, never throws) ────────────────────────────────────────────────────────
export interface ScaleActionResult { ok: boolean; provider: InfraProvider; desired: number; applied: boolean; reason: string; }
export async function scaleInfra(provider: InfraProvider, desired: number, reason: string): Promise<ScaleActionResult> {
  try {
    if (provider === "none") return { ok: true, provider, desired, applied: false, reason: "provider 'none' — decision only, no action taken" };

    if (provider === "webhook") {
      const url = (snapString("INFRA_SCALE_WEBHOOK_URL", "") || "").trim();
      if (!url) return { ok: false, provider, desired, applied: false, reason: "INFRA_SCALE_WEBHOOK_URL not set" };
      const secret = (snapString("INFRA_SCALE_WEBHOOK_SECRET", "") || "").trim();
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(secret ? { "Authorization": `Bearer ${secret}` } : {}) },
        body: JSON.stringify({ desired, reason }),
      }).then((x) => x.ok).catch(() => false);
      return { ok: r, provider, desired, applied: r, reason: r ? "scaling webhook called" : "webhook call failed" };
    }

    // railway — set replica count via the public GraphQL API.
    const token = (snapString("RAILWAY_TOKEN", "") || "").trim();
    const serviceId = (snapString("RAILWAY_SERVICE_ID", "") || "").trim();
    const envId = (snapString("RAILWAY_ENVIRONMENT_ID", "") || "").trim();
    if (!token || !serviceId || !envId) return { ok: false, provider, desired, applied: false, reason: "RAILWAY_TOKEN / RAILWAY_SERVICE_ID / RAILWAY_ENVIRONMENT_ID not all set" };
    const query = `mutation($serviceId:String!,$environmentId:String!,$replicas:Int!){ serviceInstanceUpdate(serviceId:$serviceId, environmentId:$environmentId, input:{ numReplicas:$replicas }) }`;
    const r = await fetch("https://backboard.railway.app/graphql/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ query, variables: { serviceId, environmentId: envId, replicas: desired } }),
    }).then((x) => x.json()).catch(() => null) as Record<string, unknown> | null;
    const ok = !!r && !r.errors;
    return { ok, provider, desired, applied: ok, reason: ok ? `Railway replicas set to ${desired}` : "Railway API error (verify ids/scopes)" };
  } catch (e) {
    return { ok: false, provider, desired, applied: false, reason: String((e as Error)?.message || e) };
  }
}
