import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { loadingSurveyEnabled, recordAnswer } from "../../sdk/loading-survey.ts";

// loadingSurveyAnswer — record ONE answer the user tapped while waiting for a load, and award the capped store
// credit (1 point = 1c, capped per day). Auth OPTIONAL: anonymous answers are stored as first-party data but
// earn nothing. The daily cap is enforced server-side, so this can't be farmed by replaying it.
//   { question_id, answer } -> { ok, credited_points, credited_usd, capped, remaining_points, note? }
export default __handler(async (req) => {
  try {
    if (!loadingSurveyEnabled()) return Response.json({ error: "unavailable" }, { status: 403 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const uid = user ? String(user.id) : "";

    const body = await req.json().catch(() => ({}));
    const questionId = String(body.question_id ?? "");
    const answer = String(body.answer ?? "");
    if (!questionId || !answer) return Response.json({ error: "question_id and answer are required" }, { status: 400 });

    const result = await recordAnswer(uid, questionId, answer);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
