import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { surveySuiteEnabled, recordSurveyOutcome, surveyPlaybookFor, surveyRecommendations } from "../../sdk/survey-suite.ts";

// aiSurveySuiteLearn — the self-learning step. Turns a fielded survey's completion into signed learning
// signals per question attribute (type / position / length), rebuilds the playbook, and returns the
// next-survey guidance the generator should favor.
const lengthBucket = (stem) => { const n = String(stem ?? "").length; return n < 60 ? "short" : n < 130 ? "medium" : "long"; };
const positionBucket = (i, total) => (i < total / 3 ? "early" : i < (2 * total) / 3 ? "mid" : "late");

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!surveySuiteEnabled()) return Response.json({ error: "The AI Survey Suite is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const advertiserId = (user.role === "admin" && body.advertiser_id) ? String(body.advertiser_id) : user.id;
    const today = new Date().toISOString();

    let signals = 0;
    if (body.survey_id) {
      const draft = await db.get("SurveyDraft", String(body.survey_id)).catch(() => null) as Record<string, unknown> | null;
      const questions: Record<string, unknown>[] = Array.isArray(draft?.questions) ? draft!.questions as Record<string, unknown>[] : [];
      const completion = Math.max(0, Math.min(1, Number(body.completion_rate) || 0.6));
      const observations = Math.max(1, Number(body.responses) || 1);
      // completion above 0.6 is positive, below is negative; scaled to [-3, 3].
      const weight = Math.max(-3, Math.min(3, Math.round((completion - 0.6) * 6 * 100) / 100));
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await recordSurveyOutcome(db, {
          survey_id: String(body.survey_id), advertiser_id: advertiserId,
          attributes: {
            question_type: String(q.question_type ?? "single_select"),
            position: positionBucket(i, questions.length),
            length: lengthBucket(q.stem ?? q.question),
          },
          weight, observations, outcome: completion >= 0.6 ? "completed" : "dropped", todayISO: today,
        });
        signals++;
      }
    }

    const playbook = await surveyPlaybookFor(db, advertiserId, today).catch(() => null);
    return Response.json({
      success: true, advertiser_id: advertiserId, signals_recorded: signals,
      playbook: playbook ? { sample_size: playbook.sample_size, next_survey_attributes: playbook.top, recommendations: surveyRecommendations(playbook) } : null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
