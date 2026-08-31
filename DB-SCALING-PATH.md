# Database scaling path — from launch to very large

The database is the one part of the platform that can't scale simply by "running the same code on more machines,"
because it holds the **single source of truth** for state shared between users (balances, inventory, ad budgets,
referral credits, orders). This is the honest, staged path — each step is a real, well-trodden move backed by
real vendors, and the code is already written so the early steps are config flips rather than rewrites.

## The steps, in order

1. **One good managed Postgres (launch).** A single managed instance (Railway, Neon, Supabase, RDS) serves the
   launch and well beyond. The app already avoids the usual killers: reads are keyset-paginated, counts/sums run
   in SQL instead of loading rows into memory, and connection pooling is on.

2. **Read replica (first scale step — already wired).** Most traffic is reads. The data layer already splits
   reads from writes and routes reads to a replica **the moment `DATABASE_REPLICA_URL` is set** — no code
   changes. Add one or more read replicas and the read ceiling rises a lot. (`DB_USE_REPLICA` / the scale
   governor can gate this automatically under load.)

3. **A cache in front (Redis).** Put a cache ahead of the hottest reads (catalog, config, leaderboards) so they
   never touch Postgres at all. `CACHE_ENABLED` is the lever; a managed Redis (Upstash, ElastiCache) is the
   backing service.

4. **Offload append-heavy data.** Event/log tables (interaction events, analytics) grow fastest and don't need
   to live in the transactional DB. Route them to partitioned tables, a time-series store, or object storage so
   the core stays lean.

5. **Sharding (the real "very large" move).** When writes outgrow a single primary, split the shared data across
   many primaries by a shard key (user, tenant, or region) that still coordinate. This is a managed product from
   real companies — **Citus (distributed Postgres), AWS Aurora, CockroachDB, Vitess, Google Spanner,
   PlanetScale.** Because every query already funnels through one data layer, adopting one of these is an
   adoption project, not a ground-up rewrite.

At the far end (hundreds of millions of users) it's steps 2–5 running together, plus a CDN and object storage for
static/media. That's an infrastructure-and-spend journey, not a switch — the code won't be what stops you.

## What we do NOT do, and why (device-hosted / downloaded / peer-to-peer DB)

A recurring idea is to spread the database onto users' devices — host it in phone storage, share it peer-to-peer,
or download it. For the **authoritative** database this can't work, for three reasons that don't go away:

- **Trust.** Devices are controlled by their users. A node that holds its own balance can lie about it. The
  server DB exists precisely so users can't edit their own money.
- **Availability & durability.** Phones go offline constantly, and get lost, reset, or reinstalled. Data that
  lives only on devices is data you lose. A platform can't drop a user's balance because they got a new phone.
- **Privacy & law.** A shared DB contains every user's data. You can't place other people's financial data and
  PII on strangers' devices — that's a breach and a regulatory violation on its own.

Coordinating money-writes across millions of untrusted, intermittently-connected nodes is the hardest problem in
distributed systems; the only mechanism that even attempts it is a blockchain, which we've ruled out because it
detonates the non-crypto compliance posture.

## What we DO put on the device (the safe slice — built)

Devices genuinely help with **reads**. The on-device store (`src/lib/local-db.js`, IndexedDB) holds only what's
safe on user hardware:

- the user's **own** data (their dashboard, their history), and
- **public, read-only** reference data — the product catalog, categories, public listings.

`offlineFirstRead()` serves these instantly from the device and revalidates from the server in the background;
`prefetch()` downloads the public catalog slice for full offline browsing. This uses the phone's storage exactly
the way the idea intends — to make the app feel instant and to shed read load off the server — **without** asking
the device to hold anyone else's truth or any live balance. Money/identity reads are on a denylist
(`SENSITIVE_READ`) and always come live from the server; sensitive writes are already blocked on-device in every
mode. Net effect: the device is a fast local read copy that syncs from the server, never the source of truth.
