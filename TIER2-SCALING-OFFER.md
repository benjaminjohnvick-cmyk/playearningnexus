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

## What $200k actually buys (the deliverables)

Tier 2 is a scaled-up version of Tier 1, delivered **as parts are bought** — quantities pro-rate across the
12 parts, and richer perks unlock as the advertiser climbs the ladder:

**Quantities (full-year package, delivered proportionally — 1/12 per part):**
- **3,000,000 ad impressions/year** between-survey + featured (vs 200,000 at Tier 1) — `TIER2_IMPRESSIONS_PER_YEAR`
- **100 AI social posts/month** (vs ~30 at Tier 1) — `TIER2_AI_SOCIAL_POSTS_PER_MONTH`
- **4 included audience-panel studies/year** (aggregate, consented) — `TIER2_AUDIENCE_PANELS_PER_YEAR`

**Perks (unlock as you scale — `TIER2_PERK_UNLOCKS`, part thresholds shown):**
- Part 1: Premier between-survey placement (top priority, above Tier 1); managed AI ad creative; advanced
  analytics dashboard
- Part 2: Multivariate A/B testing; enhanced sentiment insights
- Part 3: Included audience-panel research; dedicated success manager / managed campaigns
- Part 6: Homepage & category featured placement + premier sponsor wall
- Part 9: API access + data feed
- Part 12: full package complete

Plus, in the expanded conventional rate card: **500,000 rewarded/in-survey video views/yr**, **12 email
campaigns/yr** to the opted-in audience, **6 sponsored newsletter placements/yr**, **2 brand-lift studies/yr**,
and **4 category/competitive insights reports/yr** — all fielded from the same audience.

All of it is admin-tunable — the quantities are settings and the perk unlock thresholds are a JSON map, so you
can reorder, add, or re-gate perks without a deploy. `tier2Deliverables(partsCompleted)` computes the full
package and what's delivered/unlocked so far; the `/Tier2Scaling` page shows both.

**AI-managed delivery.** Every A–D deliverable is served by the platform's AI system with **no per-advertiser
human staffing** (flag `ai_ad_manager`) — ad serving, AI creative, automated email/social/newsletter,
real-respondent audience & brand-lift panels, competitive insights, data feed/API, analytics, and always-on
AI campaign optimization. The conventional list value totals **~$404,300** (a conservative **2× / "$200k →
$400k in advertising value"** — see TIER2-VALUE-STACK.md), bundled at **$200,000** (~50% off
rate card). Two honesty rules keep that value real: research is fielded to REAL consented respondents, and the
account line is an **AI campaign manager** (human escalation available), never sold as a dedicated human. Full
breakdown, per-line values, and the engine each maps to: **`TIER2-AI-MANAGEMENT-AND-RATE-CARD.md`**.

## Why this is NOT credit (and needs no lending gate)

Each part is a **separate upfront purchase** — the advertiser pays for a part when they buy it, then decides
whether to buy the next one later. Nothing is deferred and no balance is owed, so this is ordinary pay-as-you-go
commerce, **not** an installment/credit product. (Contrast the *Flexible Payment* feature, which splits one
price into owed installments and is gated off behind a provider + counsel.) The `tier2BuyPart` function records
the progression and returns the amount due; the actual charge for each part runs through the normal checkout
processor.

## The 5-year results-gated continuation ("stay in while it's working")

A successful advertiser can continue Tier 2 year over year, up to **`TIER2_TERM_YEARS` (5)** — one 12-part
cycle per year, up to ~$1M of scaling over five years. Three rules keep a multi-year "stay" a defensible
enterprise agreement rather than a coercive lock:

- **Results-gated.** A year only continues when that year's **real attributed results ≥
  `TIER2_CONTINUATION_RESULTS_MULT` × the year's cost** (default 1× — the year at least paid for itself). If
  results fall short, the advertiser can **always exit** — you never hold a losing advertiser in. That's the
  fairness protection that makes the whole thing defensible.
- **Consent-gated for "binding."** A results-warranted year is only **binding** if the advertiser
  **voluntarily opted into the multi-year term up front** (`tier2AcceptMultiYear`, recorded consent) in
  exchange for consideration — the locked founding discount / bonus inventory for the term. Without that
  opt-in, a warranted year is merely **offered** (they can decline). A binding stay is never imposed
  unilaterally; it requires their up-front agreement (`TIER2_MULTIYEAR_COMMITMENT_OPTIN`).
- **Renewal notice.** `TIER2_RENEWAL_NOTICE_DAYS` (30) of advance notice before each annual renewal charges,
  with a cancel window — for auto-renewal-law compliance (e.g. CA ARL, FTC negative-option rule).

So the only case where an advertiser "has to stay" is: they voluntarily committed **and** the results warrant
it **and** they're still inside the 5 years. A losing year, or an advertiser who never committed, can always
walk. `tier2ContinuationStatus` computes this live from real attributed sales; `tier2AcceptMultiYear` records
the voluntary opt-in. **Not legal advice** — have counsel confirm the multi-year terms + auto-renewal
disclosures for your states.

## The rollover discount (and the founding perk)

A **5.5% Tier 1 → Tier 2 rollover discount** (`FOUNDING_UPGRADE_DISCOUNT_PCT`) comes off each part:

- **First year:** anyone who rolls up from Tier 1 gets the 5.5% on their parts during the first year of Tier 2.
- **After the first year:** the discount **stops** — the parts are full price.
- **Founding members** (holders of a founding Tier 1 seat): keep the **5.5% in perpetuity**, even beyond year
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
