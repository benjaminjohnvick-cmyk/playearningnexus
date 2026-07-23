# AI Agent Oversight — Implementation Notes (Increment 1)

**What this is:** the first, safety-first increment of the "AI runs it, a human oversees" plan, built by **modifying your existing code** (it reuses the `AutomationReview` entity as the approval queue and `AppLog` as the audit trail — no new data model). Operating model: **AI proposes, survey data justifies, a human disposes.**

_Implemented July 23, 2026. Low-risk agent actions still run automatically (and are now audit-logged); money/account/irreversible actions are queued for human approval and do NOT execute until approved._

## Files added
- `backend/sdk/risk-policy.json` — the tunable policy: which actions are `critical` (always need a human), `high` (need a human above a money threshold), and the `sensitiveEntities` list. **This is the one file to edit to re-tier anything.**
- `backend/sdk/oversight.ts` — the gate. `gate(input)` either returns `{proceed:true}` (execute now) or creates a pending `AutomationReview` and returns `{proceed:false}` (stop). Also `needsApproval()` / `tierFor()`.
- `backend/functions/oversightApprove/entry.ts` — admin approves → marks approved → **re-invokes the original action** with an approval token so it executes.
- `backend/functions/oversightReject/entry.ts` — admin rejects → action never runs; kept for audit.
- `backend/functions/oversightPending/entry.ts` — lists the pending queue for the UI.
- `src/pages/AgentOversightQueue.jsx` — the overseer inbox: shows each proposal, its survey evidence, and the exact payload that will run, with Approve & Reject.

## Files modified
- `backend/functions/paypalPayout/entry.ts` — the money-movement chokepoint. A gate call was inserted after validation: every payout now queues for approval (HTTP 202 `pending_approval`) unless re-invoked with a valid `approvalToken`. **Because nearly all payout paths flow through `paypalPayout`, gating this one primitive covers the whole money surface.**
- `backend/agents-runtime/agent-runtime.ts` — agent tool-writes to sensitive entities now route through the gate; the agent is told the action was "queued for approval, not executed," so it can't assume success.
- `backend/functions/_manifest.json` — registers the three `oversight*` functions.
- `src/App.jsx` — routes `/AgentOversightQueue`.

## How it behaves
1. An agent (or a payout function) tries a sensitive action.
2. The gate checks `risk-policy.json`. Low-risk → runs immediately, logged to `AppLog`. Critical/high → a `pending_approval` record is written to `AutomationReview` and the action **stops**.
3. The proposal appears in **`/AgentOversightQueue`** (and, being an `AutomationReview` row, in your existing review dashboards).
4. Admin clicks **Approve** → `oversightApprove` re-invokes the original action, which now passes the gate and executes → status `executed`. Or **Reject** → status `rejected`, nothing runs.
5. Every step is written to `AppLog` for audit.

## How to tune (no code change)
Edit `backend/sdk/risk-policy.json`:
- Move a keyword between `critical` / `high` to re-tier actions.
- Raise `autoApproveMoneyUnder` (e.g. `5`) to let small payouts auto-clear once you trust the agents.
- Add/remove entity names in `sensitiveEntities` to widen/narrow what agent writes get gated.

## What this increment deliberately does NOT yet do (next increments)
- Wire the gate into **every** high-risk function individually (the coverage map lists ~70 critical + ~92 high). This increment covers the **shared payout chokepoint + all agent-initiated writes**, which is the majority of real risk for minimal effort; the same one-line `gate(...)` pattern applies to the rest.
- Per-agent cost/budget caps and model pinning.
- A dedicated survey-evidence pipeline (evidence is supported by the gate today; it's populated where the caller passes it).

See `AGENT-AUTONOMY-VIA-EXISTING-CODE` planning notes for the full phased list and the action-coverage map.
