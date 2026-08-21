# Advertiser-Funded Launch — the Founding / Tier 1 advertising offer

The launch strategy: **sign founding advertisers first, and use that capital to acquire the user audience their
advertising will be delivered to.** The program is deliberately structured as an **advertising + membership**
sale — not an investment — so it can ship without inviting an SEC/FTC problem. This document describes the offer
as it is coded today.

## The offer at a glance

- **Founding Advertiser tier — 200,000 slots** (`FOUNDING_ADVERTISER_SLOTS`). The founding offer is open until
  200,000 founding advertisers enroll, then it closes and becomes the standard Tier 1 offer. Scarcity is a
  marketing lever, not a promise, and reaching the cap owes nobody anything.
- **Price — $13,000 / year**, billed as **$1,000 every 4 weeks across 13 cycles** (`FOUNDING_ADVERTISER_PRICE_USD`
  × the 13-period billing factor), for a **4-year package** (`FOUNDING_ADVERTISER_TERM_YEARS`). Founders lock
  this price **for life**. After the founding offer closes, standard Tier 1 costs **30% more — $16,900/year**
  (`TIER1_PRICE_UPLIFT_OVER_FOUNDING_PCT` = 0.30); everyone who joined during the founding phase keeps the
  founding price.
- **A fixed, stated ad allotment — 200,000 impressions/year** (`FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR`)
  across **both** surfaces (between-survey interstitial + the social feed), served with **priority** over house
  ads. A concrete deliverable, never an open-ended "until you recoup Nx."
- **Category exclusivity** (`FOUNDING_CATEGORY_EXCLUSIVITY`) — each founder is the **only founding advertiser in
  their category**; no other live founder can hold it.
- **Premium membership included**, plus an **AI campaign manager + concierge support** (AI, with human
  escalation), AI-written creative, A/B testing, analytics, and sentiment insights.
- **$2,000 in Site Cash** (`FOUNDING_STORE_CREDIT_POINTS`, 800,000 points) released over the term as
  closed-loop, non-cashable store credit — a delivered membership perk, decoupled from the price paid.
- **Membership survey perk** — a founding advertiser is auto-enrolled as a member and **keeps 100% of what they
  themselves earn** from third-party surveys for **4 years** (`FOUNDING_FULLKEEP_YEARS`), paid only as **Site
  Cash**. There is **no cap** and **no promised amount**; it is a better earning **share**, not a return of or
  offset to the advertising price. After the window (or if a member joins after the founding offer closes) they
  keep the standard **75%** share (the platform keeps 25% as its fee, `TIER1_POST_PLATFORM_FEE_PCT`).
- **Capacity-paced delivery.** Advertising is guaranteed by **amount, not by date**: impressions deliver as the
  audience grows, with no promised delivery date and no promised year-one volume, and we keep delivering — at no
  extra charge — until the full promised amount is delivered. This guarantees **advertising delivered**, never
  revenue, sales, or ROI (`FOUNDING_DISCLOSURE_COPY`).
- **Funds model — presale** (`FOUNDING_FUNDS_MODEL`, default `presale`): the payment is **non-refundable**
  founding revenue that funds the ramp-up, crowdfunding-style, and is disclosed as such. `escrow` (fully
  refundable) and `hybrid` (non-refundable deposit + escrowed remainder) are supported by the same code.
- **Compliance:** this is a purchase of advertising and membership, **not an investment**. No promised financial
  return, no "2x/4x," no "zero risk / guaranteed profit," and no card charge for an earnings shortfall.
  Counsel-gated: nothing collects money until an attorney reviews the offer and every line of member-facing copy
  (`FOUNDING-OFFER-LEGAL-REVIEW.md`).

## The two launch gates — 200,000 advertisers AND 200,000 users

Launch is gated on reaching **both** of two separate targets (`milestoneState.met` is true only when both are
met):

1. **200,000 founding advertisers** (`FOUNDING_LAUNCH_MILESTONE_FOUNDERS`). These are the advertisers who bought
   the founding package; they also act as users and give feedback during the year.
2. **200,000 premium users** (`FOUNDING_LAUNCH_MILESTONE_PREMIUM_USERS`) — a **separate pool**, covered in its
   own section below.

The milestone gates **delivery**, not a refund. If it is missed by the deadline
(`FOUNDING_LAUNCH_MILESTONE_DEADLINE`), presale purchases are marked `launch_unmet` (**no money back — disclosed
and accepted at purchase**); escrow/hybrid refundable portions are flagged `refund_due`.

## The 200,000-user pool (separate gate)

Separate from the 200,000 founding advertisers, the program commits to acquiring **200,000 premium users**
before launch, funded by the founding advertisers' payments. This is a distinct population and a distinct launch
gate:

- **Who they are.** Regular members on premium, acquired through the user-acquisition spend the founding capital
  pays for. They are **not** the advertisers — every founding advertiser also acts as a user during the year,
  but founders count toward the advertiser gate, not this one.
- **The gate.** `FOUNDING_LAUNCH_MILESTONE_PREMIUM_USERS` = **200,000**. Launch does not proceed until this pool
  **and** the 200,000-advertiser pool are both reached. It is measured on real premium memberships
  (`premiumUserCount`), not projected.
- **Why it exists.** It ensures the advertising the founding advertisers bought has a real audience to deliver
  to at launch — the audience their capital was used to build.
- **Deadline behavior.** Same as the advertiser gate: if the deadline passes with either gate unmet,
  escrow/hybrid refundable portions flag `refund_due`; presale is `launch_unmet` (disclosed, no money back).

## Why this is legal/ethical, and the line we don't cross

We stack real, delivered value so the package obviously pays for itself, and we give an easy exit — **not** a
promised financial return. A promised return ("2x/4x your money," "guaranteed profit," "zero risk") would
convert an ad sale into an unregistered security and a deceptive-earnings claim. So the program keeps the
appeal and drops the guarantee:

- **The membership survey earnings are variable and not guaranteed** — a better share of whatever the member's
  own survey work produces, paid as Site Cash (closed-loop store credit that spends only on-site, is not cash,
  and is useful only while the store operates). It genuinely offsets real-world cost, but it is disclosed as
  variable, uncapped, and **not a repayment** of the advertising fee.
- **Site Cash is shown as store credit, never a dollar return.** We show points as points — honest, non-cashable
  store credit — and never imply a dollar equivalence or a multiple/return. Regulators judge substance over
  form, so disguising a promised return as points would not make it legal; what keeps it clean is that these
  are genuine **deliverables** (impressions, a store-credit grant, an earning share), framed as what the
  membership *includes*.
- **No member shortfall charge, ever** (`FOUNDING_MEMBER_SHORTFALL_CHARGE` is coded off and must stay off).
  There is no promised earnings figure, so there is nothing to chase and no card is ever charged for a
  shortfall.
- **Both outcomes, honestly.** Missing either 200k milestone doesn't void the package — it still delivers on
  whatever platform exists, and goodwill can be dialed higher for the milestone-missed case
  (`FOUNDING_MILESTONE_MISSED_BONUS_MULT`, discretionary, from margin). The one thing no design can promise: if
  the platform **never launches**, none of this can be delivered and the presale money is lost — disclosed.

## Earnings-claim language to police in the copy

- **"8 minutes a day to earn $8."** Arithmetically the premium rate ($1/min, $8/day cap) is ~8 minutes, but
  survey *availability* can't guarantee 8 minutes of paying surveys every day. The coded disclosure
  (`effort_note`) qualifies it: "~8 minutes *when surveys are available*; availability and earnings vary and are
  not guaranteed." Keep it that way — a flat "it only takes 8 minutes to earn $8" is an FTC earnings claim that
  likely isn't substantiatable.
- **Never "earn/recoup what you paid."** The membership earnings are a variable benefit earned through the
  member's own surveys; they are never presented as a promise to recoup the advertising price. A guarantee of
  recoupment is both an FTC earnings claim and a return-of-capital signal.
- **Never a delivery date or ROI promise.** Delivery is capacity-paced (guaranteed by amount, not date), and the
  guarantee is advertising delivered — never revenue, sales, sign-ups, or ROI.

## What's coded

- **Settings** (`settings.ts`, "Founding Advertiser" category): all the knobs above + toggles for escrow,
  auto-enroll, priority, category exclusivity, the disclosure copy, and the upsell.
- **Entity** `FoundingAdvertiser` (owner-scoped): the purchase record with a status state machine
  (`funded/escrowed → active | refund_due → refunded | cancelled`), allotment, category, and served-impression
  metering.
- **SDK** `founding-advertiser.ts`: program config, slot counting, two-phase (founding → +30% Tier 1) pricing,
  category-exclusivity checks, the launch-milestone evaluation (both gates), the interstitial ad-owner
  selection + allotment metering, and the plain-language **disclosures**.
- **Functions**: `advertiserApplyInfo` (phase-aware offer + availability), `foundingAdvertiserSignup` (records a
  seat only after explicit disclosure acceptance; logs consent to the `ConsentRecord` ledger; enrolls as
  member; enforces category exclusivity), and `foundingProgramMilestone` (admin/scheduled — activates seats when
  both milestones are met, or flags refunds if the deadline passes).
- **Interstitial wiring** — `surveyInterstitialGate` serves active founding advertisers' creatives with priority
  (up to allotment) and meters impressions; the ad-owner selection scales to every active advertiser.
- **Page** `/Apply` (`Apply.jsx`) — the offer, with the delivery disclosure shown up front and a **required**
  acceptance checkbox before any seat is reserved.

## Hard gates before this can go live (not code — get these first)

- **Securities + FTC counsel review** of the whole offer, the disclosures, and every piece of marketing copy.
  This module is a scaffold; it is off the critical path to a compliant launch until counsel signs off.
- **Crowdfunding / pre-sale obligations (presale model).** Taking non-refundable money to build-then-deliver is
  a crowdfunding-style pre-sale: use the funds for the stated purpose, keep records, and make the
  non-refundable + may-not-launch risk unmistakable to buyers (the UI does this — don't weaken it). The line
  that must never be crossed: **no promised financial return, and never pay any promised payout to earlier
  buyers out of later buyers' money.**
- **A real escrow arrangement** (a licensed escrow agent / segregated account) if you run the escrow/hybrid
  model. The code tracks `escrowed` / `refund_due` state and flags; it never moves money.
- **Substantiation for any earnings language.** If you ever show what members *can* earn, it must be backed by
  real data and carry the required disclosures.
