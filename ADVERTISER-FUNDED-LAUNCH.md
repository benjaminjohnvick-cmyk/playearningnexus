# Advertiser-Funded Launch — Tier 1 advertising offer

> ## ⭐ CURRENT MODEL — the clean "Tier 1" offer (supersedes the "Founding" details further below)
>
> The offer was reworked into a lighter **Tier 1** structure that drops the two heaviest legal risks. As
> coded now:
>
> - **Two things, kept DELIBERATELY SEPARATE.** (1) An **advertising product** — ~200,000 between-survey
>   impressions/year for a 4-year term at a locked-in introductory price (**$12,000/yr — or $1,000/mo over 12
>   months** — non-refundable),
>   sold on its own merits. (2) A **standalone membership perk** — keep **100% of what YOU earn** from
>   **third-party** surveys for **4 years**, paid only as **Site Cash** (closed-loop, non-cashable). It's a
>   better **SHARE**, with **NO promised amount, NO cap**, and it is **not a return of / offset to** the ad
>   price.
> - **Availability window.** Open until **100,000 Tier 1 advertisers** enroll, then it closes. Reaching the
>   cap owes nobody anything — it's a scarcity threshold, not a payout event.
> - **After the offer closes** (or after a member's 4-year window), members keep the **post-Tier-1 share**:
>   **75%** of their own survey earnings; the platform keeps **25%** as its fee — set in the admin panel via
>   `TIER1_POST_PLATFORM_FEE_PCT` (the member's keep-share is 1 − the fee).
>   Existing Tier 1 members are grandfathered at 100% for their window.
> - **After signup, members may be upsold** into additional advertising/spend options (optional).
> - **REMOVED vs the old "Founding" version:** the "cap = amount paid" recoup benefit (a return-of-capital
>   signal), the launch-milestone escrow/refund machinery, and any stated per-day/per-minute earnings figure.
>   `FOUNDING_FULLKEEP_CAP_TO_PRICE` is now OFF; there is no cap.
> - **Key flags:** `FOUNDING_ADVERTISER_SLOTS` (100k cap), `FOUNDING_SURVEY_EARN_SHARE_PCT` (1.0 in-window),
>   `TIER1_POST_PLATFORM_FEE_PCT` (0.25 — admin-tunable), `FOUNDING_FULLKEEP_YEARS` (4), `FOUNDING_FUNDS_MODEL` (presale).
> - **Compliance:** see `FOUNDING-OFFER-LEGAL-REVIEW.md` (rewritten for this lighter structure). Counsel-gated;
>   nothing collects money until an attorney reviews the offer and every line of member-facing copy.
>
> The sections below are retained for history/context; where they conflict with this box, **this box wins.**

---

The launch strategy: **sign Tier 1 advertisers first, use that capital to acquire users in year one.** This
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
- **Price** `FOUNDING_ADVERTISER_PRICE_USD` ($12,000/yr) — payable upfront, or as
  `FOUNDING_ADVERTISER_MONTHLY_PRICE_USD` ($1,000)/mo over 12 months — for a `FOUNDING_ADVERTISER_TERM_YEARS`
  (4)-year package.
- **Fixed, stated ad allotment** — `FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR` (200,000) between-survey
  interstitial impressions per year, served with **priority** over house ads. A concrete deliverable, not an
  open-ended "until you recoup Nx."
- **Membership in the closed loop** — every founding advertiser is auto-enrolled as a member/affiliate and can
  earn **variable** Site Cash from surveys like any member. This is the honest version of "earn your cost
  back": it genuinely offsets real-world cost, but it is **disclosed as variable, not guaranteed, and not a
  repayment** of the advertising fee. Site Cash is closed-loop, non-cashable.
- **Funds model — `FOUNDING_FUNDS_MODEL` (default `presale`).** Chosen: **presale** — the $12,000 (whether
  paid upfront or as $1,000/mo over 12 months) is **non-refundable founding revenue** that funds the ramp-up,
  crowdfunding-style. `escrow` (fully refundable,
  not spendable) and `hybrid` (a non-refundable deposit spendable now + the rest escrowed/refundable) are also
  supported by the same code, switched by this setting. `signupFinancials()` splits every payment into a
  spendable (non-refundable) portion and an escrowed (refundable) portion per the model, and the code keeps the
  two pots hard-separated — escrow is never spent on ramp-up.
- **Single milestone — founders ARE the users.** In the first-year offer, each founding member also signs up
  as a user and uses the site for the year, so there is **one** launch gate: `FOUNDING_LAUNCH_MILESTONE_FOUNDERS`
  (100,000) founding members. `FOUNDING_LAUNCH_MILESTONE_PREMIUM_USERS` defaults to **0** (no separate user
  pool) — you need 100,000 people total, not 100k founders plus 100k users. (`milestoneState` still supports a
  separate user gate if that setting is ever set > 0.) The milestone gates **delivery**, not a refund: if it's
  missed by the deadline, presale purchases are marked `launch_unmet` (**no money back — disclosed and accepted
  at purchase**); escrow/hybrid refundable portions are flagged `refund_due`.
- **Founding participation + feedback.** Founding members are told they participate for the year (sign up, use
  the site, do surveys) and that we ask for feedback via surveys to refine the site. This is framed as
  participation, not an enforced quota — there is no penalty/charge for a shortfall (see "no member shortfall
  charge").
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

Founding advertisers see the headline numbers in **real deliverable units, never dollars** and never as a
return or a "worth $X":

1. **Founding ad impressions** — a concrete count across **both** surfaces (between-survey interstitial + the
   social feed), `FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR` × the term.
2. **Survey earning share** — `FOUNDING_SURVEY_EARN_SHARE_PCT` (100%): they keep all of what they earn from
   surveys, up to the $8/day cap. The **amount is variable and not guaranteed** — a share of whatever they
   actually earn, not a promised figure — and it is paid as **Site Cash: closed-loop store credit that spends
   ONLY on-site**, never cash.

### Founding full-keep CAP (the 100%-keep is bounded)

The founding 100%-keep survey rate applies **up to a cumulative cap, over a window** (`FOUNDING_FULLKEEP_*`
settings; default cap = the amount paid, window = 4 years), after which the member reverts to the standard
survey-reward share. It's metered per member on their `FoundingAdvertiser` record (`fullkeep_earned_usd`) and
wired into every survey-credit path (`bitlabsPostback`, `cpxPostback`, `adGridAnswer`, `respondentMicroPayout`)
via `computeSurveyReward`'s share override + `recordFoundingFullKeepEarning`.

**It also applies in the FAILURE case.** `foundingFullKeepStatus` treats any live seat — `funded` (offer year),
`active` (launched), or `launch_unmet` (failure) — as eligible. So if the platform doesn't reach the milestone,
a founding member can keep earning store credit at the founding rate by completing **third-party surveys** (the
integrated networks — BitLabs, CPX, etc. — which don't need the platform's own advertiser base), up to the cap,
over the 4-year window, **as long as the site operates**. It is not a refund, stops if the site stops, and — per
the disclosure (`failure_recoup`) — is never a promise to recoup what they paid.

**COMPLIANCE — the sharp edge here.** Setting the cap equal to what they paid, and any copy that says "earn
back / recoup what you paid over 4 years," is BOTH (a) an FTC earnings claim — survey inventory cannot
guarantee the amount, so a promise to reach the cap is unsubstantiated and deceptive — and (b) a
return-of-capital signal that reads like an investment. The mitigating fact is that members earn it through
their **own survey work** (not passively), which is why it's presented strictly as a **cap on a variable,
not-guaranteed benefit** ("keep 100% up to your founding cap, amounts vary, you may not reach it"), never a
promise to recoup. Do not soften that. Counsel must review this specific mechanic and all its copy.

There is **no separate store-credit grant** (the earlier "25%/year store credit" is removed;
`FOUNDING_STORE_CREDIT_POINTS` defaults to 0). The only value a founding advertiser keeps is their survey
earnings, which must be spent as on-site store credit. The `foundingPerksRelease` / `foundingCreditTrancheDue`
machinery stays in place but is inert at 0, so a grant could be re-enabled later without new code.

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

## Two earnings claims to police in the copy

- **"8 minutes a day to earn $8."** Arithmetically the premium rate ($1/min, $8/day cap) works out to ~8
  minutes, but survey *availability* can't guarantee 8 minutes of paying surveys every day. Presented as a
  flat "it only takes 8 minutes to earn $8," that's an FTC earnings claim that likely isn't substantiatable.
  The coded disclosure (`effort_note`) qualifies it: "~8 minutes *when surveys are available*; availability and
  earnings vary and are not guaranteed; not a promise you'll earn $8 in 8 minutes." Keep it that way.
- **"Use the site for 4 years to get your store credit back (if it fails)."** This is recoup-your-payment
  framing. It is only implemented as the **full-keep cap** — a variable benefit earned through the member's own
  surveys, capped, over 4 years — and must be presented as such, never as a promise to "get your money back."
  A guarantee of recoupment is both an FTC earnings claim and a return-of-capital signal.

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
