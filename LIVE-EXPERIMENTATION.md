# Live Experimentation — test on real traffic, promote if better, no downtime

This is the "run the AI's proposed change for a window, keep it only if the live data agrees, promote
with no downtime, steer it in real time, and roll it out per-user during inactivity" system. It sits on
top of the existing optimizer + settings/flags layer and complements the survey-based
`OptimizationExperiment` (which asks customers what they'd prefer) by measuring **what customers
actually do**.

## The core idea: a change is data, not code

Every promotable change is a config value read at request time (`settings.ts` / `feature-flags.ts`), or
a UI variant selection the client reads. So:

- **Promote = flip a config row** → takes effect in seconds, no build, no downtime.
- **Revert = flip it back** → instant and free.
- Genuinely new components are **pre-shipped behind a flag**; the engine only ever *chooses* among
  bounded, already-deployed options. It never writes or deploys code.

## Lifecycle of one experiment

1. **Propose.** The optimizer proposes a small, in-bounds change (`optimizer.ts`). Non-sensitive
   proposals are routed to a **live holdout** (`applyOrQueue` → `createLiveExperiment`). Money/compliance
   -sensitive proposals never enter — they stay on the human-approval path.
2. **Assign (sticky, quiet-swap).** Each user is deterministically bucketed the first time they're seen
   for the experiment — i.e. at a session boundary, while inactive — so no running user's UI shifts
   mid-session (`assignVariant`). Opted-out users (`tracking_opt_out`) are always control and never
   measured.
3. **Apply at request time.** `resolveVariantOverrides` returns the user's effective settings/flags/UI
   overrides; `liveVariants` (client) applies UI variants once per session.
4. **Measure.** `recordVariantMetric` (client + server flows) reports outcomes (`purchase`,
   `add_to_cart`, `click_through`, …) and guardrails (`refund`, `complaint`, `drop_off`), attributed to
   the user's variant.
5. **Monitor in real time.** `liveExperimentTick` (scheduled every ~10 min) runs `tickExperiment`:
   - **Circuit breaker** — any guardrail regression beyond its threshold → instant halt + revert.
   - **Bandit traffic-shift** — traffic moves toward the better arm in proportion to the posterior
     probability it's better (`nextShare`), so exposure self-tunes on the fly.
   - **Canary ramp** — a healthy variant advances 5% → 25% → 50% → 100%.
   - **Decision** — a statistically significant winner promotes (early, or at the window); a significant
     loser reverts; an inconclusive test expires to control at the window end (conservative).
6. **Promote / revert (no downtime).** `promoteExperiment` flips the setting/flag/UI config;
   `revertExperiment` stops exposing the variant (control was never changed). Both are audited.

## Statistical rigor (honors "small, iterative, statistically-backed")

- **Two-proportion z-test** for the objective rate + a **normal-approx posterior** for *P(variant beats
  control)* (`compareArms`) — no dependencies.
- Promotion requires **significance (p < 0.05)** AND a **minimum sample** per arm
  (`SELF_LEARNING_MIN_SAMPLE`) AND **no guardrail breach**. Early stop only on a strong posterior
  (≥ 0.95 / ≤ 0.05), which keeps sequential peeking safe.
- One lever at a time; changes stay incremental and reversible.

## Safety & privacy

- **Money/compliance never auto-promote.** `COMPLIANCE_DENYLIST` and any `sensitive` setting are refused
  at creation; those remain human-gated recommendations.
- **Bounds** — variant values are clamped by the registry min/max via `setSetting`.
- **Audit** — every promote/revert/halt writes `AdminAuditLog`.
- **Privacy** — assignment + measurement ride the existing behavioral opt-out; opted-out users sit in
  control.

## Settings & flags

- Flag `live_experiments` (default on) · setting `OPTIMIZER_LIVE_TEST` (default on).
- `LIVE_TEST_WINDOW_HOURS` (24) · `LIVE_TEST_START_SHARE` (0.10) · `SELF_LEARNING_MIN_SAMPLE` (30).

## Functions

`liveExperimentCreate` (open a non-sensitive test) · `liveVariants` (request-time applier + exposure) ·
`recordVariantMetric` (outcome/guardrail) · `liveExperimentTick` (scheduled monitor) ·
`liveExperimentPromote` (manual promote/revert) · `liveExperimentStatus` (dashboard).

## Adopting a UI variant in a component

```jsx
import { useVariant } from '@/components/experiments/VariantProvider';
const cta = useVariant('marketplace_buy_cta', 'control');
return <Button>{cta === 'variant' ? `Buy · ${price}` : price}</Button>;
```

Ship both branches once; the engine and an admin decide which is live. `Marketplace.jsx` is wired as the
reference adoption (buy-CTA variant + `purchase`/`click_through` outcome reporting).

## Honest limits

- **Low-traffic experiments may not reach significance in 24h** → they expire to control (safe default)
  rather than promote on thin data. Extend `LIVE_TEST_WINDOW_HOURS` for slow surfaces.
- **Truly new features still need a human to build + pre-ship the variant once**; everything after —
  choose, test, promote, revert — is autonomous and instant.
- **No new paid services**; the monitor is cheap aggregate math and stays under `AI_DAILY_SPEND_CAP_USD`.
