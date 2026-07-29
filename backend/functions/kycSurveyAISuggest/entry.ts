import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getActiveSurvey, validateSurvey, saveProposal, saveActiveSurvey } from "../../sdk/kyc.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { aiPaused, logAiAction } from "../../sdk/ai-control.ts";
import { db } from "../../sdk/db.ts";
import { Core } from "../../sdk/integrations.ts";

// kycSurveyAISuggest (ADMIN) — the AI proposes an IMPROVED KYC survey, grounded in the real distribution
// of past answers (which questions actually discriminate, which options nobody picks, gaps to fill for
// better personalization). By default the proposal is STAGED for a human to approve (kycSurveyProposalDecide);
// if the `kyc_survey_ai_autopublish` flag is ON (and the global AI kill switch is off), it's applied
// live immediately. Under the all-AI-on posture that flag ships ON, so AI edits publish live and appear
// in the AI Live Oversight feed; set it OFF to require the admin to approve each proposal instead.
//   Body: { guidance? }   // optional admin steer, e.g. "add a question about budget sensitivity"
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const hasLLM = !!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY"));
    if (!hasLLM) return Response.json({ error: "No AI key configured — can't generate a suggestion." }, { status: 503 });

    const { guidance } = await req.json().catch(() => ({}));
    const current = await getActiveSurvey();

    // Aggregate answer distribution from recent responses so the AI tunes to real behavior.
    const responses = await db.filter("KYCResponse", {}, "-created_date", 500).catch(() => []) as any[];
    const dist: Record<string, Record<string, number>> = {};
    let n = 0;
    for (const r of responses) {
      const a = r?.answers; if (!a || typeof a !== "object") continue; n++;
      for (const [qid, val] of Object.entries(a)) {
        dist[qid] = dist[qid] || {};
        const vals = Array.isArray(val) ? val : [val];
        for (const v of vals) { const key = String(v).slice(0, 60); if (!key) continue; dist[qid][key] = (dist[qid][key] || 0) + 1; }
      }
    }

    const out = await Core.InvokeLLM({
      prompt:
        `You improve the onboarding "Know Your Customer" personalization survey for GamerGain (a play-to-earn ` +
        `store + games platform, 18+). GOAL: capture what best personalizes each member's catalog, deals, and ` +
        `recommendations. Keep it SHORT (6-10 questions), warm, and easy. Options for single/multi questions ` +
        `should map to real shopping/gaming interests. Keep stable question ids where the meaning is unchanged; ` +
        `use new snake_case ids for new questions. Do NOT ask for sensitive identity/financial/compliance data — ` +
        `this is preference personalization, not identity KYC.\n\n` +
        `CURRENT survey:\n${JSON.stringify(current)}\n\n` +
        `Answer distribution across ${n} recent responses (spot dead options / weak questions):\n${JSON.stringify(dist).slice(0, 4000)}\n\n` +
        `${guidance ? "Admin guidance: " + String(guidance).slice(0, 500) + "\n\n" : ""}` +
        `Return an improved survey and a short rationale of what you changed and why.`,
      response_json_schema: {
        type: "object",
        properties: {
          survey: {
            type: "object",
            properties: {
              title: { type: "string" }, description: { type: "string" },
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" }, text: { type: "string" },
                    type: { type: "string", enum: ["single", "multi", "scale", "text"] },
                    required: { type: "boolean" }, help: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                  },
                  required: ["id", "text", "type"],
                },
              },
            },
            required: ["title", "description", "questions"],
          },
          rationale: { type: "string" },
        },
        required: ["survey", "rationale"],
      },
    });

    const parsed = typeof out === "string" ? JSON.parse(out) : out as any;
    const v = validateSurvey(parsed?.survey);
    if (!v.ok || !v.survey) return Response.json({ error: `AI produced an invalid survey: ${v.error}` }, { status: 422 });
    const rationale = String(parsed?.rationale || "").slice(0, 2000);

    // Autopublish only if the flag is on AND the global AI kill switch isn't engaged.
    const autopublish = (await isEnabled("kyc_survey_ai_autopublish").catch(() => false)) && !(await aiPaused().catch(() => false));
    if (autopublish) {
      await saveActiveSurvey(v.survey, "ai", user.id);
      await db.create("AdminAuditLog", { actor_email: user.email, actor_id: user.id, action_type: "kyc_survey_ai_autopublish", target: "kyc_survey", details: { questions: v.survey.questions.length }, timestamp: new Date().toISOString() }, user.id).catch(() => null);
      await logAiAction({ agent: "kyc_ai", action: "survey_publish", target: "kyc_survey", status: "applied", summary: `AI published a new KYC survey (${v.survey.questions.length} questions)`, detail: { rationale } }).catch(() => null);
      return Response.json({ ok: true, applied: true, survey: v.survey, rationale });
    }

    await saveProposal(v.survey, rationale, user.id);
    await logAiAction({ agent: "kyc_ai", action: "survey_proposal", target: "kyc_survey", status: "queued", summary: `AI proposed a new KYC survey (${v.survey.questions.length} questions) — awaiting approval`, detail: { rationale } }).catch(() => null);
    return Response.json({ ok: true, applied: false, staged: true, survey: v.survey, rationale, responses_analyzed: n });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
