// survey-timing.ts — completion-time integrity for surveys.
//
// Rule: a survey must be answered straight through — no pausing or restarting MID-survey. The user may pause
// only BETWEEN surveys (a dedicated pause button). This module scores the completion time the client reports:
//   • too fast (below the speeder floor) → not a real read, flag/hold.
//   • interrupted mid-survey (client detected the app backgrounded / a restart) → flag/hold.
//   • implausibly fast vs the survey's expected length → flag.
// As much timing as possible is measured on the DEVICE (foreground time, visibility) and only the verdict
// inputs are sent up, so we lean on the phone's OS rather than trusting a single server timestamp.

import { snapNumber } from "./settings.ts";

/** Minimum plausible completion time (seconds). Completions faster than this are flagged. */
export function minCompletionSeconds(): number {
  return Math.max(0, snapNumber("SURVEY_FRAUD_SPEEDER_SECONDS", 20));
}

export interface TimingSignals {
  seconds: number;            // foreground seconds the client measured for the survey
  expectedSeconds?: number;   // provider's estimated length, if known
  interrupted?: boolean;      // client saw the survey backgrounded / restarted mid-way
  restarts?: number;          // number of restart attempts the client observed
}

export interface TimingVerdict {
  ok: boolean;
  flagged: boolean;
  reason: string | null;
  min_seconds: number;
}

/** Score a reported completion. Straight-through + not-too-fast = ok. */
export function scoreCompletionTiming(s: TimingSignals): TimingVerdict {
  const min = minCompletionSeconds();
  const seconds = Math.max(0, Number(s.seconds) || 0);

  if (s.interrupted || (Number(s.restarts) || 0) > 0) {
    return { ok: false, flagged: true, reason: "interrupted_midsurvey", min_seconds: min };
  }
  if (seconds < min) {
    return { ok: false, flagged: true, reason: "too_fast", min_seconds: min };
  }
  // Absurdly fast relative to the provider's own estimate (< 25% of expected).
  const expected = Number(s.expectedSeconds) || 0;
  if (expected > 0 && seconds < expected * 0.25) {
    return { ok: false, flagged: true, reason: "far_below_expected", min_seconds: min };
  }
  return { ok: true, flagged: false, reason: null, min_seconds: min };
}
