import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  loadingSurveyEnabled, loadingSurveyPredictEnabled, loadingSurveyRewardPoints, loadingSurveyDailyCapPoints,
  loadingSurveyBatchSize, loadingSurveyTriggerMs, pickQuestions, earnedTodayPoints, predictedSlow,
} from "../../sdk/loading-survey.ts";

// loadingSurveyNext — the client calls this once (cached) to get everything the loading-survey overlay needs: a
// batch of profiling questions to show while something is loading, the reward + remaining daily cap, and the
// TRIGGER config — including `predicted_slow` (the server's aggregate hint that loads are running over the
// perception budget) and whether to use the predictive fast-path. Auth OPTIONAL: anonymous visitors still get
// questions (their answers are useful first-party data) but earn nothing until signed in.
export default __handler(async (req) => {
  try {
    if (!loadingSurveyEnabled()) return Response.json({ enabled: false });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const uid = user ? String(user.id) : "";

    const [questions, earned, slow] = await Promise.all([
      pickQuestions(uid, loadingSurveyBatchSize()),
      uid ? earnedTodayPoints(uid) : Promise.resolve(0),
      predictedSlow(),
    ]);
    const cap = loadingSurveyDailyCapPoints();

    return Response.json({
      enabled: true,
      can_earn: !!uid,
      questions,
      reward_points: loadingSurveyRewardPoints(),
      daily_cap_points: cap,
      earned_today_points: earned,
      remaining_points: Math.max(0, cap - earned),
      // Trigger config for the client:
      predict: loadingSurveyPredictEnabled(),   // use the in-advance predictive path
      predicted_slow: slow,                       // server aggregate hint (real-user p75 over budget)
      trigger_ms: loadingSurveyTriggerMs(),       // fallback wait when a load isn't predicted slow
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
