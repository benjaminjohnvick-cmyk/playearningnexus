// activityPing.js — a tiny cross-component signal for "the user just completed a survey action". Buddy chat
// listens to this so it can pause when someone stops working and resume when they start again. Pure
// browser events, no server round-trip.

export const SURVEY_ACTIVITY_EVENT = 'gg-survey-activity';

/** Call whenever the user completes a survey / burst / AdGrid unit. */
export function pingSurveyActivity() {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SURVEY_ACTIVITY_EVENT)); } catch { /* ignore */ }
}

/** Subscribe to activity pings. Returns an unsubscribe fn. */
export function onSurveyActivity(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SURVEY_ACTIVITY_EVENT, handler);
  return () => window.removeEventListener(SURVEY_ACTIVITY_EVENT, handler);
}
