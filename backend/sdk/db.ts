// Postgres layer + Base44-compatible query translation.
// The code calls entities.X.filter({field: value}, sort?, limit?). Base44 returns
// documents with properties at the top level, so we store all properties in a JSONB
// "data" column and flatten on read. Equality filters compile to JSONB containment
// (@>) which the GIN index accelerates; operators ($gte/$lte/$gt/$lt/$ne/$in) compile
// to expressions on data->>'field'.
import { Pool, type PoolClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const POOL_SIZE = Number(Deno.env.get("PG_POOL_SIZE") ?? "10");
const pool = new Pool(Deno.env.get("DATABASE_URL")!, POOL_SIZE, true);

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { return await fn(c); } finally { c.release(); }
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
          else clauses.push(`data->>'${key}' IN (${ph.join(",")})`);
        } else if (OPS[op]) {
          if (sys.has(key)) { clauses.push(`${quoteCol(key)} ${OPS[op]} $${i}`); params.push(opVal); i++; }
          else { clauses.push(`(data->>'${key}') ${OPS[op]} $${i}`); params.push(String(opVal)); i++; }
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

const quoteCol = (c: string) => `"${c}"`;
const quoteTbl = (t: string) => `"${t}"`;

function orderBy(sort?: string): string {
  if (!sort) return "ORDER BY created_date DESC";
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  const sys = new Set(["id", "created_date", "updated_date", "created_by"]);
  const col = sys.has(field) ? quoteCol(field) : `data->>'${field}'`;
  return `ORDER BY ${col} ${desc ? "DESC" : "ASC"}`;
}

export const db = {
  async filter(entity: string, query: Record<string, unknown> = {}, sort?: string, limit?: number) {
    const { where, params, next } = buildWhere(entity, query);
    let sql = `SELECT * FROM ${quoteTbl(entity)} ${where} ${orderBy(sort)}`;
    const p = [...params];
    if (limit) { sql += ` LIMIT $${next}`; p.push(limit); }
    return await withClient(async (c) => {
      const r = await c.queryObject<Record<string, unknown>>(sql, p);
      return r.rows.map((row) => rowToDoc(entity, row));
    });
  },
  async list(entity: string, sort?: string, limit?: number) {
    return await this.filter(entity, {}, sort, limit);
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
  async bulkCreate(entity: string, docs: Record<string, unknown>[], createdBy?: string) {
    const out = [];
    for (const d of docs) out.push(await this.create(entity, d, createdBy));
    return out;
  },
};
