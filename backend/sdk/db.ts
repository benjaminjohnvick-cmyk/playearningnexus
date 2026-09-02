// Postgres layer + Base44-compatible query translation.
// The code calls entities.X.filter({field: value}, sort?, limit?). Base44 returns
// documents with properties at the top level, so we store all properties in a JSONB
// "data" column and flatten on read. Equality filters compile to JSONB containment
// (@>) which the GIN index accelerates; operators ($gte/$lte/$gt/$lt/$ne/$in) compile
// to expressions on data->>'field'.
import { Pool, type PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const POOL_SIZE = Number(Deno.env.get("PG_POOL_SIZE") ?? "10");

// --- TLS mode normalization ---------------------------------------------------------------------
// deno-postgres defaults to sslmode=prefer: it TRIES TLS and, if the handshake fails, prints a
// warning and silently falls back to a plaintext connection. On Railway that fallback fires on every
// boot, because:
//   1. Railway's private network (*.railway.internal) is ALREADY encrypted in transit by WireGuard
//      (ChaCha20/Curve25519) — Railway itself recommends plain connections internally because app-layer
//      TLS is redundant there, and the traffic never leaves Railway's network.
//   2. Railway's bundled Postgres presents a SELF-SIGNED cert that Deno's TLS verifier rejects
//      ("invalid peer certificate: CaUsedAsEndEntity"). Supplying that cert as a CA does NOT help —
//      the verifier still rejects a CA cert used as an end-entity — so verified app-TLS is unachievable
//      against Railway's internal Postgres.
// The noise is therefore an accidental default, not a real security gap. We make the posture explicit:
// for a Railway-internal host with no sslmode already set, force sslmode=disable so there's no failed
// TLS attempt and the boot log stays clean (encryption in transit is still provided by WireGuard). Any
// URL that already carries an sslmode is left untouched (e.g. a managed Postgres with a real CA can keep
// verify-full), and PG_SSLMODE overrides the default for any host.
function normalizeDbUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const forced = Deno.env.get("PG_SSLMODE");
    if (forced) { u.searchParams.set("sslmode", forced); return u.toString(); }
    if (u.searchParams.has("sslmode")) return raw; // caller / managed DB already chose a mode
    const host = u.hostname.toLowerCase();
    if (host.endsWith(".railway.internal") || host.endsWith(".internal")) {
      // Private, WireGuard-encrypted network + self-signed PG cert → intentional plaintext.
      u.searchParams.set("sslmode", "disable");
      return u.toString();
    }
    return raw; // external/managed host → keep the driver/URL default (prefer/verify)
  } catch {
    return raw; // not a parseable URL — leave exactly as provided
  }
}

const _DB_URL = Deno.env.get("DATABASE_URL");
const pool = new Pool(_DB_URL ? normalizeDbUrl(_DB_URL) : _DB_URL!, POOL_SIZE, true);

// DORMANT scale scaffolding, behind a flag. Reads route to a read replica ONLY when
// DATABASE_REPLICA_URL is set; otherwise every read uses the primary (identical to before).
// This is the flip you make when read volume outgrows one instance — no call-site changes.
// Writes always go to the primary. Replica lag is eventual, so writes-then-immediate-read
// still uses the primary via withClient; withReadClient is for the read-heavy list/filter paths.
const REPLICA_URL = Deno.env.get("DATABASE_REPLICA_URL");
const REPLICA_POOL_SIZE = Number(Deno.env.get("PG_REPLICA_POOL_SIZE") ?? String(POOL_SIZE));
const replicaPool = REPLICA_URL ? new Pool(normalizeDbUrl(REPLICA_URL), REPLICA_POOL_SIZE, true) : null;

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { return await fn(c); } finally { c.release(); }
}

/** Run a READ against the replica pool when configured, else the primary. Best-effort:
 *  a replica connection failure falls back to the primary so reads never hard-fail. */
export async function withReadClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (!replicaPool) return await withClient(fn);
  try {
    const c = await replicaPool.connect();
    try { return await fn(c); } finally { c.release(); }
  } catch (_e) {
    return await withClient(fn); // replica unreachable → serve from primary
  }
}

const SYSTEM_COLS: Record<string, Set<string>> = {
  _default: new Set(["id", "created_date", "updated_date", "created_by"]),
  User: new Set(["id", "created_date", "updated_date", "created_by", "email", "password_hash", "role"]),
};
const sysCols = (entity: string) => SYSTEM_COLS[entity] ?? SYSTEM_COLS._default;

// Flatten a DB row into the flat document shape the app code expects.
function rowToDoc(entity: string, row: Record<string, unknown>): Record<string, unknown> {
  const { data, ...cols } = row as { data: Record<string, unknown> };
  return { ...(data ?? {}), ...cols };
}

// Split an incoming flat document into system columns + JSONB data.
function docToColumns(entity: string, doc: Record<string, unknown>) {
  const cols: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};
  const sys = sysCols(entity);
  for (const [k, v] of Object.entries(doc)) {
    if (sys.has(k)) cols[k] = v; else data[k] = v;
  }
  return { cols, data };
}

const OPS: Record<string, string> = { $gte: ">=", $lte: "<=", $gt: ">", $lt: "<", $ne: "<>" };

// Build a WHERE clause + params from a Base44 filter object.
function buildWhere(entity: string, query: Record<string, unknown>, startIdx = 1) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = startIdx;
  const sys = sysCols(entity);
  const containment: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(query ?? {})) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      // operator object, e.g. { $gte: '2026-01-01' }
      for (const [op, opVal] of Object.entries(val as Record<string, unknown>)) {
        if (op === "$in") {
          const arr = opVal as unknown[];
          const ph = arr.map(() => `$${i++}`);
          arr.forEach((a) => params.push(a));
          if (sys.has(key)) clauses.push(`${quoteCol(key)} IN (${ph.join(",")})`);
          else clauses.push(`data->>${jsonKey(key)} IN (${ph.join(",")})`);
        } else if (op === "$nin") {
          const arr = opVal as unknown[];
          const ph = arr.map(() => `$${i++}`);
          arr.forEach((a) => params.push(a));
          const col = sys.has(key) ? quoteCol(key) : `data->>${jsonKey(key)}`;
          // NULL-inclusive NOT IN: a missing/null field counts as "not equal to" every listed value,
          // matching the app's JS `x !== a && x !== b` intent (where an absent field passes the test).
          clauses.push(`(${col} IS NULL OR ${col} NOT IN (${ph.join(",")}))`);
        } else if (OPS[op]) {
          if (sys.has(key)) { clauses.push(`${quoteCol(key)} ${OPS[op]} $${i}`); params.push(opVal); i++; }
          else { clauses.push(`(data->>${jsonKey(key)}) ${OPS[op]} $${i}`); params.push(String(opVal)); i++; }
        }
      }
    } else if (sys.has(key)) {
      clauses.push(`${quoteCol(key)} = $${i}`); params.push(val); i++;
    } else {
      containment[key] = val; // batch equality into one @> for GIN speed
    }
  }
  if (Object.keys(containment).length) {
    clauses.push(`data @> $${i}::jsonb`); params.push(JSON.stringify(containment)); i++;
  }
  return { where: clauses.length ? "WHERE " + clauses.join(" AND ") : "", params, next: i };
}

// Identifiers are wrapped in double quotes; escape any embedded double quote so a crafted
// name can't break out of the identifier. (Table/entity names are already regex-limited at
// the route, but this hardens column names and any future callers.)
const quoteCol = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
const quoteTbl = (t: string) => `"${String(t).replace(/"/g, '""')}"`;
// Safely embed a JSONB key/field as a single-quoted SQL literal. Filter keys and the sort
// field arrive from the request body with no allowlist, so escaping the single quote here
// closes SQL injection through `data->>'<key>'`.
const jsonKey = (k: string) => `'${String(k).replace(/'/g, "''")}'`;

function orderBy(sort?: string): string {
  if (!sort) return "ORDER BY created_date DESC";
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  const sys = new Set(["id", "created_date", "updated_date", "created_by"]);
  const col = sys.has(field) ? quoteCol(field) : `data->>${jsonKey(field)}`;
  return `ORDER BY ${col} ${desc ? "DESC" : "ASC"}`;
}

export const db = {
  async filter(entity: string, query: Record<string, unknown> = {}, sort?: string, limit?: number) {
    const { where, params, next } = buildWhere(entity, query);
    let sql = `SELECT * FROM ${quoteTbl(entity)} ${where} ${orderBy(sort)}`;
    const p = [...params];
    if (limit) { sql += ` LIMIT $${next}`; p.push(limit); }
    return await withReadClient(async (c) => {
      const r = await c.queryObject<Record<string, unknown>>(sql, p);
      return r.rows.map((row) => rowToDoc(entity, row));
    });
  },
  async list(entity: string, sort?: string, limit?: number) {
    return await this.filter(entity, {}, sort, limit);
  },
  // Offset-paginated read — same filter/sort as filter(), plus OFFSET. Use for admin/list endpoints so a
  // caller can walk pages instead of pulling one giant array. (Deep offsets get slower; for full-table
  // sweeps prefer scan(), which is keyset-paginated and O(1) per page.)
  async filterPage(entity: string, query: Record<string, unknown> = {}, sort?: string, limit = 50, offset = 0) {
    const { where, params, next } = buildWhere(entity, query);
    let sql = `SELECT * FROM ${quoteTbl(entity)} ${where} ${orderBy(sort)} LIMIT $${next}`;
    const p = [...params, Math.max(1, limit)];
    if (offset > 0) { sql += ` OFFSET $${next + 1}`; p.push(Math.max(0, offset)); }
    return await withReadClient(async (c) => {
      const r = await c.queryObject<Record<string, unknown>>(sql, p);
      return r.rows.map((row) => rowToDoc(entity, row));
    });
  },
  // COUNT(*) with the same filter compilation — the SCALE-SAFE way to size a set. Never loads rows into
  // app memory; returns one number. Replaces the `filter(entity, q, sort, BIGNUM).length` anti-pattern that
  // pulled tens/hundreds of thousands of full JSONB rows across the wire just to call `.length`.
  async count(entity: string, query: Record<string, unknown> = {}): Promise<number> {
    const { where, params } = buildWhere(entity, query);
    const sql = `SELECT COUNT(*)::bigint AS n FROM ${quoteTbl(entity)} ${where}`;
    return await withReadClient(async (c) => {
      const r = await c.queryObject<{ n: bigint | number | string }>(sql, params);
      return Number(r.rows[0]?.n ?? 0);
    });
  },
  // SUM of a numeric field with the same filter compilation — the SCALE-SAFE way to total a column
  // (e.g. committed advertising volume) without loading every row to reduce() in app memory. A row whose
  // value isn't numeric contributes 0 (guarded cast) rather than erroring the whole query.
  async sum(entity: string, field: string, query: Record<string, unknown> = {}): Promise<number> {
    const { where, params } = buildWhere(entity, query);
    const sys = sysCols(entity);
    const raw = sys.has(field) ? quoteCol(field) : `data->>${jsonKey(field)}`;
    const expr = sys.has(field)
      ? `${raw}::numeric`
      : `CASE WHEN ${raw} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${raw})::numeric ELSE 0 END`;
    const sql = `SELECT COALESCE(SUM(${expr}), 0)::float8 AS s FROM ${quoteTbl(entity)} ${where}`;
    return await withReadClient(async (c) => {
      const r = await c.queryObject<{ s: number | string }>(sql, params);
      return Number(r.rows[0]?.s ?? 0);
    });
  },
  // Keyset (seek) pagination over EVERY matching row, in bounded-memory batches ordered by primary key.
  // Yields arrays of `batch` rows using `id > lastId` (the PK index) — constant memory and constant per-page
  // cost regardless of table size. Use this for full-table jobs (loyalty distribution, nightly optimizer)
  // instead of filter(entity, q, sort, 200000), which materializes the whole set at once.
  async *scan(entity: string, query: Record<string, unknown> = {}, batch = 1000): AsyncGenerator<Record<string, unknown>[]> {
    const size = Math.max(1, Math.min(10000, Math.floor(batch) || 1000));
    let last = "";
    for (;;) {
      const { where, params, next } = buildWhere(entity, query);
      const seek = where ? `${where} AND id > $${next}` : `WHERE id > $${next}`;
      const sql = `SELECT * FROM ${quoteTbl(entity)} ${seek} ORDER BY id ASC LIMIT ${size}`;
      const rows = await withReadClient(async (c) => {
        const r = await c.queryObject<Record<string, unknown>>(sql, [...params, last]);
        return r.rows.map((row) => rowToDoc(entity, row));
      });
      if (!rows.length) break;
      yield rows;
      last = String(rows[rows.length - 1].id);
      if (rows.length < size) break;
    }
  },
  async get(entity: string, id: string) {
    const r = await this.filter(entity, { id }, undefined, 1);
    return r[0] ?? null;
  },
  async create(entity: string, doc: Record<string, unknown>, createdBy?: string) {
    const { cols, data } = docToColumns(entity, doc);
    if (createdBy && !cols.created_by) cols.created_by = createdBy;
    const colNames = Object.keys(cols);
    const params: unknown[] = [];
    const colSql = colNames.map((c) => quoteCol(c));
    const valSql = colNames.map((c, idx) => { params.push(cols[c]); return `$${idx + 1}`; });
    colSql.push("data"); params.push(JSON.stringify(data)); valSql.push(`$${params.length}::jsonb`);
    const sql = `INSERT INTO ${quoteTbl(entity)} (${colSql.join(",")}) VALUES (${valSql.join(",")}) RETURNING *`;
    return await withClient(async (c) => {
      const r = await c.queryObject<Record<string, unknown>>(sql, params);
      return rowToDoc(entity, r.rows[0]);
    });
  },
  async update(entity: string, id: string, patch: Record<string, unknown>) {
    const { cols, data } = docToColumns(entity, patch);
    const sets: string[] = []; const params: unknown[] = []; let i = 1;
    for (const [k, v] of Object.entries(cols)) { sets.push(`${quoteCol(k)} = $${i++}`); params.push(v); }
    if (Object.keys(data).length) { sets.push(`data = data || $${i++}::jsonb`); params.push(JSON.stringify(data)); }
    sets.push(`updated_date = now()`);
    params.push(id);
    const sql = `UPDATE ${quoteTbl(entity)} SET ${sets.join(",")} WHERE id = $${i} RETURNING *`;
    return await withClient(async (c) => {
      const r = await c.queryObject<Record<string, unknown>>(sql, params);
      return r.rows[0] ? rowToDoc(entity, r.rows[0]) : null;
    });
  },
  async remove(entity: string, id: string) {
    return await withClient(async (c) => {
      await c.queryObject(`DELETE FROM ${quoteTbl(entity)} WHERE id = $1`, [id]);
      return { id, deleted: true };
    });
  },
  // Atomic conditional update: only applies (and returns the row) if data->>field still equals
  // `equals`. Returns null if the row is gone or the condition no longer holds — used to claim a
  // resource (e.g. flip a listing active→sold) without a race.
  async updateIf(entity: string, id: string, patch: Record<string, unknown>, cond: { field: string; equals: string }) {
    const { cols, data } = docToColumns(entity, patch);
    const sets: string[] = []; const params: unknown[] = []; let i = 1;
    for (const [k, v] of Object.entries(cols)) { sets.push(`${quoteCol(k)} = $${i++}`); params.push(v); }
    if (Object.keys(data).length) { sets.push(`data = data || $${i++}::jsonb`); params.push(JSON.stringify(data)); }
    sets.push(`updated_date = now()`);
    const field = String(cond.field).replace(/[^a-zA-Z0-9_]/g, "");
    params.push(id); const idP = i++;
    params.push(cond.equals); const valP = i++;
    const sql = `UPDATE ${quoteTbl(entity)} SET ${sets.join(",")} WHERE id = $${idP} AND data->>'${field}' = $${valP} RETURNING *`;
    return await withClient(async (c) => {
      const r = await c.queryObject<Record<string, unknown>>(sql, params);
      return r.rows[0] ? rowToDoc(entity, r.rows[0]) : null;
    });
  },
  // Atomic JSONB array append (no read-modify-write race). Appends `value` to data->field.
  async appendToArray(entity: string, id: string, field: string, value: unknown) {
    const f = String(field).replace(/[^a-zA-Z0-9_]/g, "");
    const sql = `UPDATE ${quoteTbl(entity)} SET data = jsonb_set(data, '{${f}}', COALESCE(data->'${f}', '[]'::jsonb) || $2::jsonb), updated_date = now() WHERE id = $1 RETURNING *`;
    return await withClient(async (c) => {
      const r = await c.queryObject<Record<string, unknown>>(sql, [id, JSON.stringify(value)]);
      return r.rows[0] ? rowToDoc(entity, r.rows[0]) : null;
    });
  },
  // Atomic numeric increment on a JSONB field (no read-modify-write race, no CAS retry). COALESCE treats an
  // ABSENT field as 0, so the first write works even when the key doesn't exist yet. `delta` may be negative.
  async incrementField(entity: string, id: string, field: string, delta: number): Promise<number | null> {
    const f = String(field).replace(/[^a-zA-Z0-9_]/g, "");
    const d = Number(delta) || 0;
    const sql = `UPDATE ${quoteTbl(entity)} SET data = jsonb_set(data, '{${f}}', to_jsonb(COALESCE((data->>'${f}')::numeric, 0) + $2::numeric), true), updated_date = now() WHERE id = $1 RETURNING *`;
    return await withClient(async (c) => {
      const r = await c.queryObject<Record<string, unknown>>(sql, [id, d]);
      const row = r.rows[0] ? rowToDoc(entity, r.rows[0]) : null;
      return row ? (Number((row as Record<string, unknown>)[f]) || 0) : null;
    });
  },
  async bulkCreate(entity: string, docs: Record<string, unknown>[], createdBy?: string) {
    const out = [];
    for (const d of docs) out.push(await this.create(entity, d, createdBy));
    return out;
  },
};
