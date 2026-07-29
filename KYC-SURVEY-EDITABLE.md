# KYC survey — AI-adjustable and human-adjustable

The Know-Your-Customer onboarding survey (interest personalization, not identity KYC) is no longer
hardcoded. It's stored and editable, and can be adjusted two ways: by a human admin, and by AI.

## Stored, not hardcoded

The active survey lives in a `KycSurveyConfig` singleton and is resolved at request time
(`getActiveSurvey()` → the saved/approved survey, or the built-in `KYC_SURVEY` default if untouched).
`kycSurveyGet` serves the active survey; members always see the current version. Every edit is validated
by `validateSurvey()` (unique ids, valid types, ≥2 options for choice questions, caps) so a bad edit can't
corrupt onboarding. Answers to custom questions are saved and fed to the chatbot/AI.

## Human adjustment

Admin-only **KYC Survey Editor** page: edit the title/description, add/remove/reorder questions, change
types, edit options, mark required, then **Save & publish** (or **Reset to default**). Backed by
`kycSurveyAdminGet` / `kycSurveyAdminSave`, with every change written to the admin audit log.

## AI adjustment

`kycSurveyAISuggest` analyzes the real distribution of past answers (which questions discriminate, which
options nobody picks, gaps to fill) and proposes an improved survey with a written rationale. By default
the proposal is **staged for human approval** (`kycSurveyProposalDecide` → approve/reject). If
`kyc_survey_ai_autopublish` is ON (default ON under the AI-on posture) — and the global AI kill switch
isn't engaged — the AI publishes the new survey live and logs it to the AI oversight feed.

## Flags, settings & entities

Flag: `kyc_survey_ai_autopublish` (default ON; respects the `ai_paused` kill switch). Entity:
`KycSurveyConfig`. Functions registered in the manifest: `kycSurveyAdminGet`, `kycSurveyAdminSave`,
`kycSurveyAISuggest`, `kycSurveyProposalDecide`. The reward + one-time gate behavior is unchanged.
