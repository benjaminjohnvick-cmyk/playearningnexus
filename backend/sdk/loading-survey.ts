// loading-survey.ts — the "earn while it loads" feature. When a load is predicted to blow past the load-time
// perception budget, the app shows generic customer-profiling ("know your customer") questions and pays the user
// non-cashable STORE CREDIT (Site Points) for each answer, capped tightly so it can't be farmed. Answers are
// first-party survey data that feed personalization / the data-driven loop.
//
// MONEY/COMPLIANCE: the reward is closed-loop Site Points (non-cashable) — NOT a money action. It's a bounded
// promotional subsidy (a cost), governed by a small per-day cap. Questions are non-sensitive by construction
// (see kyc-loading-questions.ts) — no identity, financial, health, or protected-class data.
import { db } from "./db.ts";
import { snapBool, snapNumber } from "./settings.ts";
import { adjustUserBalance } from "./balance.ts";
import { recordSubsidy } from "./revenue.ts";
import { pointsToUsd } from "./earn-hook.ts";
import { vitalP75, perfBudgetRouteMs } from "./perf-optimizer.ts";
import { KYC_LOADING_QUESTIONS, type KycQuestion } from "./kyc-loading-questions.ts";

const ACTOR = "system@getgoodsgratis.local";
const byId = new Map(KYC_LOADING_QUESTIONS.map((q) => [q.id, q]));

export const loadingSurveyEnabled = () => snapBool("LOADING_SURVEY_ENABLED", true);
export const loadingSurveyPredictEnabled = () => snapBool("LOADING_SURVEY_PREDICT_ENABLED", true);
export const loadingSurveyRewardPoints = () => Math.max(0, Math.round(snapNumber("LOADING_SURVEY_REWARD_POINTS", 1)));   // 1pt = 1c (closed-loop)
export const loadingSurveyDailyCapPoints = () => Math.max(0, Math.round(snapNumber("LOADING_SURVEY_DAILY_CAP_POINTS", 10))); // 10c/day
export const loadingSurveyBatchSize = () => Math.max(1, Math.min(40, Math.round(snapNumber("LOADING_SURVEY_BATCH_SIZE", 10))));
// Fallback wait before showing questions when the load ISN'T predicted slow in advance (predictive path fires
// much sooner). Kept below the resilient-mode override so questions appear BEFORE the site fails over.
export const loadingSurveyTriggerMs = () => Math.max(200, Math.round(snapNumber("LOADING_SURVEY_TRIGGER_MS", 1200)));

const today = () => new Date().toISOString().slice(0, 10);

/** Points already earned from the loading survey today (for the daily cap). */
export async function earnedTodayPoints(userId: string): Promise<number> {
  if (!userId) return 0;
  const rows = await db.filter("LoadingSurveyResponse", { user_id: String(userId), day: today() }, "-at", 500).catch(() => []);
  return (rows || []).reduce((s: number, r: any) => s + (Number(r.points) || 0), 0);
}

/** A batch of questions the user hasn't answered recently, shuffled. Anonymous → just a random batch. */
export async function pickQuestions(userId: string, n: number): Promise<KycQuestion[]> {
  let answered = new Set<string>();
  if (userId) {
    const recent = await db.filter("LoadingSurveyResponse", { user_id: String(userId) }, "-at", 1500).catch(() => []);
    answered = new Set((recent || []).map((r: any) => String(r.question_id)));
  }
  const pool = KYC_LOADING_QUESTIONS.filter((q) => !answered.has(q.id));
  const src = pool.length >= n ? pool : KYC_LOADING_QUESTIONS; // once they've seen them all, allow repeats
  // Fisher-Yates on a copy, take n.
  const arr = [...src];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(0, n);
}

/** Is a load likely to exceed the perception budget? Server-side aggregate hint (real user p75 over budget).
 *  The client combines this with its own connection/resilient signals to decide in advance. */
export async function predictedSlow(): Promise<boolean> {
  try {
    const { p75, n } = await vitalP75("route");
    return n >= 30 && p75 > perfBudgetRouteMs();
  } catch { return false; }
}

export interface AnswerResult { ok: boolean; credited_points: number; credited_usd: number; capped: boolean; earned_today_points: number; remaining_points: number; note?: string; }

/** Record one answer and award the (capped) reward. Anonymous users' answers are still stored (first-party data)
 *  but earn nothing. Never throws a reward out of the cap. */
export async function recordAnswer(userId: string, questionId: string, answer: string): Promise<AnswerResult> {
  const q = byId.get(String(questionId));
  const cap = loadingSurveyDailyCapPoints();
  const per = loadingSurveyRewardPoints();
  const ans = String(answer ?? "").slice(0, 200);
  if (!q) return { ok: false, credited_points: 0, credited_usd: 0, capped: false, earned_today_points: 0, remaining_points: cap, note: "unknown question" };

  const uid = String(userId || "");
  const earned = uid ? await earnedTodayPoints(uid) : 0;
  const room = Math.max(0, cap - earned);
  const grant = uid ? Math.min(per, room) : 0;

  // Store the answer (first-party profiling data) regardless of reward.
  await db.create("LoadingSurveyResponse", {
    user_id: uid || null, question_id: q.id, question: q.text, topic: q.topic, answer: ans,
    points: grant, day: today(), source: "loading_interstitial", at: new Date().toISOString(),
  }, ACTOR).catch(() => null);

  if (grant > 0) {
    const newBal = await adjustUserBalance(uid, grant, { field: "points" }).catch(() => null);
    if (newBal === null) {
      return { ok: true, credited_points: 0, credited_usd: 0, capped: false, earned_today_points: earned, remaining_points: room, note: "reward deferred" };
    }
    // The reward is a bounded promotional subsidy (a cost).
    await recordSubsidy({ type: "loading_survey_subsidy", amount_usd: pointsToUsd(grant), user_id: uid, ref: "loading_survey", funded_by: "platform", meta: { question_id: q.id, topic: q.topic } }).catch(() => null);
  }
  const earnedNow = earned + grant;
  return {
    ok: true, credited_points: grant, credited_usd: pointsToUsd(grant),
    capped: uid ? room <= 0 : false, earned_today_points: earnedNow, remaining_points: Math.max(0, cap - earnedNow),
    note: !uid ? "Sign in to earn store credit for answering." : (grant === 0 ? "You've reached today's answer-reward limit — answers still help, come back tomorrow to earn more." : undefined),
  };
}
