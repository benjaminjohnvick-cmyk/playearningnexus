# Scale Readiness — 200,000+ users and 200,000+ advertisers

*Last updated 2026-08-21. Numbers below are measured on a real PostgreSQL 16 instance seeded with 200,000
users + 200,000 advertisers + 200,000 memberships (600k rows) using `backend/db/scale-bench.sql`.*

## The short version

The database structure was already sound — every table has a GIN index for equality/containment lookups and
a `created_date` index for the default sort, so per-request lookups were never the problem. The problem was in
the **application code**: several hot paths sized a set (how many users, how many advertisers, how much
advertising is committed) by loading **every matching row into app memory and calling `.length`** or
`reduce()`. At a few thousand rows nobody notices; at 200k it pulls tens of megabytes across the wire and
builds hundreds of thousands of JS objects on every cache miss; at millions it falls over.

The fix pushes that work into the database, where it belongs. New primitives — `db.count()`, `db.sum()`, and a
keyset `db.scan()` streamer — replace the load-everything pattern. The result is the same numbers, 12–16×
faster, and constant memory instead of tens of megabytes per call.

## What changed (code)

**New `db` primitives** (`backend/sdk/db.ts`):

- `db.count(entity, query)` — `SELECT COUNT(*)` with the same filter compilation. Returns one integer; never
  materializes rows.
- `db.sum(entity, field, query)` — `SELECT SUM(...)` with a guarded numeric cast (a non-numeric row
  contributes 0 rather than erroring the query).
- `db.scan(entity, query, batch)` — an async generator that pages through **every** matching row in
  bounded-memory batches using keyset (`id > lastId`) pagination on the primary key. For full-table jobs that
  genuinely must touch each row, this replaces `filter(entity, q, sort, 200000)` with constant memory and
  constant per-page cost.
- `db.filterPage(entity, query, sort, limit, offset)` — offset pagination for admin/list endpoints.
- A new NULL-safe `$nin` (NOT IN) query operator, so "status is not refunded or cancelled" compiles to one
  indexed predicate that matches the app's `x !== a && x !== b` intent (an absent field passes).

**Hot paths converted from load-all-and-count to `count`/`sum`/`scan`:**

| Function | File | Before | After |
|---|---|---|---|
| `foundingSeatsTaken` | `founding-advertiser.ts` | load ≤200k rows, filter, `.length` | `count($nin status)` |
| `premiumUserCount` | `founding-advertiser.ts` | load ≤500k rows, `.length` | `count()` |
| `foundingCategoryTaken` | `founding-advertiser.ts` | load ≤20k founders, scan in JS | exact `category_key` lookup (GIN) |
| `inventoryStatus` (Tier 1 count) | `inventory-governor.ts` | load ≤20k rows, filter, `.length` | `count($nin status)` |
| `inventoryStatus` (Tier 2 plans) | `inventory-governor.ts` | load ≤20k rows at once | `scan()` in 2k batches |
| `activeAdvertiserCount` | `loyalty.ts` | load ≤100k rows, `.length` | `count()` |
| `enrolledLoyaltyCount` | `loyalty.ts` | load ≤100k rows, filter, `.length` | `count($nin ended)` |
| `totalUserCount` | `loyalty.ts` | load ≤200k rows, `.length` | `count()` |
| `enrolledPremiumCount` | `premium-tier.ts` | load ≤50k rows, filter, `.length` | `count($nin ended)` |
| optimizer engagement | `optimizer.ts` | load ≤20k users, `.length` | `count()` |
| `activeFoundingAdOwners` | `founding-advertiser.ts` | **load ≤5k**, then serve | keyset `scan`, **no cap** |
| `activeEarnedAdOwners` | `earned-advertiser.ts` | **load ≤20k**, then serve | keyset `scan`, **no cap** |
| `activeMakeGoodOwners` | `delivery-guarantee.ts` | **load ≤5k**, then serve | keyset `scan`, **no cap** |
| paying-advertiser check | `surveyInterstitialGate` | load **all** paying advertisers per serve | bounded `id $in` over candidate slots |

Founding signups now also stamp a normalized lowercase `category_key`, so category-exclusivity checks are an
exact, index-accelerated, case-insensitive lookup instead of a scan of every founder.

**Advertiser-serving caps removed (this is why "200k advertisers" actually serve).** The between-survey ad
gate previously built its eligible-advertiser sets from the most-recent 5,000–20,000 rows — so past those
counts, an advertiser with allotment remaining would silently never have their ad shown. All three owner-set
builders now keyset-page through **every** active advertiser (bounded memory per page, unbounded total), and
the paying-advertiser check now looks up only the candidate ad slots' owners via one bounded query instead of
loading the entire paying-advertiser population on every survey serve. Verified against the seeded 200k table:
the keyset sweep covers all 192,000 active advertisers via an index scan on the primary key, no loss or
duplication.

**Indexes** (`backend/db/schema.sql` + `tools/gen-schema.mjs`): added an expression btree on `(data->>'at')`
for the six append-heavy event/ledger tables that are read time-ordered — `InteractionEvent`,
`LiveMetricEvent`, `LoyaltyLedger`, `SessionCaptureFrame`, `UXHeatmapSnapshot`, `UserVariantState`.

## Measured before/after (200k + 200k, PostgreSQL 16)

| Hot path | Old (load-all) | New | Speed-up | Memory pulled into app |
|---|---|---|---|---|
| Founding seats taken | **771 ms** | **49 ms** | ~15.7× | 49 MB → one integer |
| Premium user count | **524 ms** | **42 ms** | ~12.5× | 26 MB → one integer |
| Committed-volume total | **573 ms** | **109 ms** | ~5.3× | 49 MB → one number |
| Time-sorted event read (300k) | **144 ms** (seq-scan + sort) | **2.2 ms** (index scan) | ~65× | — |

Correctness was verified alongside: the new `COUNT`/`$nin` queries return **exactly** the same totals the old
load-all-then-filter logic produced (192,000 live founders; 180,000 enrolled members). The production gap is
**larger** than shown, because the old path also paid to deserialize every row into JS objects (and the GC
churn that follows) — a cost this Postgres-only benchmark doesn't include, and one that grows with row count.

Reproduce it yourself against a throwaway database:

```
createdb ggscale
psql -d ggscale -f backend/db/schema.sql
psql -d ggscale -f backend/db/scale-bench.sql
dropdb ggscale
```

## The index audit (why we didn't add more)

Adding indexes blindly taxes every write. We measured each candidate on the seeded 200k tables and kept only
what earned its place:

- **Selective per-request lookups** (a user's membership, a category's holder): already an `~1 ms` GIN bitmap
  index scan. No change needed.
- **Whole-table count** (`totalUserCount`): already an index-only scan on `created_date`, ~22 ms. No change.
- **Wide filtered counts** (enrolled members, live founders): a parallel sequential scan, ~45 ms, and they're
  cached 5–10 minutes. A partial btree only helps the text-equality query form, which our containment-based
  `count` doesn't emit — so it would sit unused while slowing writes. **Deliberately skipped.**
- **Unfiltered time-sorted reads** on append-heavy tables: the one real gap — a growing seq-scan + sort. Fixed
  with the six `(data->>'at')` indexes above (144 ms → 2.2 ms, and flat as the table grows).

## Turning 200k into millions — the infrastructure dials

The code no longer caps you below your hardware. These are the dials you turn as you grow; none require code
changes beyond configuration:

1. **Database size.** This is the real "how many users" lever — a Postgres plan with more CPU, RAM, and
   `shared_buffers`. Keep the working set in memory. This is a paid tier choice, not code.
2. **Connection pool** (`PG_POOL_SIZE`, default **10**). Raise it to match your backend concurrency, but keep
   the total (all app instances × pool size) comfortably under the database's `max_connections` — or front it
   with PgBouncer in transaction mode, which is the standard way to let many app workers share a small set of
   real Postgres connections.
3. **Read replica** (`DATABASE_REPLICA_URL`). The code already routes reads through `withReadClient`, dormant
   until you set this env var. When read volume outgrows one instance, point it at a replica and the read-heavy
   list/count/scan paths shift over automatically — no call-site changes. Writes stay on the primary; a replica
   hiccup falls back to the primary so reads never hard-fail.
4. **`random_page_cost`.** On SSD/cached storage, set it to **~1.1** (default is 4.0, which assumes spinning
   disk). This makes the planner correctly prefer the index scans we added over sequential scans as tables
   grow. Verified: the time-sorted index is chosen at both settings on hot data, but 1.1 is the right default
   for your storage and keeps the planner honest at scale.
5. **Caching.** The count paths are already cached (founding seats 5 min, premium/user counts 10 min), so even
   the wide counts run rarely. Keep that; it's what makes a once-per-window seq-scan a non-event.

With the code fix plus a right-sized database and the replica flip available, **200k → low millions of users is
reachable without re-architecting.** You don't hit a wall that needs sharding or exotic engineering until far
beyond where you are now.

## Remaining watch-list (not blocking; revisit as you grow)

Every per-request path that counts users/advertisers, and every ad-serving path that enumerates advertisers,
is now unbounded. What remains has a fixed row cap **by design**, and none of it caps how many users or
advertisers you can have — each is bounded either per-user or to a nightly job:

- `optimizer.ts` nightly rollups (Orders, DailyEarnings, etc., capped 2k–5k) — bounded; if any single stream
  routinely exceeds its cap, switch it to `db.scan()` so it can't silently truncate.
- Per-user history loads (`tax.ts`, `loyalty.ts`, `earned-advertiser.ts`, capped 4k–100k **per user**) —
  bounded by one user's own records; convert to `db.scan()` only if a single user can exceed ~10k rows.
- `telemetry.ts` unfiltered event reads — now backed by the `(data->>'at')` index; fine.

The one structural item to keep in mind: this is a JSONB document-store schema (great for flexibility and for
the equality/containment lookups that dominate here). If you ever need heavy analytical aggregation across tens
of millions of rows, that's the point to consider promoting a few hot fields to real typed columns or feeding
an analytics store — well past the 200k–low-millions range this work targets.
