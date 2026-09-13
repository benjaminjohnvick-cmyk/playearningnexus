# Founding Offer — Counsel Review Packet

**Prepared for review by qualified securities / FTC / consumer-finance counsel. This is NOT legal advice.** A
plain-language description of the founding pre-launch advertiser offer and the design choices made to reduce
risk, so counsel can assess it efficiently. **Nothing launches and no money is collected until counsel has
reviewed the offer, its mechanics, and every piece of marketing copy.** Companion to `CURRENT-FOUNDING-OFFER`
(plain description) and `FOUNDING-OFFER-DESIGN-AND-BUILD` (mechanics).

---

## 1. What the offer is

A limited **Founding Advertiser** introductory offer on a closed-loop, 18+ retail rewards / survey-rewards
marketplace. It bundles two deliberately separate things:

1. **An advertising product** sold on its own merits — a stated **200,000 impressions/year** for a **4-year
   term**, priority placement, at a locked introductory price (**$13,000/year, billed $1,000 every 4 weeks
   across 13 cycles**, non-refundable in the default presale model). Delivery is **capacity-paced** — guaranteed
   by amount, not by date.
2. **A membership perk** — the member keeps **100% of what they themselves earn** from third-party surveys for a
   4-year window, paid only as **non-cashable Site Cash**. A better **share** — no dollar amount promised, no
   cap, not tied to or a return of the advertising price; reverts to 75% after the window / for post-close
   members.

Included (delivered features, not a financial return): premium membership, AI campaign manager + concierge, AI
creative, A/B testing, analytics, sentiment insights, a **$2,000 Site Cash grant** (non-cashable, released over
the term), and **every tier-gated feature at the highest (Tier 3 / Unlimited) capability level, free**
(`FOUNDING_MAX_SCALE_ENABLED`) — a capability grant only: no cash/credit/monetary value, no added ad-impression
volume, no revenue/ROI representation. **Category exclusivity** per founder is a scarcity/positioning perk, not
a financial promise. At the 200,000-advertiser cap the offer closes to a standard Tier 1 at +30% ($16,900);
founders are grandfathered.

## 2. Mechanics that carry the most legal weight

1. **Non-refundable presale** — the $13,000 (billed across 13 cycles) is not escrowed and not refundable in the
   default model; a prominent non-refundable risk warning + explicit acceptance checkbox are recorded to an
   append-only consent ledger.
2. **Capacity-paced delivery, never ROI** — guaranteed by **amount, not date**; the platform keeps delivering at
   no extra charge until the full promised amount is delivered; the guarantee is **advertising delivered**, not
   revenue, sales, sign-ups, or ROI. Disclosed clear-and-conspicuously and consent-logged.
3. **Survey perk is a SHARE** on the member's **own** labor, paid as store credit — no promised amount, no cap,
   separate from the advertising price.
4. **Store-credit grant is non-cashable** — the $2,000 Site Cash grant is closed-loop, spendable only on-site,
   framed as a delivered perk, not a dollar return.
5. **No guaranteed return; no shortfall charge.**

## 3. Issues for counsel — and how the design addresses each

**(a) Securities / investment contract (Howey).** The perk is a variable earning **share** on the buyer's own
labor (weakening "profits from the efforts of others"), paid only as non-cashable store credit, no cap, no
recoup framing; the advertising is an ordinary product sale. *Confirm:* investment-contract risk; that "keep
100% of your own survey earnings" is clean as a rate/loyalty benefit; the overall impression where price sits
near the perk/grant.

**(b) FTC earnings claims / Business Opportunity Rule.** No income projections; results are hypothetical until
substantiated; value framed as advertising delivered. *Confirm:* the marketing copy avoids an implied
earnings/biz-opp claim.

**(c) Delivery guarantee.** Advertising delivered, amount-not-date, deliver-until-met, no ROI. *Confirm:* the
framing and disclosure are sufficient and conspicuous.

**(d) Crowdfunding / pre-sale + two-phase use-of-funds.** Non-refundable pre-sale to build-then-deliver. The
use-of-funds is **two-phase**: **Phase 1** — the funds go to **business expenses** (any lawful cost of operating
and growing the business, including acquiring the ~400,000-user audience) **until both user milestones are
met**; **Phase 2** — once both are met, the funds are the owner's to use at its **sole discretion for any lawful
purpose** (no longer limited to business expenses). *Confirm:* pre-sale obligations; whether any portion must be
refundable/escrowed; whether the **Phase-1 business-expenses restriction** (looser than a specific-purpose
earmark, but still a restriction) bears on escrow/custodial treatment; record-keeping and reserve-to-deliver
standard.

**(e) Money transmission / stored value.** Consumer balances are **closed-loop, non-cashable** Site Cash;
presale proceeds are the operator's revenue, not held for the customer. *Confirm:* no state stored-value /
money-transmitter statute applies to the store credit or the proceeds in target states.

**(f) Consumer protection / non-refundable.** Prominent non-refundable disclosure + explicit consent; **no
negative-option billing on the paid path** as built; upsells are optional. *Confirm:* the disclosure suffices in
target states.

**(g) Free trial → auto-conversion (negative option / ROSCA / FTC Negative-Option Rule / state auto-renewal).**
A free-trial entry auto-converts to the paid plan, built as a *compliant* negative option with six safeguards:
(1) recurring 13-cycle billing, **not a $13k lump on silence**; (2) charge fires **only after value is
delivered** (the audience/launch milestone); (3) the auto-charge term is in a **signed B2B order form**; (4)
**standalone, un-prechecked, logged consent** + confirmation email; (5) **advance reminders (7/3/1 days) with
one-click cancel**; (6) a **post-conversion refund window** (30 days). Controlled by `FOUNDING_FREE_TRIAL_*`
flags, **default OFF**. *Confirm:* whether the buyer is a **business, not a consumer**, under ROSCA and each
state auto-renewal law (sole proprietors may blur this — a potentially decisive risk reducer); whether the
six-safeguard structure satisfies ROSCA + the FTC Negative-Option / click-to-cancel Rule + state ARLs
(California in particular); the disclosure/consent copy, reminder cadence, cancellation flow, and
refund-as-cash-vs-credit; and sign-off before any flag is enabled.

**(h) Two-phase price.** Founding $13,000 → standard Tier 1 $16,900 (+30%) at the cap; founders grandfathered;
the cap owes nothing to earlier buyers. *Confirm:* the two-tier price presentation is clean.

## 4. The two launch gates

Full delivery is gated on reaching **both** 200,000 founding advertisers **and** a separate 200,000
premium-user pool (~400,000 users total). The gate governs **delivery**, not a refund (non-refundable presale);
under escrow/hybrid the refundable portion flags for refund if a deadline passes with either gate unmet.

## 5. What is intentionally NOT in the offer

No guaranteed return / recoup / return-of-capital; no stated earnings amount; no promised delivery date or ROI;
no consumer-credit/debt; no mandatory recruitment (referrals accelerate, never required); no cash-out of Site
Cash; no auto-charge for an earnings shortfall.

## 6. Operator controls counsel should know exist

`FOUNDING_MAX_SCALE_ENABLED`, `FOUNDING_CATEGORY_EXCLUSIVITY`, `FOUNDING_LAUNCH_MILESTONE_PREMIUM_USERS`,
`FOUNDING_DISCLOSURE_COPY`, `FOUNDING_FUNDS_MODEL` (presale / escrow / hybrid), and `FOUNDING_FREE_TRIAL_*`
(default OFF). Money / identity / legal actions are permanently human/counsel-gated, with a global kill switch.

## 7. The specific asks for counsel

1. Securities / Howey posture (§3a).
2. FTC earnings-claim / biz-opp posture and marketing copy (§3b).
3. Delivery-guarantee framing + disclosure (§3c).
4. **Two-phase use-of-funds** — Phase-1 business-expenses restriction vs. escrow/custodial treatment; pre-sale
   obligations; reserve-to-deliver standard (§3d).
5. Money-transmission / stored-value across target states (§3e).
6. Consumer-protection / non-refundable disclosure (§3f).
7. **Free-trial auto-conversion** — business-vs-consumer status; ROSCA + FTC + state ARL compliance; the
   disclosure/consent/reminder/cancel/refund design; sign-off before enabling (§3g).
8. Two-tier price presentation (§3h).

---

*Not legal advice; prepared for counsel review. Related: `CURRENT-FOUNDING-OFFER`,
`FOUNDING-OFFER-DESIGN-AND-BUILD`, `FOR-YOUR-ATTORNEY.md`.*
