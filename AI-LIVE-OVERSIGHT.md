# AI Live Oversight — all AI on, with a human able to watch, stop, and correct

All AI functionality runs autonomously from the get-go. This system gives a human real-time visibility and
control without slowing the AI down, and it routes every change through the site's own users first.

## The change lifecycle (individual → statistical → global)

1. **The AI proposes a change.** For any non-sensitive setting, it does NOT apply globally. It opens a
   change-gating experiment (`createExperimentForProposal`).
2. **Every user is asked yes/no.** The change is put to real members as a simple "does this work for you?"
   prompt (`ExperimentVotePrompt`, mounted globally; one vote per user via `submitExperimentFeedback`).
3. **The users' yeses and noes decide.** `evaluateExperiments` promotes a change only when it clears a
   high statistical bar: a minimum number of votes (`CHANGE_GLOBAL_MIN_SAMPLE`, default 20), a minimum
   yes-rate (`CHANGE_GLOBAL_MIN_APPROVAL`, default 0.70), AND a Wilson 95% lower-bound ≥ 0.5 so a small
   lucky sample can't win.
4. **AI conducts its own review and promotes — by default.** With the optional human gate OFF
   (`AI_GLOBAL_HUMAN_GATE`, default off), the AI sanity-checks the user-approved change (`aiReviewPromotion`
   — defaults to approve since users already said yes, but can HOLD something risky/unreliable) and pushes
   it site-wide. Each promotion is logged to the live feed.
5. **Optional human gate.** Flip `AI_GLOBAL_HUMAN_GATE` on and promotions instead wait for a once-per-24h,
   one-hour peak-time review window (`PEAK_REVIEW_HOUR_UTC`, `PEAK_REVIEW_WINDOW_HOURS`), where an admin
   promotes/rejects eligible changes (`aiGlobalReview` / `aiGlobalDecide`, window-gated).

Money/compliance settings are NEVER auto-tuned — the optimizer's `COMPLIANCE_DENYLIST` excludes them from
this entire path.

## Global controls (backend/sdk/ai-control.ts)

- **STOP button** — the `ai_paused` global kill switch. `aiPaused()` is checked by the autonomous loops
  (`runOptimizationPass`, `selfLearningCycle`, KYC autopublish), so engaging it instantly halts AI-driven
  changes. `setAiPaused()` flips it.
- **Real-time feed** — `logAiAction()` writes every AI action to `AIActivityLog`; `recentAiActivity()`
  reads it back. The optimizer and KYC AI are instrumented; the helper is available for any other engine.
- **Corrections that teach** — `recordCorrection()` records a human fix as an `AICorrection` plus a
  heavily-weighted `OptimizationSignal` and an `AgentLearningMemory` lesson, so the AI grounds on the fix
  on its next pass. Corrections work even while the AI is paused.

## Functions & UI

- `aiControlStatus` (feed + paused state), `aiControlPause` (stop/resume), `aiCorrectionSubmit` (apply a
  fix to a safe setting + record the lesson), `aiGlobalReview` / `aiGlobalDecide` (optional daily gate).
- **AI Live Oversight** admin page: live feed (polls every 5s), the STOP/Resume button, per-action
  "Correct" flow, and the (optional) daily global-review panel.

## Flags & settings

Flags: `ai_paused` (kill switch, default OFF), `kyc_survey_ai_autopublish` (AI applies live, default ON).
Settings: `AI_GLOBAL_HUMAN_GATE` (default OFF), `CHANGE_GLOBAL_MIN_APPROVAL` (0.70),
`CHANGE_GLOBAL_MIN_SAMPLE` (20), `PEAK_REVIEW_HOUR_UTC` (18), `PEAK_REVIEW_WINDOW_HOURS` (1),
`OPTIMIZER_REQUIRE_EXPERIMENT` (on — the per-user consent path).

## Entities

`AIActivityLog`, `AICorrection` (both added to schema.sql + entities.json).
