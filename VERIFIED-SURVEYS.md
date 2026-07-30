# Verified Surveys — voice/video answering for the platform's own PPC surveys

Respondents can answer the platform's **own** PPC surveys by **speaking** their answers. The recording is
transcribed, an AI maps the spoken words onto the survey's questions, the **respondent reviews and
confirms** every answer, and only then is the response submitted. A recording plus an AI "valid response"
score and the existing interaction/heatmap trace become fraud-prevention evidence that gates the payout.

This is offered **only on the platform's own PPC surveys**, never on third-party offerwalls (e.g. BitLabs)
— those can't be autofilled and doing so would break their terms.

## Flow

1. **Consent (biometric).** Voice and facial data are biometric information, so recording is gated behind
   an explicit, per-kind consent recorded in the append-only `ConsentRecord` ledger
   (`verifiedSurveyConsent`). Kinds: `biometric_voice`, `video_recording`, `screen_capture_survey`.
   Recording is always **optional** — the normal tap-to-answer flow stays available.
2. **Record.** The browser records mic audio (and, if the respondent opts in, camera video) via
   `MediaRecorder`.
3. **Transcribe (device-first, free) — and the recording is never kept.** The phone's built-in dictation
   (the browser Web Speech API) transcribes the answer **on the device at no cost**; when it works, the
   audio isn't even uploaded. Only when the browser can't transcribe (e.g. older iOS Safari) is the audio
   sent to `transcribeSurveyAudio`, which runs OpenAI Whisper **in memory and then discards the audio**.
   Either way, **the raw voice/video is never stored** — no S3 upload, no retention. We keep only a
   non-biometric "verification receipt" (`VerifiedSurveyMedia`): the transcript, which consents were held,
   the `transcription_source` (`device` = free / `whisper` = paid fallback), and the duration. Whisper spend
   (fallback only) is metered against `AI_DAILY_SPEND_CAP_USD`. Net effect: transcription cost drops toward
   zero on supported browsers, storage cost is zero, and no biometric recording is retained.
4. **Autofill.** `autofillSurveyFromTranscript` uses the LLM to propose an answer for each question from
   the transcript — **suggestions only, never a submission**.
5. **Confirm.** The respondent reviews each proposed answer and can change any of them.
6. **Submit.** `submitVerifiedSurveyResponse` re-checks consent server-side, creates the response
   (`is_verified: true`), runs the AI validity score inline, then the existing quality + fraud engines,
   and pays out through `respondentMicroPayout` **only if clean**.

## The AI "valid response" score

At submit, `assessValidity` (in `sdk/verified-survey.ts`) asks the LLM whether the spoken answers are a
genuine, coherent, on-topic human response. It returns a 0–100 `validity_score`. Below
`VERIFIED_SURVEY_MIN_VALIDITY` (default 50) the response is flagged and **held** (`is_blocked`) for review
— no payout. If the LLM is unavailable the response is left **unscored** and falls back to the normal
quality/fraud gates (fail-open, so a missing key never blocks earnings). `respondentMicroPayout` carries a
defense-in-depth check so a mis-ordered client call can't pay an invalid verified response.

## Compliance posture

Voice/face recordings are **biometric data**, so the strongest posture is to not keep them: the raw
recording is **captured behind explicit per-kind consent, transcribed on the spot, and then discarded — it
is never written to storage.** Only the derived, non-biometric transcript + validity/fraud scores are
retained (as a `VerifiedSurveyMedia` "verification receipt"), **never sold** and **never shared with the
survey's advertiser**, and recording is always optional. Because nothing biometric is stored, there is no
retention window to manage and no media-purge job to run. The interaction/heatmap trace (structural, no pixels) is the
same one the tap flow already ships and is the "screen/interaction capture" evidence — full-screen video
shipping to advertisers was deliberately **not** built, as it adds biometric/IP risk without improving on
the structural trace.

## Config

Feature flag `verified_surveys` — **on by default**. Voice transcription lights up once `OPENAI_API_KEY`
is set; with no key the feature degrades gracefully (the consent/flag work, transcription returns
"unavailable", and respondents simply use tap-to-answer).

Settings (admin-tunable): `VERIFIED_SURVEY_MIN_VALIDITY` (50), `VERIFIED_SURVEY_MAX_AUDIO_MB` (25, a bound
on the fallback Whisper upload only), `WHISPER_MODEL` (`whisper-1`). Whisper spend (fallback path) is
metered against the shared `AI_DAILY_SPEND_CAP_USD` brake. There are no media-storage or retention settings
because the recording is never stored.

## Requirements to go fully live

Set `OPENAI_API_KEY` (powers the Whisper fallback transcription, the AI autofill, and the validity score;
the device-first free path needs no key). **No S3 is needed** — the recording is transcribed in memory and
discarded, so there is nothing to store.
