import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  surveySuiteEnabled, surveyMaxQuestions, allQuestionTypeKeys, questionType,
  screenSurvey, scoreSurvey, surveyPlaybookFor,
} from "../../sdk/survey-suite.ts";

// aiSurveySuiteGenerate — prompt/goal/topic → a full professional survey with varied question types, or paste
// an existing survey to restructure it into the builder. Quality- and compliance-screened, scored, biased by
// the self-learning playbook, persisted as a SurveyDraft. (Pollfish-parity generation on our own stack.)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!surveySuiteEnabled()) return Response.json({ error: "The AI Survey Suite is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "paste" ? "paste" : "prompt";
    const goal = String(body.goal ?? body.brief ?? body.topic ?? "").trim();
    const pasteText = String(body.paste_text ?? "").trim();
    if (mode === "prompt" && !goal) return Response.json({ error: "Describe your survey goal or topic." }, { status: 400 });
    if (mode === "paste" && !pasteText) return Response.json({ error: "Paste an existing survey to restructure." }, { status: 400 });

    const audience = String(body.audience ?? "adults 18+").slice(0, 300);
    const locale = String(body.locale ?? "en");
    const maxQ = surveyMaxQuestions();
    const numQ = Math.max(1, Math.min(Number(body.num_questions) || 6, maxQ));
    const allowedTypes = allQuestionTypeKeys();
    const wantTypes = (Array.isArray(body.question_types) && body.question_types.length ? body.question_types.map(String) : allowedTypes)
      .filter((t) => allowedTypes.includes(t));

    const playbook = await surveyPlaybookFor(db, user.id).catch(() => null);
    const favor = playbook?.top?.question_type ? `Favor "${playbook.top.question_type}" question types where natural — they complete best for this account.` : "";

    const typeMenu = wantTypes.map((k) => `${k} (${questionType(k)?.label})`).join(", ");
    const prompt = mode === "paste"
      ? `Restructure the following into a clean, well-formed survey using our builder's question types.
QUESTION TYPES AVAILABLE: ${typeMenu}.
Keep the author's intent; fix leading/double-barreled wording; add answer options where missing. Output ${locale} language.
EXISTING SURVEY:
${pasteText.slice(0, 4000)}`
      : `You are an expert survey methodologist. Design a ${numQ}-question survey.
GOAL: ${goal}
AUDIENCE: ${audience}
LANGUAGE: ${locale}
QUESTION TYPES AVAILABLE (use a sensible MIX, not all one type): ${typeMenu}.
${favor}
RULES: neutral, unbiased, one idea per question; no leading or double-barreled questions; include a neutral / "Prefer not to say" option on sensitive items.
COMPLIANCE (mandatory): never imply guaranteed earnings, income, returns, ROI, "$X/day", or "risk-free". Rewards are non-cashable store credit and vary.`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" }, description: { type: "string" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_type: { type: "string" }, stem: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                scale_points: { type: "number" }, rationale: { type: "string" },
              },
            },
          },
        },
      },
    }).catch(() => ({ questions: [] }));

    let questions = Array.isArray(res?.questions) ? res.questions.slice(0, maxQ) : [];
    // Normalize question_type to a known key; default unknowns to single_select.
    questions = questions.map((q) => ({
      ...q,
      question_type: allowedTypes.includes(String(q.question_type)) ? q.question_type : "single_select",
      stem: String(q.stem ?? q.question ?? ""),
    }));

    const screen = screenSurvey(questions);
    // Drop questions that hit a hard compliance block.
    const blockedIdx = new Set(screen.issues.filter((i) => i.issue.severity === "block").map((i) => i.index));
    const shipped = questions.filter((_, i) => !blockedIdx.has(i));
    const score = scoreSurvey(shipped);

    const draft = {
      advertiser_id: user.id, title: res?.title ?? (goal.slice(0, 80) || "Untitled survey"),
      description: res?.description ?? "", locale,
      questions: shipped, question_count: shipped.length,
      score: score.score, est_seconds: score.est_seconds, quality: score,
      quality_issues: screen.issues, status: "draft", mode, created_at: new Date().toISOString(),
    };
    const saved = await db.create("SurveyDraft", draft).catch(() => null) as Record<string, unknown> | null;
    if (saved?.id) draft.id = saved.id;

    return Response.json({
      success: true, survey: draft,
      dropped_for_compliance: blockedIdx.size,
      quality_score: score.score, est_minutes: Math.round(score.est_seconds / 60 * 10) / 10,
      quality_issues: screen.issues,
      playbook_top: playbook?.top ?? {},
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
