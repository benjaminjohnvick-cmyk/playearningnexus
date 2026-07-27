// AI change-gating: test every proposed change with customers BEFORE it goes live.
//
// The optimizer never applies a change directly when OPTIMIZER_REQUIRE_EXPERIMENT is on (default).
// Instead each proposal becomes an OptimizationExperiment: the AI writes an A/B mockup describing the
// current (A) vs proposed (B) experience and a short customer survey, the app collects customer
// responses (submitExperimentFeedback), and evaluateExperiments() only applies the change if
// customers favor it. Non-sensitive winners auto-apply within bounds; sensitive/price winners become
// a pending admin recommendation. Losers are archived, never shipped.

import { db } from "./db.ts";
import { getBool, getDef, setSetting } from "./settings.ts";
import { Core } from "./integrations.ts";

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
    objective: p.objective, sensitive: !!def?.sensitive, mockup, survey_questions: questions,
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
    before_value: 0, applied_at: now, verdict: "pending", auto: true, experiment_id: e.id,
  }, ACTOR).catch(() => null);
}

/** Evaluate testing experiments with enough customer feedback (or old enough); apply winners. */
export async function evaluateExperiments(minResponses = 5, maxAgeHours = 72): Promise<Array<Record<string, unknown>>> {
  const testing = await db.filter("OptimizationExperiment", { status: "testing" }, "-created_at", 300).catch(() => []);
  const out: Array<Record<string, unknown>> = [];
  for (const e of testing) {
    const responses: any[] = Array.isArray(e.responses) ? e.responses : [];
    const ageMs = Date.now() - new Date(String(e.created_at)).getTime();
    if (responses.length < minResponses && ageMs < maxAgeHours * 3600000) continue;

    const favorable = responses.filter((r) =>
      r?.prefers_variant === true || r?.answer === true || Number(r?.satisfaction) >= 4 || Number(r?.score) >= 4 || r?.sentiment === "positive").length;
    const favorPct = responses.length ? favorable / responses.length : 0;
    // Require enough responses for a decision — never ship a change on a sample of one just because
    // the experiment aged out. Too few responses at timeout → treated as inconclusive (not applied).
    const pass = responses.length >= minResponses && favorPct >= 0.5;

    if (pass) await applyPassedExperiment(e, favorPct);
    const status = pass ? "passed_applied"
      : responses.length === 0 ? "expired_no_data"
      : responses.length < minResponses ? "inconclusive"
      : "failed";
    await db.update("OptimizationExperiment", String(e.id), {
      status, favor_pct: Math.round(favorPct * 100) / 100, evaluated_at: new Date().toISOString(),
    }).catch(() => null);
    out.push({ key: e.key, status: pass ? "applied" : "not_applied", favor_pct: favorPct, responses: responses.length });
  }
  return out;
}
