# Payments Architecture & Merchant-Onboarding Brief

*The finalized real-money architecture for the platform, plus a ready-to-use description for a payment
processor's underwriting team. Use this when applying to your primary (Stripe) and backup merchant accounts.
Not legal advice; have counsel confirm the disclosures.*

## The architecture (finalized)

The platform is **closed-loop for users** — members earn **non-cashable Site Cash**, redeemable only on the
platform. We do **not** pay users cash. That means the only real money moving is on the **business** side, and
it can run on **one processor (Stripe)** in both directions:

- **Inbound — advertiser payments (B2B):** businesses buy advertising packages (e.g. Tier 1 ~$12,000/yr,
  Tier 2 up to $200,000). Ordinary B2B advertising commerce.
- **Outbound — partner payouts:** revenue-share and fees paid to **business partners** (developers,
  affiliates, advertisers) — vendor/contractor-style payments, 1099-reported. Not consumer payouts.
- **Users:** fully closed-loop, non-cashable Site Cash — **never touches a processor.**
- **Deposits:** advertiser payments may be captured upfront and **held** (Stripe balance) for up to ~180 days,
  earned as advertising delivers, with refund/make-good on any undelivered portion.

**Backup rail:** a second, approved merchant account kept dormant/low-volume so a single-processor freeze can't
take the business offline. Recommended backups (high-risk-friendly): PaymentCloud, Soar Payments, Durango
Merchant Services.

## Why this is low-risk to process (the underwriting story)

Present the business as what it is — a B2B advertising platform whose consumer side is closed-loop:

- **We are a B2B advertising business.** Processed revenue is advertising sold to businesses. That's the
  MCC-7311 (Advertising Services) lane, not a "get-paid-to" consumer cash site.
- **Users are paid in non-cashable store credit, not cash.** No mass consumer cash payouts run through the
  processor. This is the single biggest risk reducer versus a typical survey/rewards site.
- **No earnings claims.** Results/earnings are shown only when substantiated by real data (hypothetical-until-
  substantiated); no "get rich quick" or "unrealistic rewards" language — the exact phrasing processors flag.
- **Contests are skill/merit-based** with a no-purchase-necessary (AMOE) free entry and official rules — not a
  paid-entry monetary sweepstakes.
- **Referrals are single-tier** — no multi-level/recruitment commission (no MLM flag).
- **No negative-option billing.** Advertiser deposits are **captured upfront**, not auto-charged later.
- **Partner payouts are vendor/rev-share** (developers/affiliates), 1099-reported — normal business payments,
  gated to verified partners, not third-party money transmission.

## Disclose the deposit/hold model up front

Be explicit that some advertiser payments are **prepaid and delivered over up to ~180 days** ("future
delivery"). Underwriters treat delayed fulfillment as elevated-risk, so state it plainly, along with:

- The **refund / make-good policy** (undelivered impressions are delivered or refunded pro-rata).
- That refunds are handled within the processor's ~180-day window (align the hold length to it).
- Expected **ticket sizes** ($1,000–$200,000), **monthly volume**, and **chargeback expectation** (low — B2B
  contracts with signed terms).

Disclosing this now prevents a surprise rolling reserve later.

## What to have ready for the application

- Legal entity name + **EIN**, business **bank account** (for settlement/payouts).
- **Owner ID / KYB** documents.
- **Website** (present the advertiser-facing B2B product clearly; the closed-loop user model described honestly).
- **Refund policy** + **terms of service** (you have these).
- Any **processing history** (volume, chargeback rate) if you have it.
- Requested **MCC**: 7311 (Advertising Services).

## What each party does

- **You:** submit the applications (primary + backup), provide EIN/bank/ID, sign the processor agreements.
- **This brief:** the business description + risk-mitigation talking points to attach or paste into the
  application and to answer underwriting questions consistently.
- **Counsel:** confirm the deposit/refund disclosures and the money-flow description before you rely on them
  (this ties to the escrow/deposit and partner-payout items in `FOR-YOUR-ATTORNEY.md`).

## One-line summary for an underwriter

"A B2B advertising platform: we sell advertising to businesses (inbound) and pay our developer/affiliate
partners their revenue share (outbound, 1099'd). Consumers earn only non-cashable on-platform credit — we do
not pay users cash. Some advertiser payments are prepaid and delivered over up to 180 days, with a
refund/make-good policy."
