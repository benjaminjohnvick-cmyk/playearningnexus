# Verified Surveys — voice/video answering for the platform's own PPC surveys

Respondents can answer the platform's **own** PPC surveys in their own words — either by **typing or
dictating** (the cheapest, default path) or by **recording** their voice/video. Their words are mapped onto
the survey's questions, the **respondent reviews and confirms** every answer, and only then is the response
submitted. An AI "valid response" score plus the existing interaction/heatmap trace gate the payout.

There are two entry points, both "verified":
- **Type or speak (recommended, free).** A text box the respondent types into, or dictates into with their
  phone keyboard's own mic (the OS transcribes for free — our app never touches audio, so this needs **no
  biometric consent** and never uses Whisper). This is the default and the cheapest path.
- **Record voice/video.** For stronger verification, the respondent may record; that path keeps the
  biometric consent gate and the transcribe-then-discard behavior below.

**Cost design — rules first, AI as a fallback.** Mapping the answer to A/B/C/D runs the **free** rules
matcher (`answer-match.ts`) first; only the questions it can't confidently resolve are sent — in one
batched cheap-tier call — to the LLM (`AUTOFILL_MATCH_MIN_CONFIDENCE`, default 0.5). On plain closed-choice
surveys most answers cost **$0**; the cheap model is touched only for genuinely ambiguous ones.

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
4. **Autofill (rules-first).** `autofillSurveyFromTranscript` maps the text to each question — the free
   rules matcher first, the cheap-tier LLM only for the low-confidence remainder — **suggestions only,
   never a submission**.
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
