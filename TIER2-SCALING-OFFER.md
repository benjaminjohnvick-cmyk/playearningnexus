# Tier 2 "Scale" — the 30-day parts offer

*How the $200,000 Tier 2 upgrade is sold: in monthly parts, pay-as-you-go, scaling on results. Not legal
advice, but note the important point below: this is **not** credit.*

## The structure

Tier 2 ("Scale", $200,000) is divided into **12 equal monthly parts** (~$16,666.67 each). The advertiser buys
one part at a time:

- Each part runs **at least 30 days**. Only then can the next part be bought.
- The next part is offered **based on results** — optionally gated so a part must have returned at least a set
  fraction of its cost before scaling up (`TIER2_PART_MIN_RESULTS_MULT`; 0 = 30-day pacing only).
- **12 parts × ~30 days ≈ one year → Tier 2 complete.**

## Why this is NOT credit (and needs no lending gate)

Each part is a **separate upfront purchase** — the advertiser pays for a part when they buy it, then decides
whether to buy the next one later. Nothing is deferred and no balance is owed, so this is ordinary pay-as-you-go
commerce, **not** an installment/credit product. (Contrast the *Flexible Payment* feature, which splits one
price into owed installments and is gated off behind a provider + counsel.) The `tier2BuyPart` function records
the progression and returns the amount due; the actual charge for each part runs through the normal checkout
processor.

## The rollover discount (and the founding perk)

A **6% Tier 1 → Tier 2 rollover discount** (`FOUNDING_UPGRADE_DISCOUNT_PCT`) comes off each part:

- **First year:** anyone who rolls up from Tier 1 gets the 6% on their parts during the first year of Tier 2.
- **After the first year:** the discount **stops** — the parts are full price.
- **Founding members** (holders of a founding Tier 1 seat): keep the **6% in perpetuity**, even beyond year
  one. `TIER2_FOUNDING_DISCOUNT_PERPETUAL` = true.

The effective rate is computed live: `tier2DiscountRate(isFounding, monthsSinceStart)` → founding-perpetual,
else first-year-only, else 0. "Founding" is detected from an active `FoundingAdvertiser` seat.

## Where it lives in code

- Settings (Tier 2 Scaling): `TIER2_PARTS` (12), `TIER2_PART_MIN_DAYS` (30), `TIER2_TERM_MONTHS` (12),
  `TIER2_PART_MIN_RESULTS_MULT` (0), `TIER2_DISCOUNT_FIRST_YEAR_ONLY` (true),
  `TIER2_FOUNDING_DISCOUNT_PERPETUAL` (true). Total/name/discount reuse the founding-upgrade settings
  (`FOUNDING_UPGRADE_PRICE_USD` = 200000, `FOUNDING_UPGRADE_NAME`, `FOUNDING_UPGRADE_DISCOUNT_PCT` = 0.06).
- Model: `backend/sdk/tier2-scaling.ts` — `tier2Ladder`, `tier2DiscountRate`, `tier2Status`.
- Entity: `Tier2ScalingPlan` (owner-scoped) — tracks parts_completed, current_part_started_at, is_founding, paid.
- Functions: `tier2ScalingStatus` (read), `tier2BuyPart` (advance one part; gated on 30 days + results;
  returns the amount due — does not move money).
- Page: `/Tier2Scaling` — the ladder, progress, current part price with discount, 30-day/results gate, and the
  founding-perpetual badge.
