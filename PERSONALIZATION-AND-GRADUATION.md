# Personalized learning + graduation (option b)

How an AI-suggested change becomes a per-user improvement, then a site-wide one — kept statistically
honest, applied at login, no downtime, across web + PWA + native.

## The flow

1. **Suggest.** The optimizer proposes a small, in-bounds, non-sensitive change (money/compliance never
   enter this path).
2. **Test on a segment first.** With `OPTIMIZER_SEGMENT_TESTING` on, the change is opened as a live A/B
   scoped to the **most active user segment** (`optimizer.ts` → `targetSegment` → `topBaseSegment`).
   Segments come from behavior + top KYC interest (`personalization.ts` → `userSegment`), e.g. `engaged`
   or `engaged:electronics`. Base-segment tests cover their interest sub-segments (prefix match).
3. **Measure across the segment (not one user).** The live engine aggregates outcomes across ALL users
   in the segment and requires **statistical significance + a minimum sample + no guardrail regression**
   before it decides. This is what keeps "personalized" from meaning "reacted to one person's noise."
4. **Keep it for that segment.** A segment winner is **promoted as segment-kept** — it is NOT flipped
   globally. Instead its winning value is applied per-user, at login, to everyone in that segment
   (`resolveVariantOverrides` merges segment-kept promoted experiments). This is the per-user
   "kept change" layer.
5. **Apply at next login (quiet-swap).** `sessionStart` (login + native app-resume) resolves the user's
   effective variants; `sessionEnd` (logout) closes the session. A change that became a winner while the
   user was away is applied at their **next** login — never mid-session.
6. **Graduate a big win to the whole site.** If a segment winner's lift ≥ `GRADUATION_LIFT_PCT`, it's
   nominated (`nominateGraduation`); the scheduled `graduationScan` opens a **site-wide 24h validation**
   experiment. If that clears significance + guardrails, the normal tick **flips it globally** — a
   no-downtime config change every platform (web, PWA, native) reads at request time.

## Why it stays statistically valid

- Decisions are made on the **aggregate across a segment's users**, gated by `SEGMENT_MIN_SAMPLE` and the
  live engine's significance test — never on a single user's handful of events.
- Site-wide graduation requires a **second** independent 24h test across the whole base, so a
  segment-specific fluke can't flip the global default.
- One lever at a time; every change is bounded, reversible (one flip), and audited.

## Reaching web + PWA + native with no store review

- Config/flag/UI-variant promotions are read at request time, so they reach installed **native** apps on
  next login/resume with **no App Store review** — `native.js` re-pulls variants on `appStateChange`.
- Human-built **web code** changes reach installed native apps via the OTA channel
  (`MOBILE-OTA-LIVE-UPDATES.md`) — also no review.
- Only genuinely **native** additions (new plugin/permission) need a store release.

## Controls

- Flags: `personalized_learning`, `live_experiments`. Settings: `OPTIMIZER_SEGMENT_TESTING`,
  `GRADUATION_LIFT_PCT` (15%), `SEGMENT_MIN_SAMPLE` (50), plus the live-test window/share/min-sample.
- Functions: `sessionStart`, `sessionEnd`, `graduationScan`, and the live-experiment functions.
- Money/compliance settings are refused from every auto path and stay human-gated.

## Honest limits

- A truly per-**single**-user significant result is rare in 24h, so personalization is **segment-level**
  (users like you), which is the statistically sound reading of "applied to a user in real time."
- Low-traffic segments may not reach significance and will expire to control rather than promote on thin
  data (raise the window or lower the segment granularity).
