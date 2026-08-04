# Advertiser-Funded Launch — Founding Advertiser program

The launch strategy: **sign founding advertisers first, use that capital to acquire users in year one.** This
doc describes the program as it is **coded** — deliberately structured as an *advertising + membership* sale,
not an investment, so it can actually ship without inviting an SEC/FTC problem.

## The idea (and the honest version of it)

You wanted advertisers to come in first, at near-zero cost and risk to them, funding your growth. The way to
do that **legally** is to stack real, delivered value so the package obviously pays for itself, and to give an
easy exit — **not** to promise a financial return. A promised return ("2x/4x your money," "guaranteed
profit," "zero risk") converts an ad sale into an unregistered security and a deceptive-earnings claim. So the
program keeps the appeal and drops the guarantee:

- **Founding Advertiser tier** — limited to `FOUNDING_ADVERTISER_SLOTS` (100,000) seats. Scarcity is a
  marketing lever, not a promise.
- **One-time price** `FOUNDING_ADVERTISER_PRICE_USD` ($8,000) for a `FOUNDING_ADVERTISER_TERM_YEARS` (4)-year
  package.
- **Fixed, stated ad allotment** — `FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR` (200,000) between-survey
  interstitial impressions per year, served with **priority** over house ads. A concrete deliverable, not an
  open-ended "until you recoup Nx."
- **Membership in the closed loop** — every founding advertiser is auto-enrolled as a member/affiliate and can
  earn **variable** Site Cash from surveys like any member. This is the honest version of "earn your cost
  back": it genuinely offsets real-world cost, but it is **disclosed as variable, not guaranteed, and not a
  repayment** of the advertising fee. Site Cash is closed-loop, non-cashable.
- **Funds model — `FOUNDING_FUNDS_MODEL` (default `presale`).** Chosen: **presale** — the full $8,000 is
  **non-refundable founding revenue** that funds the ramp-up, crowdfunding-style. `escrow` (fully refundable,
  not spendable) and `hybrid` (a non-refundable deposit spendable now + the rest escrowed/refundable) are also
  supported by the same code, switched by this setting. `signupFinancials()` splits every payment into a
  spendable (non-refundable) portion and an escrowed (refundable) portion per the model, and the code keeps the
  two pots hard-separated — escrow is never spent on ramp-up.
- **Dual milestone** — the platform "launches" (advertising begins delivering) only when it reaches **BOTH**
  `FOUNDING_LAUNCH_MILESTONE_PREMIUM_USERS` (100,000) premium users **and** `FOUNDING_LAUNCH_MILESTONE_FOUNDERS`
  (100,000) founding members. In `presale`, the milestone gates **delivery**, not a refund: if it's missed by
  the deadline, presale purchases are marked `launch_unmet` (**no money back — disclosed and accepted at
  purchase**); escrow/hybrid refundable portions are flagged `refund_due`.
- **Non-refundable risk is disclosed prominently.** In presale/hybrid, the offer page shows a red warning box
  and the acceptance checkbox states the payment is non-refundable and may be lost if the platform doesn't
  launch. This honest disclosure is what keeps a crowdfunding-style pre-sale legitimate — it must not be
  softened.
- **No member shortfall charge, ever** — `FOUNDING_MEMBER_SHORTFALL_CHARGE` is coded **off and must stay off**.
  Members are never charged for "falling short" of an earnings figure, because there is no promised figure.
- **Ramp-up funded from operating capital, not escrow** — keeping the offer attractive before launch is paid
  from the platform's **own operating funds** via an optional, capped, discretionary bonus
  (`FOUNDING_RAMPUP_BONUS_ENABLED` / `..._MONTHLY_BUDGET_USD`, both 0/off by default). It is a promotion, not a
  guaranteed earning, and is **hard-separated from escrowed founding deposits** — escrow can never fund it.
- **Business/Enterprise upsell** — offered to advertisers who complete the founding/PPC portion, as a value +
  satisfaction guarantee (never a guarantee of financial return).
- **Everything serves the flywheel** — the store-credit rewards spend only on-platform, keeping advertisers
  and their audiences inside the closed loop; upsell/downsell hooks pull people deeper in.

## The founding value package — the "three numbers," represented legally

Founding advertisers see three headline numbers, shown in **real deliverable units, never dollars** and never
as a return or a "worth $X":

1. **Founding ad impressions** — a concrete count across **both** surfaces (between-survey interstitial + the
   social feed), `FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR` × the term.
2. **Founding store credit** — `FOUNDING_STORE_CREDIT_POINTS` in **points** (closed-loop, non-cashable store
   credit), released in equal annual tranches over `FOUNDING_STORE_CREDIT_RELEASE_YEARS` (25%/year over 4).
   Delivered by `foundingPerksRelease` (scheduled) once the record is active; `foundingCreditTrancheDue` only
   ever releases the tranche actually due, so it never double-credits.
3. **Survey earning share** — `FOUNDING_SURVEY_EARN_SHARE_PCT` (100%): they keep all of what they earn from
   surveys. The **amount is variable and not guaranteed** — this is a share of whatever they actually earn,
   not a promised figure.

**Why this is legal/ethical, and the line we don't cross:** we show points as points — honest store credit,
non-cashable, spendable only on-site, useful only while the store operates — and we do **not** show a dollar
value, imply a dollar equivalence, or claim any multiple/return. That matters because *disguising a promised
dollar return as points would not make it legal* — regulators judge substance over form. What keeps it clean
is that these are genuine **deliverables** (a grant, an impression count, an earning share), framed as what the
membership *includes*, not as ROI. The page states plainly they are "not a refund or a promised return," and
that store credit is worthless if the store isn't operating.

- **Both outcomes, honestly.** Missing the 100k milestone doesn't void the package — it still delivers on
  whatever platform exists, and you can dial goodwill higher for the milestone-missed case via
  `FOUNDING_MILESTONE_MISSED_BONUS_MULT` (discretionary, from margin). The one thing no design can promise:
  if the platform **never launches**, none of this can be delivered and the (presale) money is lost — disclosed.

## What's coded

- **Settings** (`settings.ts`, "Founding Advertiser" category): all the knobs above + toggles for escrow,
  auto-enroll, priority, and the upsell.
- **Entity** `FoundingAdvertiser` (owner-scoped): the purchase record with a status state machine
  (`escrowed → active | refund_due → refunded | cancelled`), allotment, and served-impression metering.
- **SDK** `founding-advertiser.ts`: program config, slot counting, the premium-user milestone evaluation, the
  interstitial ad-owner selection + allotment metering, and the plain-language **disclosures**.
- **Functions**: `foundingAdvertiserOffer` (honest terms + your status), `foundingAdvertiserSignup` (records
  an **escrowed** seat only after explicit disclosure acceptance; logs consent to the `ConsentRecord` ledger;
  enrolls as member/affiliate), and `foundingProgramMilestone` (admin/scheduled — activates escrowed
  advertisers when the milestone is met, or flags refunds if the deadline passes).
- **Interstitial wiring** — `surveyInterstitialGate` now serves active founding advertisers' creatives with
  priority (up to allotment) and meters impressions; `SurveyInterstitialAd.jsx` echoes the owner so the count
  is accurate.
- **Page** `/FoundingAdvertiser` (`FoundingAdvertiser.jsx`) — the offer, with the disclosures shown up front
  and a **required** acceptance checkbox before any seat is reserved.

## What is deliberately NOT built (and why)

These were in the original ask but are the parts that would create real legal liability, so they're out:

- **No guaranteed 2x/4x return.** Replaced by the fixed ad allotment + variable member earnings. A guaranteed
  multiple is the single thing that makes this a security.
- **No "zero risk / guaranteed profit" marketing.** The UI and disclosures state plainly that this is
  advertising, not an investment, and that earnings vary.
- **No auto-charging a card for a survey-earnings shortfall.** There is no promised earnings figure to fall
  short of, so there's nothing to chase. The package is a straightforward prepaid ad purchase; member earnings
  are a separate, variable benefit. Any cost of keeping the offer alive during ramp-up is borne by the
  **platform's own operating funds** (a capped, discretionary promo) — never by charging a member, and never
  from the escrowed founding deposits (which stay locked/refundable until both milestones are met).
- **No "2% fee on profit."** Tracking a member's "profit" reinforces the investment framing. Renewal
  incentives, if you want them, should be tied to ad **spend** (a normal loyalty rebate), not to profit.

## Hard gates before this can go live (not code — get these first)

- **Securities + FTC counsel review** of the whole offer, the disclosures, and every piece of marketing copy.
  Pre-selling a limited, prepaid program still needs a lawyer's eyes even in this framing. This module is a
  scaffold; it is **off the critical path to a compliant launch until counsel signs off**.
- **Crowdfunding / pre-sale obligations (presale model).** Taking non-refundable money to build-then-deliver is
  a crowdfunding-style pre-sale. The FTC has pursued crowdfunders who took money and didn't make a good-faith
  effort to deliver, so: use the funds for the stated purpose (building/launching the platform), keep records,
  and make the non-refundable + may-not-launch risk unmistakable to buyers (the UI does this — don't weaken
  it). The line that must never be crossed: **no promised financial return, and never pay any promised payout
  to earlier buyers out of later buyers' money** — that's the Ponzi mechanic, illegal regardless of framing.
- **A real escrow arrangement** (a licensed escrow agent / segregated account) for the held funds. The code
  tracks `escrowed` / `refund_due` state and flags; it never moves money. Your processor + escrow agent act on
  the flags.
- **Substantiation for any earnings language.** If you ever show what members *can* earn, it must be backed by
  real data and carry the required disclosures — survey inventory almost certainly cannot deliver $8/day to
  everyone every day, so avoid implying it does.

## Suggestions to lower advertiser cost/risk — the legal way

You asked how to push their cost and risk toward zero. Do it with **value and exit**, not guarantees:

1. **Over-deliver on the allotment** — a generous, clearly-stated impression count they can see accruing in a
   dashboard beats a vague "Nx return."
2. **Make membership earnings real and easy** — the more genuinely they can earn as members, the more their
   net cost drops, honestly. Just never label it a repayment.
3. **Easy exit** — the escrow-refund-if-we-miss-the-milestone is a legitimate way to say "you're not risking
   much," because they can get their money back. That's the compliant substitute for a return guarantee.
4. **Founding perks that compound** — priority placement, locked-in rate, first access to new ad surfaces:
   value that grows as the platform grows, without promising a number.
