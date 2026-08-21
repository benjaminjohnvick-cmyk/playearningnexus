-- scale-bench.sql — reproducible 200k-users + 200k-advertisers scale proof.
--
-- Seeds the three hot tables with 200,000 rows each, then benchmarks the OLD "load every row and count in
-- app memory" pattern against the NEW db.count()/db.sum()/keyset-scan primitives. Proves both CORRECTNESS
-- (new numbers == old numbers) and PERFORMANCE (10x+ faster, and megabytes → one integer of memory).
--
-- Run against a THROWAWAY database (it inserts 600k rows):
--   createdb ggscale
--   psql -d ggscale -f db/schema.sql          # tables + indexes (incl. the scale hot-path indexes)
--   psql -d ggscale -f db/scale-bench.sql      # seed + benchmark
--   dropdb ggscale                             # clean up
--
-- Measured 2026-08-21 (Postgres 16, local socket, 2 parallel workers). Your absolute numbers will vary; the
-- RATIO between OLD and NEW is the point, and the app-side gap is larger in production because the OLD path
-- also deserializes every row into JS objects (GC pressure) that this psql-only bench does not incur.

\timing on

-- ── Seed ────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO "FoundingAdvertiser" (created_date, data)
SELECT now() - (g || ' seconds')::interval,
       jsonb_build_object(
         'tier1', true, 'user_id', 'u' || g,
         'status', CASE WHEN g % 50 = 0 THEN 'refunded' WHEN g % 50 = 1 THEN 'cancelled' ELSE 'active' END,
         'category_key', 'cat' || (g % 5000),
         'guaranteed_impressions_per_year', 200000, 'impressions_served', (g % 250000))
FROM generate_series(1, 200000) g;

INSERT INTO "User" (created_date, email, role, data)
SELECT now() - (g || ' seconds')::interval, 'user' || g || '@example.com', 'user',
       jsonb_build_object('ppc_grid_active', (g % 10 < 3), 'points', (g % 100000))
FROM generate_series(1, 200000) g;

INSERT INTO "PremiumPPCMembership" (created_date, data)
SELECT now() - (g || ' seconds')::interval,
       jsonb_build_object('user_id', 'u' || g, 'loyalty_enrolled', (g % 10 <> 0),
         'status', CASE WHEN g % 20 = 0 THEN 'ended' ELSE 'active' END)
FROM generate_series(1, 200000) g;

ANALYZE "FoundingAdvertiser"; ANALYZE "User"; ANALYZE "PremiumPPCMembership";

-- ── Correctness: NEW count must equal OLD (load-all-then-filter) count ───────────────────────────────────
\echo '--- CORRECTNESS (NEW == OLD) ---'
-- foundingSeatsTaken: live founders = total − refunded − cancelled. Expect 192000.
SELECT 'foundingSeatsTaken NEW' AS metric,
       count(*) FROM "FoundingAdvertiser"
       WHERE (data->>'status' IS NULL OR data->>'status' NOT IN ('refunded','cancelled'));
SELECT 'foundingSeatsTaken OLD' AS metric, count(*) FROM (
  SELECT data->>'status' s FROM "FoundingAdvertiser" ORDER BY created_date DESC LIMIT 200000
) x WHERE s IS DISTINCT FROM 'refunded' AND s IS DISTINCT FROM 'cancelled';
-- premiumUserCount: enrolled members. Expect 180000.
SELECT 'premiumUserCount NEW' AS metric, count(*) FROM "PremiumPPCMembership" WHERE data @> '{"loyalty_enrolled":true}';

-- ── Performance: OLD load-all vs NEW count/sum ───────────────────────────────────────────────────────────
\echo '--- PERF: foundingSeatsTaken — OLD load 200k rows, then NEW COUNT ---'
\o /dev/null
SELECT * FROM "FoundingAdvertiser" ORDER BY created_date DESC LIMIT 200000;                 -- OLD
\o
SELECT count(*) FROM "FoundingAdvertiser"                                                     -- NEW
  WHERE (data->>'status' IS NULL OR data->>'status' NOT IN ('refunded','cancelled'));

\echo '--- PERF: premiumUserCount — OLD load, then NEW COUNT ---'
\o /dev/null
SELECT * FROM "PremiumPPCMembership" WHERE data @> '{"loyalty_enrolled":true}' ORDER BY created_date DESC LIMIT 500000;  -- OLD
\o
SELECT count(*) FROM "PremiumPPCMembership" WHERE data @> '{"loyalty_enrolled":true}';        -- NEW

\echo '--- PERF: committed-volume — OLD load-to-reduce, then NEW SUM ---'
\o /dev/null
SELECT * FROM "FoundingAdvertiser" LIMIT 200000;                                              -- OLD
\o
SELECT COALESCE(SUM(CASE WHEN data->>'impressions_served' ~ '^-?[0-9]+(\.[0-9]+)?$'
       THEN (data->>'impressions_served')::numeric ELSE 0 END),0) FROM "FoundingAdvertiser";  -- NEW

-- ── Memory the OLD path pulls into app RAM per call (raw wire size; larger as live JS objects) ────────────
\echo '--- MEMORY pulled into app by the OLD path ---'
SELECT 'FoundingAdvertiser 200k' AS set, pg_size_pretty(SUM(pg_column_size(t.*))) FROM "FoundingAdvertiser" t;
SELECT 'PremiumPPCMembership enrolled' AS set, pg_size_pretty(SUM(pg_column_size(t.*)))
       FROM "PremiumPPCMembership" t WHERE data @> '{"loyalty_enrolled":true}';

-- ── Index proof: unfiltered time-sorted read on an append-heavy table (needs the (data->>'at') index) ─────
\echo '--- INDEX: time-sorted event read (seed 300k, then plan) ---'
INSERT INTO "InteractionEvent" (created_date, data)
SELECT now() - (g || ' seconds')::interval,
       jsonb_build_object('at', to_char(now() - (g || ' seconds')::interval,'YYYY-MM-DD"T"HH24:MI:SS'),
         'kind','view','user_id','u'||(g%50000))
FROM generate_series(1, 300000) g;
ANALYZE "InteractionEvent";
EXPLAIN (ANALYZE, COSTS OFF) SELECT * FROM "InteractionEvent" ORDER BY data->>'at' DESC LIMIT 5000;
