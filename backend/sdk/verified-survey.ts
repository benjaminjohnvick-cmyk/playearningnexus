// Verified-survey engine — the shared config, consent contract, and AI validity assessment for the
// platform's OWN PPC surveys answered by voice/video.
//
// FLOW (all on the platform's OWN surveys, never third-party like BitLabs): consent → record →
// transcribe → autofill answers → the RESPONDENT CONFIRMS → submit. The recording plus a heatmap/timing
// trace and an AI "valid response" score are the verification evidence that drives the respondent's
// trust score and the payout gate.
//
// COMPLIANCE POSTURE: voice/face recordings are BIOMETRIC data. They are captured ONLY behind an explicit,
// per-kind consent (see CONSENT_KINDS), stored with a retention limit, and never required — a respondent
// can always fall back to the normal tap-to-answer survey. Consent is re-verified server-side at submit.

import { snapNumber, snapString } from "./settings.ts";
import { isEnabled } from "./feature-flags.ts";
import { InvokeLLM } from "./integrations.ts";

// ── Consent contract (biometric + capture). Recorded via the existing ConsentRecord ledger. ──────────
export const CONSENT_KINDS = {
  voice: "biometric_voice",
  video: "video_recording",
  screen: "screen_capture_survey",
} as const;
export type CaptureKind = keyof typeof CONSENT_KINDS;

/** The consent version string — bump when the disclosure text changes so prior consents re-prompt. */
export const CONSENT_VERSION = "1.0";

/** Which consents a given capture method requires. Voice is the baseline; video adds facial biometric. */
export function consentsForMethod(method: string): string[] {
  const m = String(method || "voice").toLowerCase();
  if (m === "video") return [CONSENT_KINDS.voice, CONSENT_KINDS.video];
  if (m === "screen") return [CONSENT_KINDS.voice, CONSENT_KINDS.screen];
  return [CONSENT_KINDS.voice];
}

export const BIOMETRIC_DISCLOSURE =
  "This survey option uses your microphone (and camera, if you choose) so we can transcribe your spoken " +
  "answers and verify the response is genuine. Your recording is transcribed and then immediately " +
  "discarded — we do NOT store the audio or video. We keep only the text transcript and a validity score, " +
  "never the biometric recording itself, and never share anything with the survey's advertiser. Recording " +
  "is optional — you can always answer by tapping instead. By continuing you consent to this capture and " +
  "on-the-spot transcription.";

// ── Config knobs ─────────────────────────────────────────────────────────────────────────────────
// DATA MINIMIZATION: the raw voice/video recording is NEVER stored. It is transcribed in memory and then
// discarded; only the derived, non-biometric transcript + validity/fraud scores are retained. There is no
// media-storage or retention knob because there is no stored media to retain or purge.
export const verifiedSurveysEnabled = () => isEnabled("verified_surveys");
export const verifiedMinValidity = () => Math.max(0, Math.min(100, snapNumber("VERIFIED_SURVEY_MIN_VALIDITY", 50)));
export const verifiedMaxAudioMb = () => Math.max(1, snapNumber("VERIFIED_SURVEY_MAX_AUDIO_MB", 25));
export const whisperModel = () => snapString("WHISPER_MODEL", "whisper-1");

export interface ValidityResult {
  validity_score: number;          // 0–100, AI "is this a genuine, on-topic spoken response?"
  reasons: string[];
  ok: boolean;                     // score >= threshold
  scored: boolean;                 // false if the AI couldn't score (no key / error) — fail-open to manual review
}

/**
 * AI "valid response" score. Reads the survey's questions, the respondent's confirmed answers (including
 * their spoken free-text) and the raw transcript, and judges whether the response is a genuine, coherent,
 * on-topic human answer (vs. gibberish, off-topic, or obviously auto-filled). Returns a 0–100 score.
 * Fails OPEN (scored:false) when the LLM is unavailable, so a missing key never blocks earnings — the
 * response just falls back to the normal quality/fraud gates.
 */
export async function assessValidity(
  survey: Record<string, unknown>,
  answers: Array<Record<string, unknown>>,
  transcript: string,
): Promise<ValidityResult> {
  const threshold = verifiedMinValidity();
  const questions = (survey?.questions as Array<Record<string, unknown>>) || [];
  const lines = questions.map((q, i) => {
    const a = (answers || []).find((x) => Number(x.question_index) === i);
    const spoken = a?.open_text ? ` | spoken: "${String(a.open_text).slice(0, 300)}"` : "";
    const chosen = a?.selected_option ? ` | chose: ${String(a.selected_option).toUpperCase()}` : "";
    return `Q${i + 1}: ${String(q.question || "").slice(0, 200)}${chosen}${spoken}`;
  }).join("\n");

  const prompt =
    "You are a survey fraud & quality auditor. A respondent answered by SPEAKING; their audio was " +
    "transcribed. Judge whether this is a GENUINE, coherent, on-topic human response — not gibberish, " +
    "not off-topic, not an obvious bot/auto-fill. Consider whether the spoken words actually address " +
    "each question and are internally consistent.\n\n" +
    `SURVEY: ${String(survey?.title || "")}\n${lines}\n\nRAW TRANSCRIPT: "${String(transcript || "").slice(0, 2000)}"\n\n` +
    "Return validity_score 0-100 (100 = clearly genuine & on-topic; below 40 = likely invalid) and up to " +
    "4 short reasons.";

  try {
    const out = await InvokeLLM({
      prompt,
      model: "gpt_5_mini",   // cheap tier — a genuine/on-topic yes-no judgement doesn't need the large model
      response_json_schema: {
        type: "object",
        properties: {
          validity_score: { type: "number" },
          reasons: { type: "array", items: { type: "string" } },
        },
        required: ["validity_score"],
      },
    }) as { validity_score?: number; reasons?: string[] } | null;

    if (!out || typeof out.validity_score !== "number") return { validity_score: 100, reasons: ["ai_unavailable"], ok: true, scored: false };
    const score = Math.max(0, Math.min(100, Math.round(out.validity_score)));
    return { validity_score: score, reasons: (out.reasons || []).slice(0, 4), ok: score >= threshold, scored: true };
  } catch {
    return { validity_score: 100, reasons: ["ai_error"], ok: true, scored: false };
  }
}
