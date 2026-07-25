# Autonomous Triggers + Survey-Evidence Pipeline (Increments 4 & 5)

The final two pieces of the agent plan: agents that **run themselves** (on a schedule and in response to events), and a **survey-evidence pipeline** so every action an agent proposes carries the survey data that justifies it. Built on your existing scheduler and survey entities.

_Implemented July 23, 2026. Everything here still flows through the earlier safety layers — agent actions pass the oversight gate (money/fraud queue for a human) and the per-agent cost caps. Autonomy was added on top of the guardrails, not around them._

## Increment 4 — Autonomous triggers & scheduling

**Scheduled agents.** The scheduler (`backend/scheduler/main.ts`) already ran *functions* on cron; it now also runs *agents*. `backend/scheduler/agent-schedules.json` lists which agent runs when (fraud sweep every 4h, retention daily, support triage every 2h, survey-quality every 6h). Each fires the agent via `/agents/<name>` with a service token — same proven mechanism the function scheduler uses.

**Event-driven triggers.** `backend/sdk/events.ts` adds a lightweight domain-event bus. `emitEvent(type, payload)` records a `DomainEvent` row and fires any agents subscribed to that event in `backend/agents-runtime/agent-triggers.json`. So an agent can react to *what happens* — a new survey signal, a fraud flag, a churn-risk signal — not only to the clock. Subscriptions ship for `survey.signal.created`, `fraud.flag.raised`, `payout.threshold.reached`, `user.churn_risk`, and `support.ticket.opened`; add a type + agent list to wire more.

Every triggered agent still runs through the oversight gate and cost caps, so scheduled/event autonomy stays safe: a scheduled fraud agent that wants to ban someone still queues for your approval.

## Increment 5 — Survey-evidence pipeline

This makes the site genuinely "survey-data-driven": agents act on normalized, quality-scored survey facts, and every proposal shows the facts behind it.

- **New tables** (in `backend/db/schema.sql`): `SurveySignal` (a normalized, quality-scored fact from a response), `SurveyEvidence` (links an action to the signals that justified it), and `DomainEvent` (the event log).
- **`backend/functions/surveyIngest/entry.ts`** — reads recent survey responses, quality-gates each (reusing your existing `scoreSurveyResponse`), writes a `SurveySignal` for the ones that pass, marks the response processed, and **emits `survey.signal.created`** — which triggers the survey-quality agent. Runs hourly (added to `schedules.json`) or on demand.
- **`backend/sdk/survey-evidence.ts`** — `gatherEvidence({userId, topic})` returns the relevant recent signals; `linkEvidence()` records which signals justified an action.
- **Wired into the agent gate:** when an agent proposes a sensitive action, the runtime now auto-attaches the user's recent survey signals as `evidence`, so the proposal that lands in your Oversight Queue shows *why* — the survey data behind it — not just *what*.

## How the whole loop now works
1. `surveyIngest` turns raw responses into quality-scored **SurveySignals** and emits an event.
2. The event **triggers** the survey-quality agent (and schedules fire other agents autonomously).
3. When an agent wants to do something sensitive, it **proposes** the action with its **survey evidence** attached.
4. Money/fraud actions **queue for your approval** (with the evidence visible); low-risk actions auto-run.
5. Every step is metered (cost caps) and logged (audit).

That is the full vision: **AI runs it, survey data justifies it, a human oversees it.**

## One-time step when deploying
The three new tables are additive. On an existing database, apply them by re-running the (idempotent) schema:
```
psql "$DATABASE_URL" -f backend/db/schema.sql
```
(`CREATE TABLE IF NOT EXISTS` means existing tables are untouched.)

## Files
New: `backend/sdk/events.ts`, `backend/sdk/survey-evidence.ts`, `backend/agents-runtime/agent-triggers.json`, `backend/scheduler/agent-schedules.json`, `backend/functions/surveyIngest/entry.ts`.
Modified: `backend/scheduler/main.ts`, `backend/scheduler/schedules.json`, `backend/agents-runtime/agent-runtime.ts`, `backend/functions/_manifest.json`, `backend/db/schema.sql`.

## Honest notes
- The event bus is in-process (one backend). For multi-instance scale, back `emitEvent` with SQS + a worker — same interface, no call-site changes.
- `surveyIngest` defaults its source to `FeedbackSurveyResponse`; pass `source_entity` to ingest from another response table, and tune `min_quality`.
- Scheduled agents start conservative on purpose — widen cadence/scope as each agent earns trust.
