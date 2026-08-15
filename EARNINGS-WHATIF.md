# Earnings What-If — the user's own scenario calculator (no platform claim)

*The compliant replacement for platform-made earnings projections. The USER supplies the assumptions; the
scenario is computed only from their own actual history and the site rate, and is always labeled "not a
prediction or promise." The platform asserts nothing. Not legal advice.*

## Why this is lawful where a projection isn't

A platform saying "you'll earn $X" is a regulated **earnings claim** (FTC) that must be substantiated. A
**calculator the user runs on their own numbers** makes no claim — it does arithmetic on inputs the user
chose, grounded in their own real history. The platform never states what anyone will earn. Every result
carries `EARNINGS_WHATIF_DISCLAIMER`.

## How it works

- The user enters their own assumptions: minutes/day (optional), over N days, and/or a target.
- The scenario's daily figure = their chosen effort × the site's per-minute rate (capped by the daily cap),
  or — if they don't specify effort — their OWN recent daily average from history.
- It shows days-to-target and total-over-days, plus the personal facts it stands on (their recent daily
  average, active days, the site rate, the cap), and the not-a-promise disclaimer.

## Where it lives in code

- Flag: `earnings_whatif` (ON) — distinct from `earnings_projections` (platform claims), which stays OFF.
- Settings: `EARNINGS_WHATIF_WINDOW_DAYS` (90), `EARNINGS_WHATIF_DISCLAIMER`.
- Model: `backend/sdk/earnings-whatif.ts` — `computeWhatIf` (pure), `userWhatIf` (reads the user's `earnHistory`).
- Function: `earningsWhatIf` (auth). Page: `/EarningsWhatIf`.
