// surveySession.js — device-side survey timing + straight-through enforcement.
//
// A survey must be completed in one go: no pausing or restarting mid-survey. The user may pause only
// BETWEEN surveys (call pauseBetween()). We measure FOREGROUND time using the Page Visibility API — if the
// app is backgrounded while a survey is in progress (and not in a between-surveys pause), we mark the run
// interrupted. This offloads timing to the phone's OS (visibility events) instead of trusting one server
// timestamp. The verdict inputs are sent to the backend (survey-timing.ts) which decides pay/hold.
//
// Usage:
//   const s = createSurveySession();
//   s.startSurvey('survey_123', { expectedSeconds: 120 });
//   ... user answers ...
//   const signals = s.completeSurvey();   // { survey_id, seconds, expectedSeconds, interrupted, restarts }
//   s.pauseBetween(); / s.resume();        // only valid BETWEEN surveys

export function createSurveySession() {
  let current = null;         // { id, startedAt, foregroundMs, lastVisibleAt, expectedSeconds, interrupted, restarts }
  let betweenPause = false;   // true when the user paused BETWEEN surveys (allowed)
  let visHandler = null;

  const now = () => Date.now();

  const attach = () => {
    if (visHandler || typeof document === 'undefined') return;
    visHandler = () => {
      if (!current) return;
      if (document.visibilityState === 'hidden') {
        // Backgrounding mid-survey (not a between-surveys pause) breaks straight-through.
        if (!betweenPause) current.interrupted = true;
        // bank the foreground time up to now
        if (current.lastVisibleAt) { current.foregroundMs += now() - current.lastVisibleAt; current.lastVisibleAt = null; }
      } else {
        current.lastVisibleAt = now();
      }
    };
    document.addEventListener('visibilitychange', visHandler);
  };

  const detach = () => {
    if (visHandler && typeof document !== 'undefined') document.removeEventListener('visibilitychange', visHandler);
    visHandler = null;
  };

  return {
    startSurvey(id, opts = {}) {
      betweenPause = false;
      current = { id, startedAt: now(), foregroundMs: 0, lastVisibleAt: now(), expectedSeconds: Number(opts.expectedSeconds) || 0, interrupted: false, restarts: 0 };
      attach();
      return current;
    },

    // Called if the same survey is re-opened without completing — counts as a restart (breaks straight-through).
    noteRestart() { if (current) current.restarts += 1; },

    completeSurvey() {
      if (!current) return null;
      if (current.lastVisibleAt) { current.foregroundMs += now() - current.lastVisibleAt; current.lastVisibleAt = null; }
      const seconds = Math.round(current.foregroundMs / 1000);
      const signals = {
        survey_id: current.id,
        seconds,
        expectedSeconds: current.expectedSeconds || undefined,
        interrupted: current.interrupted,
        restarts: current.restarts,
      };
      current = null;
      detach();
      return signals;
    },

    // Pausing is ONLY allowed between surveys (no active survey). Returns false if a survey is in progress.
    pauseBetween() { if (current) return false; betweenPause = true; return true; },
    resume() { betweenPause = false; return true; },

    isInSurvey() { return !!current; },
    isPausedBetween() { return betweenPause; },
  };
}
