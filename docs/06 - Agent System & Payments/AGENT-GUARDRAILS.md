# AI Agent Guardrails — Model Pinning & Cost Caps (Increment 3)

**What this adds:** non-money safety rails on the agent runtime — a pinned model per agent and hard USD spend caps — so an agent can't quietly run up a huge model bill or run on the wrong (expensive) model. Reuses the existing `AgentPerformanceLog` entity for metering; no new table.

_Implemented July 23, 2026. Tune everything in `backend/agents-runtime/agent-guardrails.json` — no code change needed to move an agent's model or change a cap._

## Files
- **`backend/agents-runtime/agent-guardrails.json`** (new) — the control panel: `defaultModel`, model `aliases` (so `"automatic"`/`"large"`/`"small"` resolve to real model ids), a `pricing` table (USD per 1K tokens), global `defaults` (`dailyUsdCap`, `perRunUsdCap`, `maxSteps`), and `perAgent` overrides.
- **`backend/agents-runtime/guardrails.ts`** (new) — `resolveModel()`, `capsFor()`, `costOf()`, `spentTodayUsd()`, `logUsage()`.
- **`backend/agents-runtime/agent-runtime.ts`** (modified) — resolves the model per agent, checks the daily budget before starting, meters every LLM call's real token cost, logs it, and stops the run the moment a per-run or daily cap is reached.

## How model pinning works
Resolution order for each agent: **`perAgent.model` → the agent's `model` in `agents.json` → `defaultModel`.** Aliases are mapped, so the many agents currently set to `"automatic"` now resolve to a real, explicit model instead of silently falling back. Example: `auto_social_content_agent` is pinned to `gpt-4o-mini` (cheap, fine for content), while `auto_fraud_resolution_agent` is pinned to `gpt-4o` (needs the stronger model).

## How cost caps work
1. Before an agent starts, the runtime sums its **spend so far today** (UTC) from `AgentPerformanceLog`. If it's already at its `dailyUsdCap`, the run is refused with a clear message — it does **not** call the model.
2. After **each** LLM call, the runtime reads the real `usage` (prompt/completion tokens), computes USD from the `pricing` table, logs it, and adds it to the run total.
3. If the running total crosses the agent's `perRunUsdCap`, or today's total crosses its `dailyUsdCap`, the run **stops immediately** and returns `blocked: true` with the amounts — no further model calls.

Every agent response now also returns `cost_usd` and `model`, so callers and dashboards can see what each run cost and which model it used. Because usage is written to `AgentPerformanceLog`, your existing `AgentIntelligenceDashboard` / `AIAutomationLearningDashboard` can chart spend with no change.

## Defaults (tune freely)
- Global: `$10/day` per agent, `$1.50/run`, `6` steps.
- Per-agent examples: `admin_superagent` $50/day (gpt-4o, 8 steps); content/support agents on `gpt-4o-mini` at $5–8/day.

## To change anything (no code)
Edit `agent-guardrails.json`: pin a different model per agent, raise/lower a cap, or update the `pricing` numbers if provider prices change or you switch providers. Add a new `perAgent` entry to override just that agent.

## Honest notes
- Pricing is a static table — keep it roughly current so the meter stays accurate; it does not auto-fetch live prices.
- Caps are enforced **between** LLM calls (the natural checkpoint), so a single in-flight call always completes; the cap stops the *next* call. With the per-run token sizes here that means at most one extra call's worth of spend beyond a cap.
- Metering sums `AgentPerformanceLog` rows for the day; at very high volume you'd swap that for a rolling daily counter (same interface), but for current scale the sum is fine.
