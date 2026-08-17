# For Your Attorney — Compliance Review Checklist

*A short hand-off of the items that need a lawyer's sign-off before launch or before a gated feature is
turned on. The platform is already built to the conservative posture described below; each item names the
exact switch that keeps it safe until you clear it. This document is a plain-English map for counsel, not
legal advice, and is current as of the 2026-08-15 compliance pass.*

## How the safeguards work

Nothing risky turns on by accident. Each area below is held behind an admin setting (a feature flag, a
provider selection, and/or a `*_LEGAL_SIGNOFF` boolean). The defaults ship in the safe position. Where a
setting is `default OFF` or `default false`, it cannot originate/operate until an admin deliberately flips
it — which is the point at which your written approval should be required.

## 1. Cash payouts / money transmission

- **Current posture.** Regular users are **closed-loop** — earnings stay as on-platform store credit and
  can never be cashed out. Real cash goes **only to business partners** (affiliates, developers,
  advertisers) as their revenue share. This is enforced at every money rail (PayPal/Venmo/Cash App and
  every automation), with tax backup-withholding and 1099 tracking wired in.
- **Switches.** `cash_out` (operational kill-switch) and **`CASH_OUT_LEGAL_SIGNOFF`** (default ON — a
  one-flip legal hold on all cash disbursement).
- **For counsel to confirm:** (a) that partner revenue-share payouts are vendor payments, not money
  transmission; (b) the partner-classification list is correct; (c) state money-transmitter / 1099-NEC /
  backup-withholding posture. If any of this needs to pause, set `CASH_OUT_LEGAL_SIGNOFF = false`.

## 2. Credit products (all OFF)

Three credit-style products exist only as gated scaffolding and **cannot originate** today. Each needs its
flag ON **and** a real licensed provider **and** its counsel sign-off set true:

- **Flexible Payment Terms** (0%, ≤4 installments) — `flexpay` flag, `FLEXPAY_PROVIDER`, `FLEXPAY_LEGAL_SIGNOFF`.
  Note the `self_financed` four-installment-exemption option specifically needs counsel to confirm the
  exemption applies for your states, buyer types, and amounts.
- **Tier 1 "Pay From Results"** (recourse) — `tier1_financed`, `TIER1_FINANCED_PROVIDER`, `TIER1_FINANCED_LEGAL_SIGNOFF`.
- **Goods Advance** (retired, non-recourse) — `goods_advance`, `ADVANCE_PROVIDER`, `ADVANCE_LEGAL_SIGNOFF`.
  Superseded by the no-debt **Save-to-Get**; kept only as gated code.
- **For counsel to decide:** whether to unlock any of these at all, and by which path (licensed lender vs
  bank-sponsored vs self-financed exemption), including disclosures and licensing. Until then, all stay OFF.

## 3. Prize competition (sweepstakes)

- **Current posture.** Winners are determined by **skill / verified merit** (not chance); a genuine
  **no-purchase-necessary (AMOE)** free entry with equal footing is offered; entrants must be **18+** and in
  a permitted jurisdiction; prizes at/above a state's threshold are **held for registration** before release.
  A live **Official Rules** surface is generated from settings (`contestOfficialRules`).
- **For counsel to confirm:** (a) approve the Official Rules wording; (b) confirm skill-based determination +
  AMOE adequately break the "consideration" prong in your target states; (c) handle state registrations/bonds
  where required (defaults flag FL/NY at $5,000, RI at $500, and block WA — confirm and extend). Threshold
  knob: `SWEEPSTAKES_REG_THRESHOLD`; per-state rules live in `backend/sdk/jurisdiction.ts`.

## 4. Under-18 / teen accounts (OFF)

- **Current posture.** Hard 18+ floor (`MIN_AGE = 18`). The household "teen" (13–17) concept is gated OFF
  (`teen_accounts`); enrollment is refused, the UI hides it, a known minor can't be added as an "adult," and
  parental/guardian consent is recorded if it's ever enabled.
- **For counsel to clear before enabling:** verifiable parental consent flow, minor-data handling (COPPA and
  state analogs), updated Terms/Privacy, and app-store age-rating change.

## 5. Earnings & advertising claims

- **Current posture.** No forward earnings promises: platform-authored projections are OFF
  (`earnings_projections`); results shown are hypothetical-until-substantiated (real figures publish only
  after a sample threshold, with basis). The "what-if" calculator is user-driven and labeled "not a
  prediction." The **$2,000 premium gift boost** advertising is drafted to FTC rules (accurate "up to,"
  clear-and-conspicuous disclosure, not "cash," not "free," not a rebate) in `PREMIUM-BOOST-ADVERTISING.md`.
- **For counsel to confirm:** the boost ad copy + disclosure wording, and that the substantiated-claims
  approach meets FTC endorsement/earnings-claim rules. Also confirm each ad network's incentive policies.

## 6. Privacy / behavioral analytics

- **Current posture.** Behavioral events + optional sampled interface screenshots are disclosed in the
  Privacy Policy (§5) with a working opt-out (`tracking_opt_out`) now honored across every capture surface,
  including the raw journey log. Full session-replay screenshots (`session_screenshots`) ship OFF.
- **For counsel to confirm:** session-replay / analytics disclosures against two-party-consent / wiretap
  (e.g. CIPA) exposure, and CCPA/GDPR posture for the data collected and the export/delete flows.

## 7. Pricing optics

- **Resolved.** The founding upgrade discount is **5.5% → $11,000 off** (net $189,000), deliberately not the
  $12,000 that equals the Tier 1 price, to remove any "return of capital" reading. The $2,000 boost is
  decoupled from the purchase (advertiser-pool-funded, not a rebate).
- **For counsel to confirm:** that the decoupled discount + boost read as promotional benefits, not returns
  of the amount paid. Knob: `FOUNDING_UPGRADE_DISCOUNT_PCT` (avoid setting back to exactly $12,000).

## 8. Tier 2 multi-year continuation (auto-renewal / commitment)

- **Current posture.** Tier 2 "Scale" can continue year over year up to **5 years** (`TIER2_TERM_YEARS`). A
  year is **binding** only when three things all hold: the advertiser **voluntarily opted in** up front to the
  multi-year term (recorded consent via `tier2AcceptMultiYear`, for consideration = the locked founding
  discount / bonus inventory), the year's **real attributed results ≥ `TIER2_CONTINUATION_RESULTS_MULT` × the
  year's cost** (default 1×), and they're still in term. A losing year — or an advertiser who never opted in —
  can **always exit** (never a coercive lock). Each annual renewal carries `TIER2_RENEWAL_NOTICE_DAYS` (30) of
  advance notice with a cancel window. The base Tier 2 remains pay-as-you-go (each part a separate purchase,
  nothing owed) — the commitment is a separate, opt-in overlay, not credit.
- **For counsel to confirm:** (a) the multi-year commitment agreement + its consideration are enforceable
  commercial terms in your states; (b) the auto-renewal mechanics (advance notice, cancel window, disclosure
  of the recurring charge) satisfy state auto-renewal laws (e.g. CA ARL) and the FTC negative-option rule;
  (c) that results-gated exit + up-front consent adequately avoid any unfair/UDAAP "lock-in" reading. Knobs:
  `TIER2_TERM_YEARS`, `TIER2_CONTINUATION_RESULTS_MULT`, `TIER2_MULTIYEAR_COMMITMENT_OPTIN`,
  `TIER2_RENEWAL_NOTICE_DAYS`.

## 9. Blanks to fill before launch

- `BUSINESS_MAILING_ADDRESS` (CAN-SPAM footer + winner-list/rules requests) — currently empty.
- `DMCA_AGENT_EMAIL` (designated agent) — currently empty.
- `TERMS_VERSION` — bump to force re-consent after counsel edits.
- Confirm/extend the per-jurisdiction rules in `backend/sdk/jurisdiction.ts` (which states you launch in).

## One-line summary for counsel

Everything money-, credit-, minor-, or chance-related ships in the conservative/off position behind a named
switch; we are asking you to (1) confirm the closed-loop + partner-payout posture, (2) approve the sweepstakes
Official Rules and any state registrations, (3) approve the boost advertising/disclosures, (4) confirm the
privacy/session-analytics disclosures, (5) tell us whether to ever unlock any credit product — and if so, by
which licensed path — and (6) confirm the Tier 2 multi-year commitment + auto-renewal terms for your states.
