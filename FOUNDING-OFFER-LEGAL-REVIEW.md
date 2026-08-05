# Tier 1 Advertising Offer — Legal & Compliance Review Packet

**Prepared for review by qualified securities / FTC / consumer-finance counsel. This is NOT legal advice.**
It is a plain-language description of a proposed offer and the design choices its operator has already made
to reduce risk, so counsel can assess it efficiently. Nothing here should launch, and no money should be
collected, until counsel has reviewed the offer, the mechanics, and every piece of marketing copy.

> **This supersedes the earlier "Founding Advertiser" version.** That version coupled a "keep 100% up to a
> cap equal to the amount paid, over 4 years" benefit to the price and gated escrow/refunds on a launch
> milestone. Both features were the heaviest legal risks (return-of-capital / investment-contract signal,
> and escrow/refund complexity). **They have been removed.** What follows is the lighter "Tier 1" structure.

---

## 1. What the offer is

A limited **"Tier 1"** introductory offer on a closed-loop, 18+ play-to-earn / survey-rewards platform
(GamerGain / PlayEarning Nexus). It bundles **two things that are kept deliberately separate**:

1. **An advertising product**, sold on its own merits: a fixed, stated allotment of ~200,000 between-survey
   (and, if enabled, social-feed) ad impressions per year, for a 4-year term, with priority placement, at a
   locked-in introductory price (default $8,000, paid once, upfront, **non-refundable** presale).

2. **A standalone membership perk**: as a member, a Tier 1 buyer keeps **100% of what they themselves earn**
   from **third-party** surveys for a **4-year window**, paid **only as Site Cash** (closed-loop, non-cashable
   store credit). This is a better earning **SHARE** — **no dollar amount is promised, there is NO cap**, and
   it is **not tied to, a return of, or an offset to** the advertising price. After the window (or for anyone
   who joins after the offer closes) the member keeps the **post-Tier-1 share** (default **75%**; the platform
   keeps 25% as its fee).

**Availability:** Tier 1 is an introductory offer, **open until 100,000 Tier 1 advertisers enroll**, then it
**closes**. Closing changes only the *availability and the go-forward share* (new members keep 75%, not 100%).
Existing Tier 1 members are unaffected during their window. Reaching the cap triggers **nothing owed to
earlier buyers** — it is a pure availability/scarcity threshold, not a payout event.

**Upsell:** after joining, members may be offered additional advertising or spend options. These are optional.

## 2. What changed from the prior version (and why it matters)

- **Removed the "cap = amount paid" full-keep cap.** A cap pegged to the payment is a return-of-capital
  signal — the core of an investment-contract problem. The perk is now a flat **share** (keep 100% of what
  *you* earn) for a time window, with **no cap** and **no recoup framing** anywhere. Setting:
  `FOUNDING_FULLKEEP_CAP_TO_PRICE` is now **OFF** (and must stay off); `FOUNDING_FULLKEEP_CAP_USD` = 0.
- **Removed the launch-milestone escrow/refund machinery.** There is no "refund if we miss a user milestone"
  and no escrow lifecycle in the default model. The 100k number is now only an **availability cap** on the
  introductory offer.
- **Separated the two things sold.** The advertising product and the survey perk are presented in distinct
  sections, so the perk is never framed as a justification for, or a return of, the price.
- **Removed stated earnings figures from the perk.** No "$8/day," no "8 minutes." The perk is described as a
  **share** ("keep 100% of what you earn"), which says nothing about *how much* anyone will earn.

## 3. The mechanics that carry the most legal weight

1. **Non-refundable presale.** The $8,000 is not held in escrow and is not refundable. The offer page shows a
   prominent red **non-refundable risk warning** and requires an explicit acceptance checkbox; acceptance is
   recorded in an append-only consent ledger (`kind: "tier1_advertiser_terms"`).

2. **Survey perk is a SHARE, earned through the member's own labor, paid as store credit.** The member keeps
   100% (in-window) of what *they* earn from *third-party* surveys, as closed-loop Site Cash. No amount is
   promised; there is no cap; it is explicitly separate from the advertising price. It reverts to the
   post-Tier-1 share (75%) after the window or for post-close members.

3. **No guaranteed return; no shortfall charge; no separate cash grant.** No 2x/4x, no "zero-risk," no
   auto-charge for an earnings shortfall, no dollar grant.

## 4. Issues for counsel — and how the design addresses each

### (a) Securities / investment contract (Howey)
- **Prior risk (now mitigated):** the old cap-equals-price design was a return-of-capital signal.
- **Now:** the perk is a **variable earning share** on the buyer's **own survey labor** (weakening "profit
  from the efforts of others"), paid only as **store credit**, with **no cap, no promised amount, and no
  recoup framing**. The advertising is an ordinary product sale.
- **For counsel:** With the cap and recoup framing removed and the two components separated, does this still
  present investment-contract risk? Is the "keep 100% of your own survey earnings" perk clean as a
  loyalty/rate benefit? Anything in the *overall impression* (price shown near the perk) to fix?

### (b) FTC earnings claims / Business Opportunity Rule
- **Design:** the perk is stated as a **share** ("keep 100% of what you earn"), not an amount; no per-day or
  per-minute earnings figure appears; availability and earnings are labeled variable and not guaranteed.
- **For counsel:** Is a pure **share** statement (no amount) outside earnings-claim substantiation rules? Does
  a "pay upfront, then earn by doing surveys" shape implicate the Business Opportunity Rule, and if so what
  disclosure document is required? (Earning requires the member's own labor and is never promised.)

### (c) Crowdfunding / pre-sale delivery obligations (FTC)
- **Design:** funds are earmarked to build/launch/grow and acquire users; the non-refundable / may-not-launch
  risk is disclosed prominently and accepted; records are kept. The operator intends to **reserve enough to
  actually deliver** the advertising sold.
- **For counsel:** What obligations attach to the non-refundable pre-sale? Is any portion legally required to
  be refundable/escrowed? What delivery-effort and record-keeping standard should we hold ourselves to?

### (d) Money transmission / stored value
- **Design:** Site Cash is **closed-loop and non-cashable** (no cash redemption, no P2P). Presale proceeds are
  the operator's revenue (not held for the customer).
- **For counsel:** Do any state stored-value / money-transmitter statutes apply to the store credit or the
  proceeds in target states? Does switching to the (still-available) escrow/hybrid model change the analysis?

### (e) Consumer protection / non-refundable
- **Design:** prominent non-refundable disclosure + explicit consent; **no negative-option billing and no
  auto-charge**. Upsells after signup are optional and do not affect the original purchase.
- **For counsel:** Are the non-refundable terms enforceable in target states? Any cooling-off / cancellation
  rights required?

### (f) The "Ponzi" line
- The impression allotment is a fixed, stated deliverable. **No promised payout to earlier buyers is ever
  funded out of later buyers' money** — member survey earnings come from real third-party survey demand, not
  from new Tier 1 intake, and hitting the 100k availability cap pays nobody. Please confirm the structure
  cannot be characterized as paying returns from new deposits.

### (g) The two-tier rate (100% now / 75% after)
- Tier 1 members keep 100% of their own survey earnings in-window; members who join after the cap keep 75%
  (platform fee 25%). This is a standard "introductory rate then standard rate" structure.
- **For counsel:** Any issue with advertising a time-limited introductory **rate** that later steps down, so
  long as no amount is promised and the change is disclosed up front?

## 5. What is intentionally NOT in the offer

- No guaranteed financial return (no 2x/4x, no "double your money").
- No cap pegged to the amount paid; no cap at all on the survey share.
- No recoup / "earn your money back" framing anywhere.
- No escrow/refund launch milestone in the default model.
- No stated per-day or per-minute earnings figure.
- No auto-charge for an earnings shortfall; no separate cash/points grant.

## 6. Operator controls (feature flags) counsel should know exist

- Availability cap: `FOUNDING_ADVERTISER_SLOTS` (100,000 Tier 1 advertisers).
- In-window share: `FOUNDING_SURVEY_EARN_SHARE_PCT` (1.0 = keep 100%).
- Post-Tier-1 platform fee (admin-tunable): `TIER1_POST_PLATFORM_FEE_PCT` (0.25 = platform keeps 25%, member
  keeps 75%). The member's keep-share is 1 − this fee.
- Perk window: `FOUNDING_FULLKEEP_YEARS` (4). Cap: `FOUNDING_FULLKEEP_CAP_TO_PRICE` = **OFF**,
  `FOUNDING_FULLKEEP_CAP_USD` = 0 (no cap).
- Funds model: `FOUNDING_FUNDS_MODEL` = presale | escrow | hybrid (currently **presale**, non-refundable).
- No shortfall charge: `FOUNDING_MEMBER_SHORTFALL_CHARGE` = **off** (must stay off).

## 7. The specific asks for counsel

1. With the cap and recoup framing removed and the advertising/perk separated, is this offer an unregistered
   security or a regulated business opportunity? If not, is the structure sound as an advertising sale + a
   loyalty rate perk?
2. Is a **share** statement ("keep 100% of what you earn," no amount) outside earnings-claim substantiation?
   What disclosures, if any, are still required?
3. What obligations and disclosures apply to the non-refundable pre-sale; should any portion be
   escrowed/refundable?
4. Do money-transmitter / stored-value rules apply to the Site Cash or the proceeds in any target state?
5. Please review and mark up the exact member-facing copy (offer page + disclosures) before launch.

*Full technical detail of what is coded is in `ADVERTISER-FUNDED-LAUNCH.md`.*
