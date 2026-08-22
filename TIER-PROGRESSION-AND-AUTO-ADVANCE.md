# Tier Progression & Auto-Advance — one-tap renewal + opt-in tier advancement (up to 5 years)

Advertisers can renew and climb the tier ladder (Tier 1 → Tier 2 → Tier 3) over up to five years, driven by
their **measured** results. Two mechanisms: a one-tap **renewal** of the same tier, and an opt-in
**auto-advance** to the next tier when a measured ROI threshold is hit.

## The ladder (admin-tunable)

- **Tier 1 + Tier 2 combined: up to 2 years** (`TIER12_MAX_YEARS`).
- **Tier 3: up to 3 years** (`TIER3_MAX_YEARS`).
- **Total: 5 years** (`TIER_MAX_TOTAL_YEARS`).

Years are banked as the advertiser renews/advances; the engine enforces every cap.

## One-tap renewal ("see your results → Agree")

At each year-end, `advertiserProgressionStatus` shows the advertiser their **measured** results — ROAS, ROI,
and how much of their advertising was delivered — and whether it's "going well" (measured ROAS ≥ baseline AND
delivery on track). If they want to continue, they push **Agree** (`advertiserRenewAgree`): the same tier
renews for another year at the **same locked price**, a year is banked toward the caps, and the consent is
recorded. An advance renewal notice precedes billing (auto-renewal law); the advertiser can cancel anytime.
This is a one-tap agreement — never a silent charge.

## Opt-in auto-advance ("if my ROI reaches X, advance me")

At signup (or anytime), an advertiser can opt in via `advertiserSetAutoAdvance`: *"if my measured ROAS reaches
X, advance me to the next tier."* When the scheduled sweep (`advertiserProgressionSweep`) sees a term boundary
and the advertiser's **measured** ROAS is at/above their threshold (and there's year-cap headroom), it posts an
**advance notice**; once the notice window elapses and it wasn't declined, it applies the advance (moves the
tier; billing runs on the normal path). Progression continues Tier 1 → 2 → 3 automatically within the caps.

## The two compliance calls (same spine as the rest of the platform)

1. **ROI is measured, never guaranteed.** Every "going well" and every auto-advance trigger reads the
   advertiser's **measured** ROAS/ROI from `advertiser-metrics.ts` (real platform data, marked
   not-yet-substantiated below the data threshold). The engine *reacts to* results; it never promises them.
2. **Auto-advance to a higher-priced tier is not silently default-on.** Auto-renewing the *same* tier at the
   *same* price with a see-results-and-agree tap is fine to default. But **auto-advancing** to Tier 2 (~$217k)
   or Tier 3 — auto-charging a much larger amount — is a **negative-option-billing** risk under the FTC's
   click-to-cancel rule and state auto-renewal laws.
   **Current setting (owner decision, pending counsel review): `TIER_AUTOADVANCE_DEFAULT_OPT_IN = 1` (ON).**
   Advertisers are auto-opted-in to advance when their measured ROAS threshold is met, **unless they explicitly
   opt out**. It is disclosed at signup (`foundingDisclosures.tier_auto_advance`), each advance fires a
   **pre-charge notice** the advertiser can decline, and they can opt out anytime. The mitigations (measured
   trigger, advance notice, easy opt-out, conspicuous signup disclosure) are what make a default-on posture
   defensible — but the default-on decision is the owner's, to be confirmed with counsel.

> ⚠️ **ACTION FOR COUNSEL (owner is scheduling this):** confirm whether **default opt-in** auto-advance is
> permitted at signup in your target states, the required advance-notice period and cancellation mechanics under
> the auto-renewal laws, and the exact disclosure copy. **If not approved, set `TIER_AUTOADVANCE_DEFAULT_OPT_IN`
> back to `0`** (advertisers then advance only if they explicitly opt in). Nothing else in the engine changes.

## What's coded

- **`backend/sdk/tier-progression.ts`** — pure, unit-tested core: ladder + caps, `nextTier`, `yearsAccounting`,
  `evaluateResults` (measured "going well"), `renewalEligible`, `advanceEligible` (opted-in + measured ROAS ≥
  threshold + headroom), `progressionDecision`, and the `renewalPatch` / `advancePatch` transitions (which never
  move money). 7 tests.
- **Functions** — `advertiserProgressionStatus` (results + options), `advertiserRenewAgree` (one-tap renew),
  `advertiserSetAutoAdvance` (explicit opt-in + threshold), `advertiserProgressionSweep` (scheduled: advance
  notices → apply after the window, renewal offers, cap enforcement). Registered in `_manifest.json`.
- **Settings** — `TIER_PROGRESSION_*` / `TIER_AUTOADVANCE_*` (ladder years, renewal baselines, default opt-in
  OFF, default ROAS threshold, notice days).
- **Schema** — `TierProgressionEvent` (audit log of renewals, advance notices/applies, completions). State
  lives on the advertiser's `FoundingAdvertiser` record; billing/provisioning integrates with the existing tier
  modules.
