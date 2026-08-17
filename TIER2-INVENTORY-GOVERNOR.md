# Ad-Inventory Governor — never oversell what the audience can serve

*How the platform sizes advertiser demand to real audience supply, so a Tier 1 / Tier 2 seat is only ever sold
when its promised impressions can actually be delivered. Current as of 2026-08-15. Admin-tunable; benchmark
assumptions, not guarantees; not legal advice.*

## Why this exists

Impression inventory is **DAU-limited**: you can only serve as many ad impressions as your daily-active users
generate. Selling more advertiser allotments than that means under-delivering a promised impression count — a
breach, and exactly the kind of "we can't substantiate what we sold" problem the compliance posture avoids.
`FOUNDING_ADVERTISER_SLOTS = 100,000` is a marketing number, not an inventory-backed one; the governor is what
makes availability real.

## The model

```
annual capacity  =  DAU × INVENTORY_IMPRESSIONS_PER_USER_DAY × 365 × (1 − INVENTORY_SAFETY_BUFFER_PCT)
committed        =  (active Tier 1 seats × Tier 1 allotment) + (active Tier 2 seats × Tier 2 allotment)
remaining        =  max(0, capacity − committed)
```

- **Tier 1 allotment** = `FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR` (200,000) + `TIER1_LAUNCH_BONUS_IMPRESSIONS` (100,000) = 300,000/yr.
- **Tier 2 allotment** = `TIER2_IMPRESSIONS_PER_YEAR` (3,000,000) + `TIER2_VIDEO_VIEWS_PER_YEAR` (500,000) = 3,500,000/yr.
- **DAU** is measured from `DailyEarnings` activity over `INVENTORY_DAU_WINDOW_DAYS` (each row is one active
  user-day, so rows-in-window ÷ window ≈ average DAU), or pinned via `INVENTORY_DAU_OVERRIDE` once you have a
  reliable analytics number. It **fails safe**: an unreadable/truncated measure under-estimates DAU, which
  under-estimates capacity and blocks sales earlier — never oversells.

## What it does

- **Gates new sales.** `inventorySaleBlock(tier)` is wired into `foundingAdvertiserSignup` (Tier 1) and
  `tier2BuyPart` (the first part = a new Tier 2 seat). If there isn't headroom for the seat's allotment, the
  sale is refused with a clear message ("inventory is full for the current audience — more seats open as it
  grows"). Toggle with `INVENTORY_GOVERNOR_ENABLED`.
- **Sizes availability.** `inventoryStatus` (admin) reports DAU, capacity, committed, remaining, utilization,
  and **how many more Tier 1 / Tier 2 seats fit** right now — a live, inventory-backed replacement for the
  static 100k slot cap.
- **Watches delivery.** `fillRate(promisedYear, served, fractionOfYearElapsed)` reports per-advertiser pacing
  (served vs what should be served by now) and flags anyone materially behind (`< 90%`), using the
  `impressions_served` already tracked per advertiser.

## What this means at 100,000 users

100k *registered* users is not 100k daily-active. At a realistic 25–40% DAU (~25k–40k) and 8 impressions per
active day, capacity is roughly **62M–99M servable impressions/year**, which supports on the order of **17–28
concurrent Tier 2 advertisers** (or ~200–330 Tier 1). The system side is already designed for this scale
(`AWS-SCALING-ARCHITECTURE.md`, `LOAD-TEST-PLAN.md`). So Tier 2 works comfortably at 100k users — the governor
is what keeps you from selling the 29th Tier 2 seat you couldn't serve, and it opens more automatically as DAU
climbs. (At a tiny audience — e.g. 1,000 DAU — it correctly allows zero Tier 2 seats, since one seat alone
needs 3.5M/yr.)

## Tier 2 is always open to join (capacity-paced) + a protected reserve

Two levers make Tier 2 joinable by **anyone from day one** without overselling:

- **Always open (`TIER2_ALWAYS_OPEN`, on).** A Tier 2 seat is always accepted. If current inventory can serve
  it in full, it's placed **immediate**. If not, it's placed **capacity-paced**: the full impression allotment
  is guaranteed as a **total over the term** and delivered as the audience grows (slow at launch, accelerating
  with DAU). The seat is stamped `delivery_mode` and the buyer is told plainly. Nobody is blocked; nothing is
  promised as a fixed year-one number it can't hit. (`inventoryPlacement` returns immediate / capacity_paced /
  blocked; blocked only occurs if always-open is turned off.)
- **Tier 2 reserve (`TIER2_CAPACITY_RESERVE_PCT`, 0.5).** Tier 1 sales are capped at (1 − reserve) of capacity,
  so Tier 1 can never consume the room held for Tier 2. This is the "make Tier 1 leave enough for Tier 2" lever
  — raise it to favor Tier 2, lower it to sell more Tier 1.

So at launch with a tiny audience, immediate Tier 2 seats may be 0, but Tier 2 is still **joinable** (every
seat capacity-paced), and as DAU climbs, immediate seats appear automatically. At 30k DAU with a 50% reserve,
that's ~21 immediate Tier 2 seats plus ~124 Tier 1 — and Tier 1 stays capped so those 21 are protected.

## Showing available seats (governor + website)

- **Governor:** `inventoryStatus` (admin) returns `tier2_immediate_seats`, `tier1_sellable`, the reserve, and
  per-tier remaining headroom.
- **Website:** `publicSeatAvailability` feeds `advertiserApplyInfo`, and the `/Apply` page shows a live
  **"N seats available"** badge on the Tier 2 card (or **"Always open"** when immediate seats are 0), plus a
  one-line explanation that additional seats deliver as the audience grows. Honest, inventory-backed scarcity.

## Settings

`INVENTORY_GOVERNOR_ENABLED` (on), `INVENTORY_IMPRESSIONS_PER_USER_DAY` (8), `INVENTORY_DAU_WINDOW_DAYS` (7),
`INVENTORY_SAFETY_BUFFER_PCT` (0.15), `INVENTORY_DAU_OVERRIDE` (0 = auto), `TIER2_ALWAYS_OPEN` (on),
`TIER2_CAPACITY_RESERVE_PCT` (0.5). SDK: `backend/sdk/inventory-governor.ts`.
