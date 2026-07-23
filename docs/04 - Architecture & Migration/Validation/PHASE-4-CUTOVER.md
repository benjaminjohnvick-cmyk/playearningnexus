# Phase 4 — Data migration & cutover kit

Move your live data from Base44 into Postgres and switch the app over with a safety net. Do this only after Phase 2 passes (backend runs, smoke test green) and Phase 3 features are configured.

## Tools in this kit
- `tools/export-from-base44.mjs` — pulls every entity's rows from Base44 → `export/<Entity>.jsonl` + `_counts.json`.
- `tools/import-to-postgres.mjs` — loads those into Postgres (id/created_date/created_by/User columns preserved; everything else → JSONB `data`). Idempotent (`ON CONFLICT (id) DO NOTHING`).
- `tools/shadow-compare.mjs` — verifies per-entity counts + sample ids match after import.
- `db/entities.json` — the 235-entity list the scripts iterate.

> Validated: the import mapping and schema were run against a real PostgreSQL 16 instance — 235 tables + 706 indexes create cleanly, and Base44-style documents import with nested fields, promoted User columns, and preserved `created_date`. The **export** step needs your Base44 token, so it runs in your environment.

## Step 1 — Export from Base44
```bash
cd nexus-backend
npm i @base44/sdk            # only needed for the export script
BASE44_APP_ID=... BASE44_TOKEN=... BASE44_BASE_URL=https://your-app.base44.app \
  node tools/export-from-base44.mjs ./export
```
Review `export/_counts.json` — sanity-check the row counts look right.

> If your SDK version paginates differently, adjust the `client.list(...)` call in the export script (it falls back to a plain `list()`).

## Step 2 — Import into Postgres
Against your RDS (or local) database:
```bash
# Option A — direct (needs `pg`):
npm i pg
DATABASE_URL=postgres://user:pass@host:5432/nexus node tools/import-to-postgres.mjs ./export

# Option B — emit SQL and load with psql (no pg needed):
node tools/import-to-postgres.mjs ./export --emit-sql > import.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f import.sql
```
Re-runnable: `ON CONFLICT DO NOTHING` means re-imports skip existing ids.

## Step 3 — Verify parity (shadow compare)
```bash
DATABASE_URL=... node tools/shadow-compare.mjs ./export --sample 5
```
Green = per-entity counts match and sampled ids are present. Investigate any `✗` before proceeding.

## Step 4 — Shadow run (both live, no user impact)
1. Deploy the Nexus backend (Phase 1–3) pointed at the freshly-imported Postgres.
2. Point a **staging** copy of the frontend at it (`VITE_NEXUS_API_URL`), Base44 still serving production.
3. Click through core flows on staging: sign-in, surveys, referrals, payouts (test mode), the prize pool, a couple of agents, a scheduled function fired manually.
4. Spot-compare a few records/read paths between Base44 and Nexus for the same user.

## Step 5 — Cutover
1. Pick a low-traffic window. Optionally put the app in brief read-only/maintenance mode.
2. **Final incremental export/import** to capture rows created since Step 1 (re-run Steps 1–3; idempotent import only adds new ids). For records that changed (not just new), export those entities fresh and load with an upsert variant if needed.
3. Flip production frontend `VITE_NEXUS_API_URL` to the Nexus backend and deploy.
4. Turn **off** any Base44 schedules; turn **on** the Nexus scheduler (Phase 3).
5. Monitor errors/latency closely for the first hours.

## Step 6 — Rollback plan (keep ready through Step 5)
- Keep Base44 running and untouched during shadow + cutover.
- Rollback = repoint the frontend `VITE_NEXUS_API_URL` back to the Base44 client build and redeploy. Because you didn't write to Base44 during cutover, its data is still the pre-cutover truth.
- Only **decommission Base44** after a stable soak (suggest 1–2 weeks) with backups of both the final export and the Postgres database.

## Gotchas to watch
- **Updated (not just new) rows** between export and cutover: the plain importer only inserts new ids. For a clean final sync, re-export the changed entities and load with an upsert (change `ON CONFLICT (id) DO NOTHING` → `DO UPDATE SET data = EXCLUDED.data, updated_date = now()`), or keep the maintenance window short so drift is minimal.
- **User passwords:** Base44 hosted auth — exported users won't have `password_hash`. Plan a password-reset flow or an SSO/Cognito bridge, or issue reset emails on first login. (New signups via `/auth/signup` set their own.)
- **File URLs:** any files stored in Base44 need copying to S3 and URL rewriting (Phase 3 UploadFile handles *new* uploads; migrate old assets separately if needed).
- **created_by references:** preserved as-is; make sure the referenced user ids also import.
