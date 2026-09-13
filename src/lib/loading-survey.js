// loading-survey.js — controller for the "earn while it loads" overlay. When a load is PREDICTED to exceed the
// load-speed budget (in advance — from the AI load-time signals, the connection, and resilient state), the app
// shows generic customer-profiling questions and pays store credit per answer, until the load finishes.
//
// Predictive by design (owner directive): we decide to show the questions as SOON as we know a load will be slow
// — before it stalls and before the resilient fallback overrides the normal load — rather than waiting a fixed
// time. If we can't predict it in advance, a fallback timer still catches a load that turns out slow.

const state = {
  loaded: false,
  config: null,          // { enabled, questions, reward_points, daily_cap_points, remaining_points, predict, predicted_slow, trigger_ms, can_earn }
  idx: 0,
  remaining_points: null,
  fetching: false,
};

async function ensureConfig() {
  if (state.loaded) return state.config;
  state.loaded = true;
  try {
    const res = await fetch("/functions/loadingSurveyNext", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (res.ok) {
      const cfg = await res.json().catch(() => null);
      if (cfg && cfg.enabled && Array.isArray(cfg.questions) && cfg.questions.length) {
        state.config = cfg;
        state.remaining_points = Number(cfg.remaining_points ?? cfg.daily_cap_points ?? 0);
      }
    }
  } catch { /* stay disabled on failure — telemetry/earn must never break the app */ }
  return state.config;
}

// Kick off the config fetch during idle time so it's ready before the first slow load, without competing with
// the initial paint.
export function initLoadingSurvey() {
  const run = () => { ensureConfig(); };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}

function slowConnection() {
  try {
    const c = navigator.connection;
    if (!c) return false;
    if (c.saveData) return true;
    return ["slow-2g", "2g", "3g"].includes(c.effectiveType || "");
  } catch { return false; }
}

function resilientDegraded() {
  // resilient-mode.js publishes its state on window when not "normal"; treat degraded/overloaded as "will be slow".
  try { const m = window.__resilientMode; return m === "degraded" || m === "overloaded"; } catch { return false; }
}

export function isEnabled() { return !!(state.config && state.config.enabled); }

/** Predictive verdict: do we expect THIS load to blow the budget, so we should show questions right away? */
export function predictedSlowNow() {
  const cfg = state.config;
  if (!cfg || !cfg.predict) return false;
  return !!cfg.predicted_slow || slowConnection() || resilientDegraded();
}

/** How long to wait before showing questions once a load starts: near-immediate when we predicted it slow in
 *  advance, otherwise the fallback threshold (still below the resilient override). */
export function delayMs() {
  const cfg = state.config;
  const fallback = Number(cfg?.trigger_ms) || 1200;
  return predictedSlowNow() ? 250 : fallback;
}

export function currentQuestion() {
  const cfg = state.config;
  if (!cfg || !cfg.questions?.length) return null;
  return cfg.questions[state.idx % cfg.questions.length];
}

export function canEarn() { return !!(state.config?.can_earn) && (state.remaining_points ?? 0) > 0; }
export function rewardPoints() { return Number(state.config?.reward_points) || 0; }
export function remainingPoints() { return Number(state.remaining_points ?? 0); }

/** Submit an answer; returns { credited_points, remaining_points, note } (best-effort). Advances to the next Q. */
export async function answer(questionId, value) {
  let result = { credited_points: 0 };
  try {
    const res = await fetch("/functions/loadingSurveyAnswer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId, answer: value }),
    });
    if (res.ok) {
      result = await res.json().catch(() => ({ credited_points: 0 }));
      if (typeof result.remaining_points === "number") state.remaining_points = result.remaining_points;
    }
  } catch { /* keep the UI moving even if the write fails */ }
  state.idx += 1;
  return result;
}

export async function prime() { return ensureConfig(); }
