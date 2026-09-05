// pmf-agent.ts — the AI PMF & REVENUE agent.
//
// Closes the learning loop the owner asked for: an AI agent that COLLECTS all the feature/site signals, RANKS
// the feature portfolio for product-market fit (retention-weighted) AND increased revenue, produces an action
// plan, and LEARNS from it over time — while KEEPING EVERY CONSTRAINT already in place:
//   • It writes signals + learning + an advisory plan; it does NOT silently change money, pricing, tiers,
//     identity, or legal settings. Anything with a revenue/price/compliance effect is surfaced as a
//     recommendation for human approval — the same human gate the platform already enforces (Autonomy Kernel
//     permanent gates, optimizer's price/sensitive → admin-approval path). Nothing here books money or touches
//     the closed loop. No ROI/return claims.
//   • Its signals land in the SAME stores the rest of the AI layer uses (OptimizationSignal trend history,
//     AgentLearningMemory per-agent lessons), so it shows up in the existing learning dashboards and compounds
//     with the platform's other self-learning.
// It runs continuously (scheduler), so PMF + revenue discovery keeps improving after launch.
import { db } from "./db.ts";
import { snapBool, snapNumber } from "./settings.ts";
import { buildFeaturePmfScoreboard, type FeatureScore } from "./feature-pmf.ts";

export const pmfAgentEnabled = () => snapBool("PMF_AGENT_ENABLED", true);
/** Surface pricing/revenue moves as human-approval recommendations (never auto-applied). */
export const pmfAgentRecommendPricing = () => snapBool("PMF_AGENT_RECOMMEND_PRICING", true);
export const pmfAgentStrongScore = () => snapNumber("PMF_AGENT_STRONG_SCORE", 66);
export const pmfAgentWeakScore = () => snapNumber("PMF_AGENT_WEAK_SCORE", 40);
export const pmfAgentMinSample = () => Math.max(1, snapNumber("PMF_AGENT_MIN_SAMPLE", 15));

export const PMF_AGENT = "pmf_revenue_agent";
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type FeatureAction = "promote" | "hold" | "watch" | "fix" | "sunset";
export type PricingHint = "raise" | "hold" | "lower" | "none";

export interface FeaturePlanItem {
  key: string; name: string; tier: number;
  pmf_score: number; retention_lift: number; revenue_usd: number; adopters: number; live: boolean;
  action: FeatureAction; pricing_hint: PricingHint; sensitive: boolean; rationale: string;
}

/** Decide the portfolio action + (advisory) pricing direction for a feature from its PMF + revenue. Pure and
 *  deterministic. Pricing hints are ADVISORY ONLY — execution stays human-gated (see the module header). */
export function decideAction(f: FeatureScore, medianRevenue: number): FeaturePlanItem {
  const base = {
    key: f.key, name: f.name, tier: f.tier, pmf_score: f.pmf_score, retention_lift: f.retention_lift,
    revenue_usd: round2(f.revenue_usd), adopters: f.adopters, live: f.live,
  };
  const strong = pmfAgentStrongScore(), weak = pmfAgentWeakScore(), minSample = pmfAgentMinSample();

  if (!f.live) {
    return { ...base, action: "watch", pricing_hint: "none", sensitive: false,
      rationale: "Included in its tier but not yet live (gated/counsel) — activates when its prerequisite lands; no PMF read yet." };
  }
  if (f.adopters < minSample) {
    return { ...base, action: "watch", pricing_hint: "none", sensitive: false,
      rationale: `Too few adopters (${f.adopters} < ${minSample}) to judge fit — keep gathering signal before acting.` };
  }
  if (f.pmf_score >= strong) {
    const raise = f.revenue_usd >= medianRevenue;
    return { ...base, action: "promote", pricing_hint: raise ? "raise" : "hold", sensitive: raise,
      rationale: raise
        ? `Strong fit (PMF ${f.pmf_score}, retention ${f.retention_lift >= 0 ? "+" : ""}${(f.retention_lift * 100).toFixed(0)}%) with above-median revenue — promote it and consider capturing more value (pricing change → your approval).`
        : `Strong fit (PMF ${f.pmf_score}) but revenue below median — promote/surface it more to grow adoption before pricing.` };
  }
  if (f.pmf_score >= weak) {
    return { ...base, action: "hold", pricing_hint: "hold", sensitive: false,
      rationale: `Moderate fit (PMF ${f.pmf_score}) — hold and watch retention; not yet a promote or a cut.` };
  }
  // Weak PMF and enough data to act.
  if (f.retention_lift < -0.05) {
    return { ...base, action: "sunset", pricing_hint: "none", sensitive: true,
      rationale: `Weak fit (PMF ${f.pmf_score}) with negative retention — adopters churn faster than baseline. Candidate to rework or retire (a tier/offer change → your approval).` };
  }
  return { ...base, action: "fix", pricing_hint: "lower", sensitive: true,
    rationale: `Weak fit (PMF ${f.pmf_score}) but not actively harmful — improve the feature or lower its barrier/bundle it to drive adoption (any pricing/bundle change → your approval).` };
}

export interface PmfAgentPlan {
  computed_at: string;
  window_days: number;
  plan: FeaturePlanItem[];
  summary: { promote: number; hold: number; watch: number; fix: number; sunset: number; total_revenue_usd: number; pending_approvals: number };
  by_tier_revenue: Array<{ tier: number; tier_revenue_usd: number; top_by_revenue: Array<{ key: string; name: string; revenue_usd: number }> }>;
}

function median(nums: number[]): number {
  const a = [...nums].filter((n) => n > 0).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Run one pass: collect signals, plan, learn, persist. Returns the plan. Best-effort persistence. */
export async function runPmfRevenuePass(): Promise<PmfAgentPlan> {
  const board = await buildFeaturePmfScoreboard();
  const feats = board.features;
  const medRev = median(feats.map((f) => f.revenue_usd));
  const plan = feats.map((f) => decideAction(f, medRev));
  const now = new Date().toISOString();

  // COLLECT: push PMF + revenue into the shared trend store, so the whole AI layer sees them.
  for (const f of feats) {
    await db.create("OptimizationSignal", { metric: `pmf_score:${f.key}`, value: f.pmf_score, window_days: board.window_days, collected_at: now }, PMF_AGENT).catch(() => null);
    await db.create("OptimizationSignal", { metric: `feature_revenue:${f.key}`, value: f.revenue_usd, window_days: board.window_days, collected_at: now }, PMF_AGENT).catch(() => null);
  }

  // LEARN: durable per-agent lessons for the notable moves (shows in learningInsights / learningDistill).
  for (const p of plan) {
    if (p.action === "watch" || p.action === "hold") continue;
    await db.create("AgentLearningMemory", {
      agent_name: PMF_AGENT, type: "pmf_plan", target: p.key,
      success: p.action === "promote", provisional: true,
      improvement_notes: p.rationale, action: p.action, pmf_score: p.pmf_score,
      revenue_usd: p.revenue_usd, recorded_at: now, created_at: now,
    }).catch(() => null);
  }

  const summary = {
    promote: plan.filter((p) => p.action === "promote").length,
    hold: plan.filter((p) => p.action === "hold").length,
    watch: plan.filter((p) => p.action === "watch").length,
    fix: plan.filter((p) => p.action === "fix").length,
    sunset: plan.filter((p) => p.action === "sunset").length,
    total_revenue_usd: round2(feats.reduce((s, f) => s + f.revenue_usd, 0)),
    pending_approvals: plan.filter((p) => p.sensitive).length,
  };

  const result: PmfAgentPlan = {
    computed_at: now, window_days: board.window_days, plan, summary,
    by_tier_revenue: board.by_tier.map((t) => ({ tier: t.tier, tier_revenue_usd: t.tier_revenue_usd, top_by_revenue: t.top_by_revenue.slice(0, 5) })),
  };

  // PERSIST the advisory plan (the admin's to act on — human-gated, per the constraints).
  await db.create("PmfAgentPlan", { ...result, at: now }).catch(() => null);
  return result;
}
