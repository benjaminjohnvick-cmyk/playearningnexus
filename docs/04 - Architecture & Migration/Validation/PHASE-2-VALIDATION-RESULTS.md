# Phase 2 — Validation results (run against real PostgreSQL 16)

These checks were executed against a live PostgreSQL 16 server (not mocks) to prove the foundation's database layer. What could **not** run in this environment: the Deno HTTP server and agent runtime (Deno isn't installed here and `deno.land` is network-blocked), so the full end-to-end HTTP smoke test still needs to run on your machine per `PHASE-2-RUNBOOK.md`. But the riskiest parts — the generated schema and the SDK's query translation — are now proven.

## Schema & seed
| Check | Result |
|---|---|
| `db/schema.sql` loads | ✅ exit 0, **0 errors** |
| Tables created | ✅ **235** |
| Indexes created | ✅ **706** (GIN + created_date per table) |
| `db/seed.sql` loads | ✅ admin + user + settings + sample A/B test |

## SDK query translation (the exact SQL `sdk/db.ts` emits)
| Operation | SQL pattern | Result |
|---|---|---|
| `.filter({status:'active'})` | `WHERE data @> '{"status":"active"}'::jsonb` | ✅ returns seeded row |
| GIN index used | `EXPLAIN` | ✅ **Bitmap Index Scan on `_data_gin`** (fast path confirmed) |
| `.create({...})` | `INSERT (...) RETURNING *` | ✅ id returned |
| `.get(id)` roundtrip | flatten `{id, created_by, ...data}` | ✅ `value=42, action=smoke2` read back |
| `.update(id, patch)` | `SET data = data \|\| patch::jsonb` | ✅ field updated in place |
| operator `$gte` | `created_date >= $1` | ✅ works |
| RLS owner filter | `... AND created_by = $uid` | ✅ scoped result |
| auth seed | `User.role`, `password_hash` columns | ✅ present |

## Phase 4 import (validated here too)
| Check | Result |
|---|---|
| `import-to-postgres.mjs --emit-sql` → psql | ✅ loaded into live DB |
| Nested fields flatten (`meta.campaign`) | ✅ preserved |
| User columns promoted (email/role) | ✅ |
| `created_date` preserved from source | ✅ (not import time) |
| Idempotent re-import | ✅ `ON CONFLICT (id) DO NOTHING` |

## Still to run on your machine (needs Deno + the full stack)
- `docker compose up` → `/health` shows 526 functions + 76 agents
- HTTP auth (`/auth/login` JWT), a function invoke over HTTP, an agent call
- The full `tools/smoke-test.ts`
- Then the Step-5 function sweep to flush any query edge cases (`$or`, array-contains, pagination) — fix centrally in `sdk/db.ts`.

**Bottom line:** the schema and query engine work against a real database; the remaining validation is booting the Deno service and exercising the HTTP surface, which this sandbox can't do but your machine can in minutes.
