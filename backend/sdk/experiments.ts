// AI change-gating: test every proposed change with customers BEFORE it goes live.
//
// The optimizer never applies a change directly when OPTIMIZER_REQUIRE_EXPERIMENT is on (default).
// Instead each proposal becomes an OptimizationExperiment: the AI writes an A/B mockup describing the
// current (A) vs proposed (B) experience and a short customer survey, the app collects customer
// responses (submitExperimentFeedback), and evaluateExperiments() only applies the change if
// customers favor it. Non-sensitive winners auto-apply within bounds; sensitive/price winners become
// a pending admin recommendation. Losers are archived, never shipped.

import { db } from "./db.ts";
import { getBool, getNumber, getDef, setSetting } from "./settings.ts";
import { Core } from "./integrations.ts";
import { logAiAction } from "./ai-control.ts";

// The AI's OWN review before it promotes a user-approved change site-wide (used when the optional human
// gate is off). It sanity-checks the result and defaults to APPROVE — the statistical bar already passed;
// this just lets the AI hold something that looks unreliable/risky. No LLM key → statistical approval stands.
async function aiReviewPromotion(e: Record<string, unknown>): Promise<{ approve: boolean; reason: string }> {
  const hasLLM = !!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY"));
  if (!hasLLM) return { approve: true, reason: "no LLM — statistical approval stands" };
  try {
    const out = await Core.InvokeLLM({
      prompt:
        `A setting change "${e.key}" from ${e.control_value} to ${e.variant_value} passed user testing ` +
        `(${Math.round((Number(e.favor_pct) || 0) * 100)}% approval across ${e.sample} votes, statistical floor ` +
        `${Math.round((Number(e.wilson_lower) || 0) * 100)}%). Rationale: ${e.rationale}. As a cautious reviewer, ` +
        `should it be promoted site-wide? Approve unless it looks risky, self-contradictory, or the sample seems unreliable.`,
      response_json_schema: { type: "object", properties: { approve: { type: "boolean" }, reason: { type: "string" } }, required: ["approve"] },
    });
    const p = typeof out === "string" ? JSON.parse(out) : out as any;
    return { approve: p?.approve !== false, reason: String(p?.reason || "") };
  } catch { return { approve: true, reason: "review error — statistical approval stands" }; }
}

// Wilson score lower bound (95%) — a change only "goes global" if we're statistically confident the
// true approval rate clears the bar, not just because a small favorable sample got lucky.
export function wilsonLower(pos: number, n: number): number {
  if (n <= 0) return 0;
  const z = 1.96, p = pos / n;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return Math.max(0, (center - margin) / denom);
}

// Daily global-review window: the human check that promotes changes site-wide happens ONCE PER 24h,
// during a 1-hour peak-usage window (configurable). Outside it, eligible changes just wait.
export async function globalReviewWindow(): Promise<{ open: boolean; peak_hour_utc: number; window_hours: number; next_open_iso: string }> {
  const hour = Math.min(23, Math.max(0, await getNumber("PEAK_REVIEW_HOUR_UTC", 18)));
  const win = Math.min(6, Math.max(1, await getNumber("PEAK_REVIEW_WINDOW_HOURS", 1)));
  const now = new Date();
  const h = now.getUTCHours();
  const open = h >= hour && h < hour + win;
  // Next opening (today if still upcoming, else tomorrow).
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
  if (now.getTime() >= next.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return { open, peak_hour_utc: hour, window_hours: win, next_open_iso: next.toISOString() };
}

/** Promote an eligible experiment's change SITE-WIDE (the actual global apply). Admin-gated caller. */
export async function promoteExperimentGlobally(experimentId: string): Promise<boolean> {
  const e = await db.get("OptimizationExperiment", experimentId).catch(() => null) as Record<string, unknown> | null;
  if (!e) return false;
  await applyPassedExperiment(e, Number(e.favor_pct) || 0);
  await db.update("OptimizationExperiment", experimentId, { status: "passed_applied", global_applied_at: new Date().toISOString() }).catch(() => null);
  return true;
}

/** Reject an eligible experiment (do NOT go global). */
export async function rejectEligibleExperiment(experimentId: string): Promise<boolean> {
  const e = await db.get("OptimizationExperiment", experimentId).catch(() => null);
  if (!e) return false;
  await db.update("OptimizationExperiment", experimentId, { status: "rejected_global", rejected_at: new Date().toISOString() }).catch(() => null);
  return true;
}

/** Changes that cleared the individual-approval bar and are waiting for the daily human go/no-go. */
export async function listEligibleForGlobal(): Promise<Record<string, unknown>[]> {
  return await db.filter("OptimizationExperiment", { status: "eligible_for_global" }, "-eligible_at", 100).catch(() => []) as Record<string, unknown>[];
}

const ACTOR = "ai-optimizer";

export async function requireExperiment(): Promise<boolean> {
  return await getBool("OPTIMIZER_REQUIRE_EXPERIMENT", true);
}

/** Build the A/B mockup + customer questions for a proposed change and open a 'testing' experiment. */
export async function createExperimentForProposal(
  p: { key: string; current: number; proposed: number; rationale: string; objective: string },
  snap: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const def = getDef(p.key);
  let mockup = `Option A (current): ${def?.label ?? p.key} = ${p.current}. Option B (proposed): ${p.proposed}. ${p.rationale}`;
  let questions: Array<Record<string, unknown>> = [
    { id: "prefers_variant", text: `Would option B (${p.proposed}) improve your experience versus the current (${p.current})?`, type: "yes_no" },
    { id: "satisfaction", text: "How would this change affect your satisfaction? (1 worse – 5 better)", type: "scale" },
  ];

  if (Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY")) {
    try {
      const out = await Core.InvokeLLM({
        prompt:
          `A play-to-earn app may change "${def?.label ?? p.key}" from ${p.current} to ${p.proposed}. ` +
          `Rationale: ${p.rationale}. Live metrics: ${JSON.stringify(snap)}. Write (1) a one-paragraph A/B mockup ` +
          `contrasting the current experience (A) with the proposed one (B) for a customer test, and (2) three short ` +
          `customer survey questions (each with id, text, and type of scale|yes_no|text) to judge whether customers ` +
          `prefer B and whether it helps or hurts their experience.`,
        response_json_schema: {
          type: "object",
          properties: {
            mockup: { type: "string" },
            questions: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, type: { type: "string" } }, required: ["id", "text", "type"] } },
          },
          required: ["mockup", "questions"],
        },
      }) as any;
      if (out?.mockup) mockup = out.mockup;
      if (Array.isArray(out?.questions) && out.questions.length) questions = out.questions;
    } catch { /* fall back to the template mockup/questions */ }
  }

  return await db.create("OptimizationExperiment", {
    key: p.key, control_value: p.current, variant_value: p.proposed, rationale: p.rationale,
    objective: p.objective, objective_baseline: Number((snap as any)?.[p.objective]) || 0,
    sensitive: !!def?.sensitive, mockup, survey_questions: questions,
    responses: [], response_count: 0, status: "testing", created_at: new Date().toISOString(),
  }, ACTOR) as Record<string, unknown>;
}

/** Apply a passed experiment: non-sensitive → setSetting now (audited, outcome-tracked);
 *  sensitive/price → open a pending admin recommendation. */
async function applyPassedExperiment(e: Record<string, unknown>, favorPct: number) {
  const def = getDef(String(e.key));
  const now = new Date().toISOString();
  if (!def) return;
  if (def.sensitive) {
    await db.create("OptimizationRecommendation", {
      key: e.key, category: def.category, current_value: e.control_value, proposed_value: e.variant_value,
      direction: Number(e.variant_value) > Number(e.control_value) ? "up" : "down", rationale: `${e.rationale} (customer-tested: ${Math.round(favorPct * 100)}% favorable)`,
      confidence: favorPct, objective: e.objective, objective_value: null, sensitive: true,
      evidence: { experiment_id: e.id, favor_pct: favorPct }, status: "pending", created_at: now,
    }, ACTOR).catch(() => null);
    return;
  }
  await setSetting(String(e.key), e.variant_value, ACTOR);
  await db.create("AdminAuditLog", {
    actor_email: ACTOR, action_type: "ai_setting_update_experiment", target: String(e.key),
    details: { from: e.control_value, to: e.variant_value, favor_pct: favorPct, experiment_id: e.id, auto: true }, timestamp: now,
  }, ACTOR).catch(() => null);
  await db.create("OptimizationOutcome", {
    key: e.key, from_value: Number(e.control_value), to_value: Number(e.variant_value), primary_metric: e.objective,
    before_value: Number(e.objective_baseline) || 0, applied_at: now, verdict: "pending", auto: true, experiment_id: e.id,
  }, ACTOR).catch(() => null);
}

/** Evaluate testing experiments with enough customer feedback (or old enough); apply winners. */
export async function evaluateExperiments(minResponses = 5, maxAgeHours = 72): Promise<Array<Record<string, unknown>>> {
  const testing = await db.filter("OptimizationExperiment", { status: "testing" }, "-created_at", 300).catch(() => []);
  // "High degree of statistical approval": require a real sample, a high favorable rate, AND a Wilson
  // lower-bound above 0.5 so a small lucky sample can't promote a change. All admin-tunable.
  const minSample = Math.max(minResponses, await getNumber("CHANGE_GLOBAL_MIN_SAMPLE", 20));
  const minApproval = Math.min(1, Math.max(0.5, await getNumber("CHANGE_GLOBAL_MIN_APPROVAL", 0.7)));
  const humanGate = await getBool("AI_GLOBAL_HUMAN_GATE", true);
  const out: Array<Record<string, unknown>> = [];
  for (const e of testing) {
    const responses: any[] = Array.isArray(e.responses) ? e.responses : [];
    const ageMs = Date.now() - new Date(String(e.created_at)).getTime();
    if (responses.length < minSample && ageMs < maxAgeHours * 3600000) continue;

    const favorable = responses.filter((r) =>
      r?.prefers_variant === true || r?.answer === true || Number(r?.satisfaction) >= 4 || Number(r?.score) >= 4 || r?.sentiment === "positive").length;
    const favorPct = responses.length ? favorable / responses.length : 0;
    const wilson = wilsonLower(favorable, responses.length);
    // Individual-approval bar: enough voters, high yes-rate, and statistically confident (Wilson > 0.5).
    const pass = responses.length >= minSample && favorPct >= minApproval && wilson >= 0.5;

    const now = new Date().toISOString();
    let status: string;
    if (pass && humanGate) {
      // Passed the users' bar → wait for the daily 1-hour human review before going global.
      status = "eligible_for_global";
      await db.update("OptimizationExperiment", String(e.id), {
        status, favor_pct: Math.round(favorPct * 100) / 100, wilson_lower: Math.round(wilson * 100) / 100,
        sample: responses.length, eligible_at: now, evaluated_at: now,
      }).catch(() => null);
      out.push({ key: e.key, status: "eligible_for_global", favor_pct: favorPct, wilson, responses: responses.length });
      continue;
    }
    // Human gate off (default): the AI conducts its OWN review, then promotes if it approves.
    let aiApproved = false, aiReason = "";
    if (pass) {
      const e2 = { ...e, favor_pct: favorPct, wilson_lower: wilson, sample: responses.length };
      const review = await aiReviewPromotion(e2);
      aiApproved = review.approve; aiReason = review.reason;
      if (aiApproved) await applyPassedExperiment(e, favorPct);
      await logAiAction({
        agent: "ai_reviewer", action: "global_review", target: String(e.key), setting_key: String(e.key),
        from: e.control_value, to: e.variant_value, status: aiApproved ? "applied" : "queued",
        summary: aiApproved
          ? `AI reviewed and promoted ${e.key} site-wide (${Math.round(favorPct * 100)}% user approval, ${responses.length} votes)`
          : `AI held ${e.key} from going global — ${aiReason}`,
        detail: { favor_pct: favorPct, wilson, sample: responses.length, reason: aiReason },
      }).catch(() => null);
    }
    status = (pass && aiApproved) ? "passed_applied"
      : (pass && !aiApproved) ? "ai_held"
      : responses.length === 0 ? "expired_no_data"
      : responses.length < minSample ? "inconclusive"
      : "failed";
    await db.update("OptimizationExperiment", String(e.id), {
      status, favor_pct: Math.round(favorPct * 100) / 100, wilson_lower: Math.round(wilson * 100) / 100, sample: responses.length, evaluated_at: now, ai_review_reason: aiReason || null,
    }).catch(() => null);
    out.push({ key: e.key, status: (pass && aiApproved) ? "applied" : "not_applied", favor_pct: favorPct, responses: responses.length });
  }
  return out;
}
