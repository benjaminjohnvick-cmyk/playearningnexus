# Founding (Pre-Revenue) Offer → Tier 1 — Design Spec

*A two-phase advertiser offer: a capped **Founding / Pre-Revenue** offer that funds the launch, then a standard
**Tier 1** offer that takes over once the founding cap fills. Planning/discussion doc — nothing is coded yet.
Not legal advice; the disclosure points below are for counsel.*

## The model in one picture

```
PHASE 1 — FOUNDING (PRE-REVENUE)                    PHASE 2 — TIER 1 (STANDARD)
first 200,000 founding advertisers        ──▶       opens automatically when the
• prepay the Tier 1 price ($13,000)                 200,000th founding slot is taken
• double as year-1 beta users + feedback            • same core, founder-only perks removed
• $2,000 site credit over 12 months                 • existing founders GRANDFATHERED (keep it all)
• get EVERY perk (current + all add-ons)
        │
        └─ capital is used to acquire 200,000 regular PREMIUM users
           BEFORE the full public launch (the launch gate)
```

## Phase 1 — The Founding / Pre-Revenue Offer

- **Cap: the first 200,000 founding advertisers** (a hard slot cap, independent of user count).
- **Purpose — pre-revenue capital.** Founders prepay the Tier 1 price up front; that capital is used to
  **acquire at least 200,000 regular *premium* users before the full public launch** (the launch gate below).
- **Founders double as year-one users + feedback partners.** They actively use the platform for the first year
  and provide feedback — framed as a founding-partner *privilege/role*, not a paid obligation.
- **$2,000 in on-site credit, spent over 12 months** (~$166.67/month, non-cashable Site Cash) — the firm
  founding credit (this supersedes the old "up to $2,000 gift boost, subject to availability" wording).

### The launch gate

Full public launch does **not** happen until the founding capital has acquired **≥ 200,000 regular premium
users.** Until then, founder advertising delivers **capacity-paced** (as the audience grows) and is backed by the
delivery guarantee — no fixed year-one volume is promised, and any shortfall is made good over time.

### Payment & the guarantee (decision: option (b))

- **200,000 is an aspirational headline ceiling**, and the guarantee is **purely capacity-paced with NO fixed
  timeline**: "your advertising delivers as our audience grows, and we keep delivering — free — until you've
  received the full amount you were promised."
- **One payment, nothing more until you're made whole.** A founder pays the $13,000 **once, up front**, and
  **owes no additional dollar** — no renewal, no top-up — **until their full guaranteed advertising has been
  delivered.** We keep serving it (make-good, no time cap) until met. This is already how the deliver-until-met
  guarantee works; the founding offer states it explicitly.

### Founding perks — EVERYTHING (current stack + all add-ons)

**Already in the app (keep all):**
1. 200,000 ad impressions / year, on a 4-year term
2. 100,000 launch-bonus impressions (one-time)
3. Premier featured placement + a spot on the sponsors wall
4. Free AI-written ad creative (ongoing refresh)
5. Always-on AI campaign manager + optimization
6. ~30 AI social ad posts / month (clearly labeled)
7. A/B testing, real-time analytics & attribution, consumer-sentiment insights
8. Priority concierge support
9. Premium membership included
10. **$2,000 site credit over 12 months** (non-cashable)
11. Full-Value Delivery Guarantee (make-good, deliver-until-met)
12. 30-day proportional cancellation (keep 2/3, refund 1/3)
13. Value stack: $13,000 → ~$26,000 in advertising value (2×), backed by guaranteed value-match impressions

**Added (all of the "could-add" list):**
14. **Founding price locked forever** — the $13,000 rate never rises for as long as they stay
15. **"Founding Partner" verified badge** + a permanent spot on a public Founding Partners wall
16. **Category exclusivity / first right of refusal** during the founding window
17. **Audience-growth dividend** — impression allotment grows automatically as the user base grows
18. **Grandfathering** — keep the entire founding perk stack permanently, even after Tier 1 takes over
19. **Founder referral bonus** — refer another advertiser, earn bonus impressions / account credit
20. **Dedicated onboarding + quarterly strategy session** (AI campaign manager, human escalation)
21. **Roadmap input / founder advisory** + first beta access to every new ad surface & AI tool
22. **Co-marketing** — launch PR, "founding partners" announcements, case studies
23. **Keep 100% of your own survey earnings — for life** (as Site Cash; supersedes the 100%→75% revert)
24. **Annual free creative refresh / seasonal campaign packs**
25. **Better make-good / extended cancellation terms** than standard Tier 1
26. **Locked-in renewal rate** (kept from the current stack; now framed as the for-life price lock in #14)
27. **Early access** to new surfaces (kept from the current stack; folded into #21)

## Phase 2 — Tier 1 (takes over when the 200,000th slot fills)

Same compliant core, founder-only perks removed so the founding deal stays clearly the best.

**Tier 1 keeps:** 200,000 impressions/yr + 4-year term · value stack ($13,000 → ~$26,000) · Full-Value Delivery
Guarantee · AI creative + AI campaign manager · analytics / A-B / sentiment · premium membership · 30-day
cancellation · **AI-powered concierge support (human escalation available)** — kept, not dropped.

**Tier 1 drops / reduces vs founding:**
- **No** 100,000 launch-bonus impressions (founding-only)
- Survey earn-share **reverts to the standard 75%** (founders keep 100% for life) — *already built into the code*
- **No** for-life Tier 2 discount (standard rate, or a smaller time-limited one)
- **No** Founding badge / co-marketing / category exclusivity
- Renewal rate **not** locked for life (founders keep the for-life price lock)
- Optionally a slightly **higher price** or a **reduced credit**, to keep the founding deal clearly better

*(Support: Tier 1 keeps concierge, delivered by AI with human escalation — same model as the AI campaign
manager, so it's not sold as a dedicated human hire.)*

### The handoff (automatic)

When the founding advertiser count hits **200,000**, the `/Apply` page flips the headline from **"Founding
Advertiser — Tier 1"** to plain **"Tier 1,"** founding-only perks stop being offered to *new* signups, and
**existing founders keep everything they signed up for** (grandfathered). The countdown ("Founding closes at
200,000 partners — N slots left") becomes a real marketing hook.

## ⚠️ Reality check — the 200,000-advertiser cap vs deliverable inventory

This is the one part of the plan I have to push back on, because it's the exact oversell problem the inventory
governor guards against:

- 200,000 founders × 200,000 guaranteed impressions/yr = **40,000,000,000 (40 billion) impressions promised per
  year.**
- 200,000 premium users × ~8 impressions/active day × 365 ≈ **584,000,000 (584 million) servable per year.**
- That's **~68× oversold.** Even with capacity-paced "deliver until met," clearing the promised volume at a
  200k-user audience would take **~68 years** — far beyond the 4-year term.
- At a 200k-user audience, the inventory can serve roughly **~2,900 advertisers per year** at the full 200k/yr
  allotment — not 200,000.
- (For scale: a full 200,000 × $13,000 would be **$2.6 billion** prepaid — useful as a headline ceiling, but not
  a realistic near-term signup count.)

**Decision: (b) — chosen.** Keep "200,000" as an **aspirational headline ceiling**, with the guarantee stated
**purely capacity-paced, no fixed timeline** ("your impressions deliver as our audience grows, and we keep
delivering — free — until you've received the full amount, however long it takes"). This is workable and the
governor already enforces it (it never promises a fixed year-one volume it can't serve). The ~68× gap must be
**disclosed clearly and conspicuously** so no founder infers a near-term delivery date — that disclosure is what
keeps a capacity-paced, no-timeline promise substantiable. (Options (a) right-size and (c) lower per-founder
impressions remain available later if the disclosure feels too heavy.)

The governor already prevents silent overselling (it capacity-paces and never promises a fixed year-one volume
it can't serve) — so nothing breaks — but a 200k-advertiser headline sets an expectation the audience can't meet
for decades. Worth deciding before this goes in front of advertisers or counsel.

## ⚠️ On "ROI" — what the guarantee can and cannot say

The plan is to guarantee delivery **"along with their ROI."** We **cannot** guarantee ROI/return, and this is the
one hard line to hold:

- **Guaranteeing an ROI or a return is a performance/financial guarantee** — unmeasurable off-platform (it
  depends on the advertiser's own offer, margins, and funnel), an **FTC red flag**, a **payment-processor red
  flag**, and an **unbounded liability** (you'd owe against their sales with no natural cap). It's the single
  fastest way to get an account shut down or a claim filed.
- **What we CAN guarantee — and it does the same marketing job — is the full ADVERTISING VALUE delivered.** The
  founder pays $13,000 and is guaranteed to **receive ~$26,000 of advertising** (the 2× value stack:
  impressions, placements, creative, managed service at conventional rates), **delivered capacity-paced until
  met, with no additional payment until then.** That's a concrete "you get more than you paid for" promise we can
  actually stand behind and measure on-platform.
- **We can also give them results *reporting*** — benchmarks and measured outcomes for their campaigns — we just
  **never guarantee a revenue number.** "Here's what your advertising delivered and how it performed" is fine;
  "we guarantee you'll make X back" is not.

**The compliant translation of "delivery + their ROI":** *"You pay $13,000 once. You're guaranteed the full
~$26,000 of advertising you were promised — we keep delivering it until you've received every dollar of it, at no
extra charge — and you'll see exactly what it delivered."* Same emotional payload (more value than you paid,
guaranteed), zero return/ROI promise.

## Compliance notes (for counsel)

- **Prepayment, not credit.** Founders prepay for advertising services; the capital is unearned revenue
  recognized as delivery occurs. Using it to acquire users pre-launch is fine **provided** the capacity-paced,
  deliver-until-met guarantee is disclosed up front (no fixed launch date or year-one volume is promised).
- **$2,000 site credit** is non-cashable, closed-loop, spendable only on-site over 12 months — never cash.
- **Feedback/beta role** is a founding privilege, not compensation, and the survey earn-share is a share of
  *whatever they actually earn*, non-guaranteed, paid as Site Cash — never a return on the advertising.
- **No revenue/ROI promise anywhere** — every figure is advertising *value delivered*.
- **Grandfathering + for-life price lock** are pricing benefits (a rate lock), never a promised return.

## Decisions locked

- **Founding cap:** 200,000 advertisers as an **aspirational headline ceiling**; guarantee is **capacity-paced,
  no fixed timeline** (option (b)). ✅
- **Payment:** one $13,000 prepayment; **no additional dollar owed until the full guaranteed advertising is
  delivered** (make-good until met). ✅
- **Guarantee wording:** the full **~$26,000 of advertising value delivered** (2×) until met — **NOT** an ROI or
  revenue guarantee. Results are *reported/benchmarked*, never guaranteed. ✅
- **Founding perks:** entire current stack **plus** all add-ons (list above); founders keep 100% survey earn-share
  for life and are grandfathered. ✅
- **Tier 1 takeover:** at the 200,000th slot; reductions per the list; existing founders grandfathered. ✅

## Decisions locked (added)

- **Guarantee reframe accepted:** advertising **value delivered (~$26k / 2×), pay-once-until-met, results
  reported not guaranteed** — never an ROI/return promise. ✅
- **Post-founding Tier 1 keeps concierge support**, delivered by **AI** (human escalation available). ✅

## Built (2026-08-20)

- **Founding cap = 200,000** (`FOUNDING_ADVERTISER_SLOTS`) — aspirational headline; capacity-paced, no timeline.
- **Post-founding Tier 1 = +30%** over founding (`TIER1_PRICE_UPLIFT_OVER_FOUNDING_PCT` = 0.30): $13,000 →
  **$16,900**. Founders keep their founding price (grandfathered). The signup + `/Apply` price flip automatically
  when the cap fills.
- **Category exclusivity for every founder** (`FOUNDING_CATEGORY_EXCLUSIVITY`, on): a founder claims a category
  no other live founder can hold; enforced at signup (`foundingCategoryTaken`).
- **Capacity-paced delivery disclosure** (`FOUNDING_DISCLOSURE_COPY`, built-in default) — recorded in the
  consent ledger at signup and shown clear-and-conspicuously on `/Apply`.
- Founding perks surfaced on `/Apply` (founding price lock, Founding Partner badge, for-life Tier 2 discount,
  100%-for-life earn-share, category exclusivity); post-founding Tier 1 drops the founder-only ones and keeps
  AI concierge support. Tests: 61 pass; build + audit clean.

## Finalized delivery disclosure (2026-08-21)

The built-in `FOUNDING_DISCLOSURE_COPY` default is now the finalized, clear-and-conspicuous copy a founder
must see and accept before buying (recorded to the consent ledger; shown on `/Apply`). It carries four
non-negotiable points — override the setting only to tailor for a jurisdiction, and keep all four:

1. **Capacity-paced delivery — no fixed timeline.** Guaranteed by amount, not by date; delivers as the
   audience grows; no promised delivery date and no promised year-one volume.
2. **Delivered in full, at no extra cost, however long it takes.** Pay once, up front; owe nothing further;
   we keep delivering free until the full promised amount is received.
3. **What is guaranteed = advertising delivered** (a stated dollar amount of impressions/placements measured
   on our own surfaces) — **NOT** revenue, sales, sign-ups, ROI, or any business result.
4. **Not an investment** — a purchase of advertising and membership, not a security; no profit or "multiple"
   promised or implied.

*Counsel may further tailor the wording for a buyer's jurisdiction, but the four points above must survive —
the delivery guarantee frames advertising delivered, never ROI.*
