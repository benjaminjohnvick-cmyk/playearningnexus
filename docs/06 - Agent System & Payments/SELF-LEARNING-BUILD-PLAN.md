# Self-Learning & Data-Driven AI — Build Plan (increments)

**Goal (your words):** every human-input process becomes a data-driven AI process end-to-end (incl. games and site layout), and all AI is self-learning/self-improving with all data working together to improve all AI functions — building on what exists, not replacing it.

**What already exists (the scaffolding):** ~20 learning/optimizer functions (`aiAgentLearningSystem`, `aiAgentSelfImprovementEngine`, `aiAutoLearningOrchestrator`, `aiUniversalOptimizationEngine`, `aiGameCreatorFromFeedback`, …), learning-memory tables (`AgentLearningMemory`, `AdLearningMemory`, `AIFeedbackAnalysis`), and the survey→signal→agent data pipeline (`SurveySignal`/`SurveyEvidence`/`DomainEvent`).

**The real gap:** the pieces are disconnected. The agent **runtime** never reads or writes the learning store — so agents don't recall past lessons before acting, don't record outcomes after, and one agent's/process's data doesn't improve the others. The increments below wire the loop.

> Honesty note: this plan is **not done**. Each increment below is marked with its status. I'll update the status as each ships and will never mark one done that isn't.

---

## Increment 1 — Close the agent learning loop in the runtime  ·  STATUS: BUILT — recall+record wired into runAgent
Make every agent self-improving by construction:
- **Recall (read):** before an agent runs, inject its recent lessons (success rate, improvements to apply, approaches that previously failed) + platform-wide insights into its prompt.
- **Record (write):** after a run, write the outcome to `AgentLearningMemory` (action, success, cost, tools used).
New file `agents-runtime/learning.ts` (`recallLessons`, `recordOutcome`); wired into `runAgent`. Reuses the existing `AgentLearningMemory` entity — no new table.

## Increment 2 — Shared cross-agent learning ("all data works together")  ·  STATUS: BUILT — `learningDistill` scheduled every 6h
A scheduled `learningDistill` function that reads `AgentLearningMemory` + `SurveySignal` + `AgentPerformanceLog`, distills concise **per-agent lessons** and **global platform insights**, and writes them back (under `agent_name:"__platform__"`) so *every* agent reads them via `recallLessons`. This is how one process's data improves all AI functions.

## Increment 3 — Route human-input surfaces through data-driven AI  ·  STATUS: BUILT — `humanInputHarvester` (games, mockup/site-layout, feature votes, PPC, business onboarding)
Ensure each human-input process emits signals and is informed by the loop. Most scaffolding exists — connect it:
- Surveys → already via `surveyIngest` ✓
- **Games:** wire `aiGameCreatorFromFeedback` + game-vote surveys to emit signals and pull learnings.
- **Site layout:** wire the mockup/feature-vote pipeline (`generateMockupVoteSurvey`, `featureMockupPipeline`) into the signal/learning loop so layout changes are data-driven.
- **Business onboarding / PPC:** route through the same signal emission.

## Increment 4 — Real outcome attribution (grounded success, not a heuristic)  ·  STATUS: BUILT — `attributeOutcomes` grounds success in DomainEvents
Increment 1 records a *provisional* success flag. This increment ties outcomes to real results (a payout approved, a referral converted, a retention win, a survey passing quality) via `DomainEvent`, and confirms/overturns the provisional flag — so "learning" reflects reality, not just "the run didn't error."

## Increment 5 — Learning dashboard + safety  ·  STATUS: BUILT — `learningInsights` + `manageLesson` (veto/pin) + `/AgentLearningDashboard`; recall honors veto/pin
Surface per-agent success trends and platform insights (reuse `AgentIntelligenceDashboard`), and add a guard so a bad "lesson" can't degrade an agent (human can pin/veto lessons; low-confidence lessons are advisory only).

---

### Honest caveats
- Increments 1–2 are high-value and tractable now. 3–4 depend on real outcome signals flowing, so their quality improves as the app runs.
- "Self-improving" here means **prompt-level** learning (agents steer by past outcomes) + config tuning — not autonomous model retraining. That's the right, safe scope for this stack.
- Provisional success (Increment 1) is deliberately weak until Increment 4 grounds it; the code says so.
