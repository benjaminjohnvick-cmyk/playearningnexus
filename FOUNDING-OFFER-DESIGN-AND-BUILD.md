# Founding Offer — Design & Build

*How the founding pre-launch advertiser offer works and what is built to support it. Get Goods Gratis (Free) —
an 18+ closed-loop retail / e-commerce rewards marketplace. Companion to `CURRENT-FOUNDING-OFFER` (the plain
description) and `FOUNDING-OFFER-COUNSEL-REVIEW` (the counsel packet).*

---

## 1. The two-phase offer (Founding → Tier 1)

- **Phase 1 — Founding (pre-revenue).** The first **200,000 founding advertisers** enroll at **$13,000/year**
  (billed **$1,000 every 4 weeks across 13 cycles**, a 4-year package). This is a hard slot cap, independent of
  user count.
- **Phase 2 — Tier 1 (standard).** When the 200,000th founding slot fills, the offer **closes** and becomes the
  standard Tier 1 offer at **+30% ($16,900/year)**. Existing founders are **grandfathered** — they keep the
  founding price and the entire founding perk stack for life. Reaching the cap owes **nothing** to earlier
  buyers; it is a pure availability threshold, not a payout event.
- **Category exclusivity** — each founder is the only founding advertiser in their category during the founding
  window.

## 2. Entry: free trial → auto-convert to paid

A business can **start the offer free** (no payment to begin) and it **auto-converts to the paid founding plan**,
built as a compliant conversion:

- **Recurring, not lump-sum** — conversion bills the 13-cycle schedule ($1,000 / 4 weeks), cancelable any cycle.
- **Charged only after value is delivered** — conversion triggers on the audience/launch milestone, once
  advertising has begun delivering.
- **Signed B2B order form** — the conversion terms are in a business order form the advertiser signs.
- **Standalone, logged consent** — a separate, plain-language confirmation of what is charged and when, recorded
  at signup and restated by email.
- **Advance reminders + one-click cancel** — reminders before the first charge; canceling is as easy as signup.
- **Refund window** — a money-back window after conversion.

Controlled by `FOUNDING_FREE_TRIAL_*` settings (default OFF). The billing/consumer-protection specifics are
finalized with counsel before activation (see `FOUNDING-OFFER-COUNSEL-REVIEW`).

## 3. The advertising

- **200,000 ad impressions / year** across between-survey and social surfaces, on the 4-year term, with
  premier/priority placement and a sponsors-wall spot; **100,000 launch-bonus impressions** (one-time).
- **Capacity-paced, deliver-until-met** — guaranteed by **amount, not by date**: impressions deliver as the
  audience grows, and the platform keeps delivering, free, until the full promised amount is received. The
  guarantee is **advertising delivered**, never revenue, sales, or ROI.
- **Value stack** — $13,000 buys roughly **$26,000 (2×)** of advertising value, backed by guaranteed
  value-match impressions.
- **Audience-growth dividend** — the impression allotment grows automatically as the user base grows.

## 4. Included features + max-scale entitlement

- Premium membership; always-on **AI campaign manager + optimization**; **priority concierge support** (human
  escalation); free **AI-written creative** with ongoing refresh; **~30 AI social ad posts / month** (labeled);
  A/B testing, real-time analytics & attribution, consumer-sentiment insights; a **$2,000 Site Cash grant**
  (non-cashable store credit, released over the term).
- **Every feature at maximum (Tier 3 / Unlimited) capability, free** — a founding advertiser (`is_founding`)
  resolves to the highest capability level for every tier-gated feature: maximum AI Creative Suite generations,
  all ad formats, unlimited concurrent experiments, multivariate testing, the full automation ceiling,
  predictive learning, and image / video / brand-kit / localization / auto-refresh. Gated by
  `FOUNDING_MAX_SCALE_ENABLED` (default ON). This maxes feature **capability**, not the delivered ad-impression
  **volume**.
- **Keep 100% of your own survey earnings for life** (as non-cashable Site Cash); the standard rate is 75% for
  post-close members.
- **Founder-only perks:** founding price locked forever; "Founding Partner" badge + public wall; founder
  referral bonus; dedicated onboarding + quarterly strategy sessions; roadmap input / advisory + first beta
  access; co-marketing; annual creative refresh; better make-good / extended cancellation terms.

## 5. The two launch gates

Full delivery is gated on reaching **both**:

1. **200,000 founding advertisers**, and
2. a separate **200,000 regular premium users** — the audience founders advertise to (`FOUNDING_LAUNCH_MILESTONE_PREMIUM_USERS`
   = 200,000, measured on real premium memberships).

Together ~**400,000 users** in place before full public launch. The gate governs **delivery**, not a refund
(non-refundable in the default presale model).

## 6. How the funds are used (two-phase)

- **Phase 1 — business expenses only.** Until **both** user milestones above are met (~400,000 users total), the
  founding funds go to **business expenses** — any lawful cost of operating and growing the business (user
  acquisition, product, operations, staffing, marketing). During this phase the money is spent on the business,
  not taken as personal profit.
- **Phase 2 — full discretion.** Once Phase 1 is complete, the funds are the owner's to use at its **sole
  discretion for any lawful purpose**.

Founding contributions are **non-refundable** (presale model; escrow/hybrid supported by the same code).

## 7. What's built (settings)

- `FOUNDING_ADVERTISER_SLOTS` (200,000 cap) · `TIER1_PRICE_UPLIFT_OVER_FOUNDING_PCT` (0.30 → $16,900 at close) ·
  `FOUNDING_CATEGORY_EXCLUSIVITY` (on) · `FOUNDING_MAX_SCALE_ENABLED` (on) ·
  `FOUNDING_LAUNCH_MILESTONE_PREMIUM_USERS` (200,000) · `FOUNDING_DISCLOSURE_COPY` (capacity-paced delivery
  disclosure, recorded to the consent ledger on `/Apply`) · `FOUNDING_FUNDS_MODEL` (presale / escrow / hybrid) ·
  `FOUNDING_FREE_TRIAL_*` (free-trial auto-convert; default OFF).
- Price flips automatically when the cap fills; the 100%→75% survey-share revert and the grandfathering are in
  code. Founding perks surface on `/Apply` with the delivery disclosure and a required acceptance checkbox.

## 8. The free / no-upfront participation paths

Alongside the paid founding path there are participation paths — a **no-upfront** path and a **free
earn-to-unlock** path — which are delivery schedules, never debts: stop anytime, owe nothing, no penalty.

---

*Not legal advice. The offer, its mechanics, and every line of member-facing copy are reviewed by qualified
counsel before launch, and no money is collected until then. Site Cash — including the $2,000 grant — is
closed-loop and non-cashable.*
