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

## 9. Tier 2 upfront deposits (prepayment / unearned revenue)

- **Current posture.** An advertiser may **prepay a full year (or term)** of Tier 2 upfront
  (`TIER2_DEPOSIT_ENABLED`). This is a **prepayment** — they pay the platform now, so it is **not credit, not a
  loan, not money transmission** (the opposite of the retired pay-at-year-end idea). Because delivery is
  capacity-paced, the deposit is treated as **unearned revenue**: it's recognized only as impressions actually
  deliver, and any allotment still undelivered at term end is **made good** (delivery extended until served) or
  **refunded pro-rata** (`TIER2_DEPOSIT_MAKEGOOD_MODE` = extend | refund). The advertiser always gets every
  impression paid for, or their money back for the shortfall. Terms are disclosed and consent recorded at
  purchase (`tier2Deposit`); delivered-vs-paid and any refund owed are shown by `tier2DepositStatus`.
- **For counsel to confirm:** (a) the unearned-revenue treatment and the make-good/refund terms are adequate
  for your states; (b) any large-prepayment / advance-fee rules that could apply to taking a full year upfront;
  (c) the deposit disclosure is clear and conspicuous. Knobs: `TIER2_DEPOSIT_ENABLED`, `TIER2_DEPOSIT_MONTHS`,
  `TIER2_DEPOSIT_MAKEGOOD_MODE`, `TIER2_DEPOSIT_REFUND_UNDELIVERED`.

## 10. Delivery guarantee & make-good (all tiers)

- **Current posture.** Each advertising seat carries a **delivery guarantee**: a defined volume of ad
  impressions the platform commits to serving over the seat's term (defaulting to the tier's inventory-governor
  allotment, so we never guarantee more than we can serve). This guarantees the **advertising we deliver** —
  which we measure on our own surfaces — and is **explicitly not** a guarantee of the advertiser's revenue,
  sales, conversions, or ROI. If delivery falls short at term end, a **make-good** tops it up with **free
  inventory** until the guaranteed volume is served. The make-good is **bounded two ways**: by volume (never
  more than what was sold) and by time (`DELIVERY_GUARANTEE_MAX_EXTENSION_MONTHS`). It moves no money — a
  shortfall is remedied with advertising, not a cash payment. On by default (`DELIVERY_GUARANTEE_ENABLED`);
  status shown by `deliveryGuaranteeStatus`, trued-up by the daily `deliveryMakeGoodSweep`.
- **For counsel to confirm:** (a) that a delivery/impression guarantee with a free make-good is a clean
  service-level commitment and reads clearly as guaranteeing *delivery, not results*; (b) the customer-facing
  wording ("we guarantee your ad delivery… if we fall short we make it up free") carries no implied
  performance/ROI promise; (c) whether any make-good terms should be in the written advertising agreement.
  Knobs: `DELIVERY_GUARANTEE_ENABLED`, `DELIVERY_GUARANTEE_TERM_MONTHS`, `DELIVERY_GUARANTEE_GRACE_DAYS`,
  `DELIVERY_GUARANTEE_MAX_EXTENSION_MONTHS`, `DELIVERY_GUARANTEE_TIER1_IMPRESSIONS`,
  `DELIVERY_GUARANTEE_TIER2_IMPRESSIONS`.

## 11. Value-stack claims — Tier 1 ("$12k → $24k") and Tier 2 ("$200k → $400k") in advertising value

- **Current posture.** The Tier 1 / founding offer is marketed as **$12,000 buys ≥ $24,000 of advertising
  value** (`TIER1_VALUE_STACK_ENABLED`, default 2× target). The $24,000 is placed **entirely on the
  value-delivered side** — the conventional market value of real deliverables (impressions at ~$22 CPM,
  placements, creative, managed service), itemized by `tier1ValueStack` and rendered on the `/Apply` page. It
  is **not** tied to the advertiser's revenue (we deliberately did **not** build "free ads until you earn
  $24k," which would be an unbounded, unmeasurable performance guarantee). At default settings the honestly
  valued lines total ~$25,500 (~2.1×); if an admin trims values below target, the stack **adds guaranteed
  value-match impressions** (real advertising) to reach the number rather than inflating a rate, and those
  impressions are folded into the delivery guarantee (§10). Approved positioning language and prohibited
  phrasings are in `TIER1-VALUE-STACK.md`.
- **For counsel to confirm:** (a) that a "$X in advertising value" claim, substantiated by conventional rate
  card values and backed by the delivery guarantee, is defensible under FTC value/comparative-price guidance;
  (b) the per-line conventional values are supportable (esp. the CPM and the managed-service lines); (c) the
  approved copy never crosses into an implied revenue/ROI promise. Knobs: `TIER1_VALUE_STACK_ENABLED`,
  `TIER1_VALUE_MULTIPLE_TARGET`, `TIER1_VALUE_CPM_USD`, and the per-line `TIER1_VALUE_*` values.
- **Tier 2 — same posture, larger ticket.** Tier 2 "Scale" is marketed as **$200,000 buys ≥ $400,000 of
  advertising value** (`TIER2_VALUE_STACK_ENABLED`, 2× target). The $400,000 is the A–D rate card at
  conventional rates (now ~$404,300, up from ~$282,400 via a balanced mix of more media + research/service —
  see `TIER2-VALUE-STACK.md`); the delivery-driving settings were raised in lockstep so what's valued is what's
  delivered and guaranteed. It is **not** a $400,000 return/revenue/ROI claim (we did **not** build "a $400k
  return"). Same value-match safeguard and delivery-guarantee backing as Tier 1. Given the six-figure ticket,
  have counsel specifically confirm the value substantiation (esp. the CPM and managed-service line values) and
  that no Tier 2 sales copy implies a financial return. Knobs: `TIER2_VALUE_STACK_ENABLED`,
  `TIER2_VALUE_MULTIPLE_TARGET`, `TIER2_VALUE_CPM_USD`, and the `TIER2_*` quantity settings.
- **Tier 3 Unlimited — uncapped scaling.** Advertisers can scale above the $200k base to any budget; the package
  scales proportionally at the same ~2× advertising-value ratio (`TIER3_UNLIMITED_ENABLED`, see `TIER3-UNLIMITED-SPEC.md`).
  Two guardrails keep it safe: it's **prepaid upfront** (not credit) and **capacity-paced** (guaranteed as a
  total, delivered as the audience grows, backed by the delivery guarantee — never oversold). Still advertising
  value delivered, never a return. For counsel: confirm the uncapped-scaling copy carries no revenue/ROI
  implication, and that prepaid + capacity-paced delivery of a large custom package is a clean advertising sale
  (not an investment/return product). Knobs: `TIER3_UNLIMITED_ENABLED`, `TIER3_UNLIMITED_MIN_USD`, `TIER3_UNLIMITED_MAX_USD`.

## 11b. Full-Value Delivery Guarantee (all tiers)

- **Current posture.** Every advertiser tier is backed by a standing guarantee (`FULL_VALUE_GUARANTEE_ENABLED`,
  default ON): the advertiser **prepays in full** (prepayment, not credit), and the platform **keeps delivering
  the promised advertising with no time cap until the full dollar amount of advertising is delivered** — a
  **make-good** remedy (more delivery), **not** a refund. The "dollar amount" is advertising VALUE
  (impressions/placements at a conventional CPM) that the platform measures and controls; it is **never** the
  advertiser's revenue/sales/ROI, and there is **no results/money-back guarantee**. The refund backstop ships
  **OFF** (`FULL_VALUE_GUARANTEE_REFUND_BACKSTOP=false`) — the offer is make-good only. See
  `FULL-VALUE-DELIVERY-GUARANTEE.md` (also the customer agreement/disclosure terms to finalize).
- **For counsel to confirm:** (a) that a prepaid, deliver-until-fulfilled advertising guarantee (make-good only)
  is a clean service-level commitment with no credit or performance-guarantee character; (b) the customer
  agreement/disclosure wording, especially the over-time delivery disclosure (delivery may extend beyond the
  initial term as the audience grows) and the plain statement that it covers advertising delivery, not results;
  (c) if the refund backstop is ever enabled, the refund terms (undelivered-only, bounded, processor-window).
  Knobs: `FULL_VALUE_GUARANTEE_ENABLED`, `FULL_VALUE_GUARANTEE_REFUND_BACKSTOP`, `FULL_VALUE_GUARANTEE_CPM_USD`.

## 12. Tax / 1099 reporting on partner cash payouts

- **Current posture.** Business partners paid real cash (developers, affiliates, creators) run through a 1099
  pipeline: W-9 collection (`submitTaxInfo` → owner-scoped `TaxProfile`, certification logged to the consent
  ledger), per-payee annual reportable-payout tracking from the money ledger, **24% backup withholding**
  (`TAX_BACKUP_WITHHOLDING_RATE`) auto-applied on every payout rail when no W-9 is on file at/over the **$600**
  threshold (`TAX_1099_THRESHOLD`), a self-service status page (`taxProfileStatus` + Tax Center UI), and a
  filing-ready 1099-NEC export (`tax1099Export`, box 1 gross + box 4 withheld). Users (closed-loop, non-cashable)
  generate no 1099s. Raw TINs are masked everywhere except an explicit admin full-TIN export for the filing
  provider. See `TAX-1099-PIPELINE.md`.
- **For counsel/tax pro to confirm:** (a) the $600 1099-NEC threshold and 24% backup-withholding rate/mechanics
  are correctly applied for your facts; (b) TIN handling/storage meets your security + state obligations (this
  build masks and flags for provider hand-off — confirm encryption-at-rest or provider custody before real
  TINs are collected); (c) which 1099 filing provider and any state filing/TIN-matching requirements;
  (d) whether any payout types beyond the reportable set should be included/excluded. Knobs: `TAX_1099_THRESHOLD`,
  `TAX_BACKUP_WITHHOLDING_RATE`.

## 13. DMCA + user-uploaded content license

- **Current posture.** Rights-holders can file a §512(c)(3) takedown (`dmcaTakedownRequest`, public); admins
  resolve (`dmcaResolve`); a user whose content was removed can file a §512(g) counter-notice
  (`dmcaCounterNotice`). At upload, users now certify they own/are licensed to their content and grant a
  display-only license (`content-license.ts` / `recordContentLicense`), captured on the ad-creative paths and
  logged to the consent ledger. Full DMCA safe-harbor still requires the registered designated agent (a
  YOU/LAWYER item — Copyright Office registration).
- **For counsel to confirm:** the takedown/counter-notice copy and the upload license-grant wording, and that
  the designated-agent registration is filed so the safe harbor attaches.

## 13b. Advertiser billing, 30-day cancellation & Site-Cash auto-apply

- **Current posture.** Every advertiser tier **prepays the full 52 weeks up front** in a single charge (one
  prepayment recognized across 13 four-week cycles — `billing-schedule.ts`). **No recurring auto-charge / no
  auto-renew was built**, so there's no negative-option exposure on this path. A **30-day proportional
  cancellation** (`advertiser-cancellation.ts` / `advertiserCancel`) lets an advertiser cancel within 30 days of
  purchase and recover **one-third** (we keep two-thirds; at the 13-period price Tier 1 = keep $8,666.67 / refund
  $4,333.33, computed from what was actually paid); the
  non-refundable portion is disclosed and consent-logged (`ConsentRecord kind:"advertiser_cancellation"`) before
  it applies, and the refund is issued as **closed-loop site credit** (`refund_credit_balance`), never cash/card.
  It coexists with — and is independent of — the Full-Value Delivery Guarantee (§11b), which governs after the
  window. **Site Cash** (non-cashable points) now **auto-applies** to purchases at checkout, bounded by the
  purchase total and the existing per-transaction spend cap; it only offsets a purchase and is never withdrawable.
- **13-period (four-week) pricing.** With `BILLING_13_PERIOD_PRICING` on (default), a fixed-price tier's annual
  is 13 four-week periods rather than 12 months — a +8.33% uplift (Tier 1 $12,000 → $13,000; Tier 2 $200,000 →
  $216,666.67). Delivered advertising value scales with the price (value stacks target 2× of the new price), so
  the ~2× substantiation holds. It is disclosed as "billed in 13 four-week cycles," never "monthly."
- **For counsel to confirm:** (a) the 30-day cancellation terms + the clear-and-conspicuous disclosure of the
  non-refundable two-thirds before purchase and at cancellation; (b) that the full-year prepayment is properly
  treated as unearned revenue recognized over the term (ties to §9); (c) that the closed-loop refund-credit
  remedy (no cash refund) is acceptable for advertiser cancellations in your launch jurisdictions; (d) that
  auto-applying non-cashable Site Cash to purchases raises no money-transmission/stored-value concern (it never
  converts to cash); (e) that the 13-period (four-week) billing and its "billed every 4 weeks / 13 cycles"
  disclosure are acceptable and not presented as "monthly."

## 13c. Two-tier referral bonus + paid-endorser social program (all BUILT, gated OFF)

- **Current posture.** Two Site Cash reward features ship **disabled by default** and move no money — and post
  to no one's account — until enabled after your sign-off. Both are **single-tier** (no downline) and all
  rewards are **non-cashable closed-loop Site Cash**. Full detail + questions: `SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md`.
  - **Two-tier referral bonus** (`REFERRAL_TIERS_ENABLED=0`): **$5** per active referred user; **$2,000 per
    referred paying advertiser on each of the three tiers** (`REFERRAL_ADV_BONUS_TIER1|2|3`, all default 2000).
    The advertiser bonus pays **only after** the referred advertiser's payment **clears** + a **45-day clawback**,
    and never on refund/chargeback/self-referral/no-KYC — so each bonus is funded by a real, retained advertiser
    purchase. (Distinct from the §7 "$2,000 boost," which is a founding-offer advertising credit, not a referral.)
  - **Paid-endorser program** (`ENDORSER_ENABLED=0`): opted-in members earn a **share** (default 20%, capped
    $25/day, $500/period) of the **measured** conversion value their **#ad-disclosed** posts drive; undisclosed
    and self-conversions earn nothing. The AI personalizes an advertiser's **approved** copy only (no income
    claims; disclosure enforced and unremovable), posts as a human-approved **draft** by default (auto-posting
    triple-gated), and self-improves on conversion data.
- **For counsel to confirm:** (a) single-tier referral tied to a real paying advertiser is a normal
  finder's/affiliate fee, well clear of pyramid/MLM law; (b) FTC endorsement-disclosure sufficiency for **paid**
  endorsers with enforced `#ad`; (c) whether scheduled auto-posting to a consenting member's own account is
  acceptable or the human "tap Post" must stay permanent; (d) 1099 treatment of non-cashable closed-loop Site
  Cash for both the $2,000 referral bonus and endorser rewards (defaulted reportable); (e) referral-invite
  constraints (TCPA/CAN-SPAM); (f) that the guaranteed per-referral bonus is a rewards program, not a sweepstakes.

## 14. Blanks to fill before launch

- `BUSINESS_MAILING_ADDRESS` (CAN-SPAM footer + winner-list/rules requests) — currently empty.
- `DMCA_AGENT_EMAIL` (designated agent) — currently empty.
- `TERMS_VERSION` — bump to force re-consent after counsel edits.
- Confirm/extend the per-jurisdiction rules in `backend/sdk/jurisdiction.ts` (which states you launch in).

## One-line summary for counsel

Everything money-, credit-, minor-, or chance-related ships in the conservative/off position behind a named
switch; we are asking you to (1) confirm the closed-loop + partner-payout posture, (2) approve the sweepstakes
Official Rules and any state registrations, (3) approve the boost advertising/disclosures, (4) confirm the
privacy/session-analytics disclosures, (5) tell us whether to ever unlock any credit product — and if so, by
which licensed path — (6) confirm the Tier 2 multi-year commitment + auto-renewal terms for your states — (7)
confirm the Tier 2 upfront-deposit prepayment/unearned-revenue treatment and make-good/refund terms — (8)
confirm the all-tiers delivery guarantee + free make-good reads as a delivery (not results) commitment — (9)
confirm the Tier 1 "$12k → $24k in advertising value" claim is substantiated and carries no implied revenue/ROI
promise — (10) confirm the 1099/backup-withholding pipeline and TIN handling on partner cash payouts — and (11)
confirm the two-tier referral bonus ($5 user / $2,000-per-tier advertiser, single-tier) and the paid-endorser
social program (disclosed, performance-based, draft-by-default) per §13c and the endorser/referral brief.
