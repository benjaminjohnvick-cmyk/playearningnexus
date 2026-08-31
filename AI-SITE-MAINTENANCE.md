# Site-Maintenance AI

The maintenance agent is the **sibling of the scaling advisor**, not part of it. Scaling asks *"is there
enough capacity right now?"* and reacts in seconds to load. Maintenance asks *"is the system healthy and
clean?"* and works on a slower beat. They are kept separate so a bug in one can't stall the other, but they
share **one** safety framework (`backend/sdk/agent-guardrails.ts`) instead of each re-implementing the rules.

## What it does

`maintenanceAgentRun` runs on a schedule (every 15 min) and gathers health signals — app errors in the last
hour, background jobs stuck "running" or ended "failed", records stuck "pending" past a staleness window, and
(when a monitor reports them) missed scheduler jobs, storage %, and secret/cert expiry. It runs the pure
decision core (`backend/sdk/maintenance.ts`), writes a `MaintenanceReport`, and optionally explains it in plain
English via the platform LLM. It **detects and proposes** — it does not decide actions on its own.

## The guardrail: what an agent may do about a finding

Every finding is tagged with an action-class, and one gate (`guardApply`) decides whether it may run:

- **observe** — informational only.
- **auto_safe** — reversible, non-sensitive, self-contained (re-queue a stuck non-money job, re-run a missed
  scheduler job). Applied automatically **only** if the operator turned on `MAINTENANCE_AUTO_APPLY_SAFE`;
  otherwise it still waits for a human.
- **needs_approval** — real but recoverable data changes (soft-archive stale records). **Never** automatic —
  always an explicit human confirm. Auto-apply does **not** satisfy this class.
- **manual_only** — the agent will **never** do it. Money, balances, payouts, tax, KYC, credentials/secrets,
  security settings, code changes, and any hard delete land here. The agent only flags them; a human acts.

Two lines make this hold even against a mislabeled or LLM-suggested proposal: a **denylist** clamps anything
that mentions money/identity/secrets/security/code/delete down to `manual_only`, and an **entity allowlist**
means an apply can only ever touch a short list of non-money entities. Nothing in the apply path calls
`db.remove` — "archive" is a soft flag a retention job acts on later. Every apply (or refusal) is written to
`AdminAuditLog`.

`maintenanceApplyProposal` is the single audited execution path; the agent and any operator UI both go through
it, so there is exactly one choke point for the guardrails.

## On-device (desktop & mobile apps)

Authoritative maintenance stays on the server, for the same reason money does — a user's device can't be
trusted to mutate shared state. What runs **on the device** is a lightweight local self-heal
(`deviceSelfHeal()` in `src/lib/resilient-mode.js`): it drops corrupt local-cache entries, trims a runaway
write queue, re-registers the service worker if the app shell broke, and flushes the queue on recovery. It runs
at app start and every time the app recovers to normal. It never mutates shared state and never touches
anything sensitive — the sensitive-action guard blocks money/identity in every mode.

## Gating

Everything is **OFF by default**. `MAINTENANCE_AGENT_ENABLED` (sensitive, gated) turns the agent on and gates
the apply endpoint; `MAINTENANCE_AUTO_APPLY_SAFE` (sensitive, gated, separate) is what lets the auto-safe class
run unattended. Both appear in the Setup Wizard's gated panel automatically. Thresholds
(`MAINTENANCE_ERROR_SPIKE_PER_HR`, `MAINTENANCE_STALE_PENDING_HOURS`, `MAINTENANCE_STUCK_JOB_HOURS`,
`MAINTENANCE_STORAGE_WARN_PCT`, `MAINTENANCE_SECRET_EXPIRY_WARN_DAYS`) are operator-tunable.

## Honest scope

This makes routine health a *managed, visible, mostly-self-clearing* thing instead of a surprise. It is not a
substitute for a human on the serious stuff: it cannot fix code, rotate a secret, or move money, and by design
it never will — those it surfaces for you.
