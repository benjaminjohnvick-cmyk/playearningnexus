import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  surveySuiteEnabled, allQuestionTypeKeys, shuffleOptions, addNeutralOption, scoreSurvey, screenSurvey,
} from "../../sdk/survey-suite.ts";

// aiSurveySuiteEdit — apply one AI or deterministic edit op to a question in a SurveyDraft. AI ops
// (reword/expand/shorten/change_tone/spellcheck/translate) run through the LLM; deterministic ops
// (shuffle_options/add_option/remove_option/add_neutral/change_type/undo) run in code. Keeps an undo history.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!surveySuiteEnabled()) return Response.json({ error: "The AI Survey Suite is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const draft = await db.get("SurveyDraft", String(body.draft_id ?? "")).catch(() => null) as Record<string, unknown> | null;
    if (!draft || draft.advertiser_id !== user.id) return Response.json({ error: "Draft not found." }, { status: 404 });

    const op = String(body.op ?? "");
    const idx = Number(body.question_index);
    const questions: Record<string, unknown>[] = Array.isArray(draft.questions) ? [...draft.questions as Record<string, unknown>[]] : [];
    const history: unknown[] = Array.isArray(draft.history) ? draft.history as unknown[] : [];

    if (op === "undo") {
      const prev = history.pop();
      if (!prev) return Response.json({ error: "Nothing to undo." }, { status: 400 });
      const restored = prev as Record<string, unknown>[];
      const scoreU = scoreSurvey(restored);
      await db.update("SurveyDraft", draft.id as string, { questions: restored, history, score: scoreU.score, quality: scoreU }).catch(() => null);
      return Response.json({ success: true, undone: true, survey: { ...draft, questions: restored, score: scoreU.score } });
    }

    if (!Number.isInteger(idx) || idx < 0 || idx >= questions.length) return Response.json({ error: "Bad question_index." }, { status: 400 });
    const q = { ...questions[idx] };
    // Snapshot for undo (cap history at 20).
    history.push(JSON.parse(JSON.stringify(questions)));
    while (history.length > 20) history.shift();

    const aiOps: Record<string, string> = {
      reword: "Reword this survey question to be clear, neutral, and unbiased. Keep the same meaning.",
      expand: "Expand this survey question with a little more helpful context, staying neutral and concise.",
      shorten: "Shorten this survey question to the tightest neutral phrasing.",
      change_tone: `Rewrite this survey question in a ${String(body.tone ?? "friendly")} tone, staying neutral and unbiased.`,
      spellcheck: "Fix any spelling or grammar issues in this survey question; change nothing else.",
      translate: `Translate this survey question (and its options) to ${String(body.locale ?? "es")}. Return the translated stem and options.`,
    };

    if (aiOps[op]) {
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${aiOps[op]}
COMPLIANCE: never introduce any earnings/ROI/"$X/day"/risk-free claim.
QUESTION: ${q.stem ?? q.question}
OPTIONS: ${JSON.stringify(q.options ?? [])}`,
        response_json_schema: { type: "object", properties: { stem: { type: "string" }, options: { type: "array", items: { type: "string" } } } },
      }).catch(() => null);
      if (res?.stem) q.stem = res.stem;
      if (Array.isArray(res?.options) && res.options.length) q.options = res.options;
      if (op === "translate") q.locale = String(body.locale ?? "es");
    } else if (op === "shuffle_options") {
      q.options = shuffleOptions((q.options as string[]) || [], Number(body.seed) || 7);
    } else if (op === "add_option") {
      q.options = [...((q.options as string[]) || []), String(body.option ?? "New option")];
    } else if (op === "remove_option") {
      const oi = Number(body.option_index);
      q.options = ((q.options as string[]) || []).filter((_, i) => i !== oi);
    } else if (op === "add_neutral") {
      q.options = addNeutralOption((q.options as string[]) || []);
    } else if (op === "change_type") {
      const t = String(body.new_type ?? "");
      if (!allQuestionTypeKeys().includes(t)) return Response.json({ error: "Unknown question type." }, { status: 400 });
      q.question_type = t;
    } else {
      return Response.json({ error: `Unknown op "${op}".` }, { status: 400 });
    }

    questions[idx] = q;
    const screen = screenSurvey(questions);
    const score = scoreSurvey(questions);
    await db.update("SurveyDraft", draft.id as string, { questions, history, score: score.score, quality: score, quality_issues: screen.issues }).catch(() => null);
    return Response.json({ success: true, op, question: q, score: score.score, quality_issues: screen.issues });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
