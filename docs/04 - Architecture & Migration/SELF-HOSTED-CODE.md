# PlayEarning Nexus / GamerGain — Self-Hosted Code (Base44 removed)

Complete source of the hand-authored self-hosted layer that replaced Base44:
compatibility SDK, server routes, auth (incl. reset + Google), agent runtime, scheduler,
migration tooling, and the reworked frontend client + brand-matched auth pages.
The 526 converted functions + 239-table schema are generated/mechanical — full source is in
the GitHub repo + delivered zip, not inline here.

_Refreshed 2026-07-20 • repo: github.com/benjaminjohnvick-cmyk/playearningnexus_

---
# ===== BACKEND: SDK =====

## `backend/sdk/db.ts`
```ts
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
```

## `backend/sdk/mod.ts`
```ts
// Base44-compatible SDK — drop-in replacement for `npm:@base44/sdk`.
// Your 526 functions import { createClientFromRequest } and call:
//   base44.auth.me()
//   base44.entities.X.filter/create/update/list/get/delete/bulkCreate
//   base44.asServiceRole.entities.X.*   (bypasses per-user scoping)
//   base44.integrations.Core.InvokeLLM/SendEmail/GenerateImage
//   base44.asServiceRole.integrations.Core.*
//   base44.functions.invoke(name, payload)
// This module reimplements all of that against your own Postgres + providers.
import { db } from "./db.ts";
import { Core } from "./integrations.ts";
import { verifyJwt } from "./auth.ts";

// In-process registry of function handlers, populated by the server (server/router.ts).
// Lets base44.functions.invoke('name', payload) dispatch without an HTTP round-trip.
export const functionRegistry = new Map<string, (req: Request) => Promise<Response>>();

type User = Record<string, unknown> & { id: string; role?: string; email?: string };

function makeEntities(currentUser: User | null, serviceRole: boolean) {
  return new Proxy({}, {
    get(_t, entity: string) {
      return {
        filter: (q: Record<string, unknown> = {}, sort?: string, limit?: number) => db.filter(entity, q, sort, limit),
        list: (sort?: string, limit?: number) => db.list(entity, sort, limit),
        get: (id: string) => db.get(entity, id),
        create: (doc: Record<string, unknown>) => db.create(entity, doc, currentUser?.id),
        update: (id: string, patch: Record<string, unknown>) => db.update(entity, id, patch),
        delete: (id: string) => db.remove(entity, id),
        bulkCreate: (docs: Record<string, unknown>[]) => db.bulkCreate(entity, docs, currentUser?.id),
        // `User` needs a self-lookup helper used by some code paths:
        ...(entity === "User" ? { me: async () => currentUser } : {}),
      };
    },
  });
}

function makeClient(token: string | null) {
  let cachedUser: User | null | undefined;

  const auth = {
    async me(): Promise<User> {
      if (cachedUser === undefined) {
        const payload = token ? await verifyJwt(token) : null;
        cachedUser = payload ? (await db.get("User", String(payload.sub))) as User : null;
      }
      if (!cachedUser) throw new Error("Unauthorized");
      return cachedUser;
    },
    redirectToLogin() {
      // Server-side no-op equivalent; the frontend SDK handles real redirects.
      return { redirect: Deno.env.get("LOGIN_URL") ?? "/login" };
    },
    // Update the current user (used by functions to adjust balances, preferences, etc.).
    async updateMe(patch: Record<string, unknown>) {
      const me = await this.me();
      const clean = { ...patch }; delete (clean as Record<string, unknown>).password_hash; delete (clean as Record<string, unknown>).role;
      cachedUser = await db.update("User", me.id, clean) as User;
      return cachedUser;
    },
  };

  const serviceRole = {
    entities: makeEntities(null, true),
    integrations: { Core },
    // Service-role user administration (any user by id) — used by payout/referral functions.
    auth: {
      async me() { return null; },
      updateUser: (id: string, patch: Record<string, unknown>) => db.update("User", id, patch),
      updateMe: (patch: Record<string, unknown>) => auth.updateMe(patch),
    },
    functions: {
      async invoke(name: string, payload: unknown = {}) {
        const handler = functionRegistry.get(name);
        if (!handler) throw new Error(`Function not found: ${name}`);
        const req = new Request(`http://internal/functions/${name}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        });
        const res = await handler(req);
        try { return await res.json(); } catch { return await res.text(); }
      },
    },
  };

  return {
    auth,
    entities: makeEntities(null, false), // user-scoped reads share the same tables; see RLS note in plan
    integrations: { Core },
    functions: serviceRole.functions,
    asServiceRole: serviceRole,
    _setUser(u: User | null) { cachedUser = u; },
  };
}

/** Server-side: build a client from an incoming request (reads the Bearer token). */
export function createClientFromRequest(req: Request) {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
  return makeClient(token);
}

/** Also exported for parity; used by some callers that build a client explicitly. */
export function createClient(opts: { token?: string } = {}) {
  return makeClient(opts.token ?? null);
}
```

## `backend/sdk/integrations.ts`
```ts
// Replacements for base44.integrations.Core.* — you own the keys, so you control
// (and pay for) the rate limits directly. Providers are swappable via env.
//
// NOTE ON RATE LIMITS: moving off Base44 does not remove LLM/email rate limits — it
// moves them to YOUR provider account. Set LLM_PROVIDER's tier appropriately and add
// a queue (see MIGRATION-PLAN.md, "Throughput") for high volume.

import { limited, LLM_CONCURRENCY, EMAIL_CONCURRENCY } from "./queue.ts";
import { sesSend } from "./aws/ses.ts";

type LLMArgs = {
  prompt: string;
  response_json_schema?: unknown;
  model?: string;
  add_context_from_internet?: boolean;
};

const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") ?? "openai"; // openai | anthropic
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Maps the Base44 model aliases (e.g. 'gpt_5_mini') to real model IDs.
const MODEL_MAP: Record<string, string> = {
  gpt_5_mini: Deno.env.get("LLM_MODEL_SMALL") ?? "gpt-4o-mini",
  gpt_5: Deno.env.get("LLM_MODEL_LARGE") ?? "gpt-4o",
  default: Deno.env.get("LLM_MODEL_DEFAULT") ?? "gpt-4o-mini",
};

/** InvokeLLM — returns a string, or a parsed object when response_json_schema is given.
 *  Runs through a concurrency limiter with retry/backoff so provider rate limits are absorbed. */
export function InvokeLLM(args: LLMArgs): Promise<unknown> {
  return limited("llm", LLM_CONCURRENCY, () => invokeLLMRaw(args));
}

async function invokeLLMRaw(args: LLMArgs): Promise<unknown> {
  const wantJson = !!args.response_json_schema;
  const model = MODEL_MAP[args.model ?? "default"] ?? MODEL_MAP.default;
  const sys = wantJson
    ? "You are a helpful assistant. Respond ONLY with valid JSON matching the requested schema. No prose."
    : "You are a helpful assistant.";

  if (LLM_PROVIDER === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-3-5-sonnet-latest",
        max_tokens: 2048, system: sys,
        messages: [{ role: "user", content: args.prompt + (wantJson ? `\n\nJSON schema: ${JSON.stringify(args.response_json_schema)}` : "") }],
      }),
    });
    if (!r.ok) throw Object.assign(new Error(`Anthropic ${r.status}`), { status: r.status });
    const j = await r.json();
    const text = j?.content?.[0]?.text ?? "";
    return wantJson ? safeJson(text) : text;
  }

  // default: OpenAI
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: args.prompt + (wantJson ? `\n\nJSON schema: ${JSON.stringify(args.response_json_schema)}` : "") },
      ],
      ...(wantJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) throw Object.assign(new Error(`OpenAI ${r.status}`), { status: r.status });
  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content ?? "";
  return wantJson ? safeJson(text) : text;
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch {
    const m = s.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch { /* fall */ } }
    return { _raw: s };
  }
}

/** SendEmail — SendGrid (default) or Amazon SES (EMAIL_PROVIDER=ses). Rate-limited + retried. */
export function SendEmail(args: { to: string; subject: string; body: string; from?: string }) {
  return limited("email", EMAIL_CONCURRENCY, () => sendEmailRaw(args));
}

async function sendEmailRaw(args: { to: string; subject: string; body: string; from?: string }) {
  const provider = Deno.env.get("EMAIL_PROVIDER") ?? "sendgrid";
  const from = args.from ?? Deno.env.get("EMAIL_FROM") ?? "no-reply@yourdomain.com";
  if (provider === "ses") return await sesSend({ ...args, from });
  if (provider === "smtp") { const { smtpSend } = await import("./email-smtp.ts"); return await smtpSend({ ...args, from }); }
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { authorization: `Bearer ${Deno.env.get("SENDGRID_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: args.to }] }],
      from: { email: from },
      subject: args.subject,
      content: [{ type: "text/html", value: args.body }],
    }),
  });
  if (!r.ok && (r.status === 429 || r.status >= 500)) throw Object.assign(new Error(`SendGrid ${r.status}`), { status: r.status });
  return { success: r.ok, status: r.status };
}

/** GenerateImage — OpenAI images by default; returns { url }. */
export async function GenerateImage(args: { prompt: string; size?: string }) {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: Deno.env.get("IMAGE_MODEL") ?? "dall-e-3", prompt: args.prompt, size: args.size ?? "1024x1024", n: 1 }),
  });
  const j = await r.json();
  return { url: j?.data?.[0]?.url ?? "" };
}

export const Core = { InvokeLLM, SendEmail, GenerateImage };
```

## `backend/sdk/auth.ts`
```ts
// JWT auth — replaces base44.auth. Tokens are signed HS256 with AUTH_JWT_SECRET.
// The token's `sub` claim is the User row id. Issue tokens from your login/signup
// endpoints (see server/auth-routes.ts) or from AWS Cognito (set AUTH_MODE=cognito
// and verify against the Cognito JWKS — see MIGRATION-PLAN.md).
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const SECRET = Deno.env.get("AUTH_JWT_SECRET") ?? "dev-secret-change-me";

async function key(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

export async function signJwt(sub: string, extra: Record<string, unknown> = {}, ttlSeconds = 60 * 60 * 24 * 7) {
  return await create({ alg: "HS256", typ: "JWT" }, { sub, ...extra, exp: getNumericDate(ttlSeconds) }, await key());
}

export async function verifyJwt(token: string): Promise<{ sub: string } | null> {
  try { return await verify(token, await key()) as { sub: string }; }
  catch { return null; }
}
```

## `backend/sdk/rls.ts`
```ts
// Row-Level Security enforcement for the USER-FACING entity routes.
// Loads db/rls-policy.json (generated by tools/rls-audit.mjs) and, for user-scoped
// entities, injects an owner filter so a signed-in user only sees their own rows.
// Backend functions use asServiceRole and bypass this entirely (leaderboards, admin, etc.).
type Policy = Record<string, { scope: "global" | "owner" | "self"; owner_field?: string }>;

let policy: Policy = {};
try {
  policy = JSON.parse(await Deno.readTextFile(new URL("../db/rls-policy.json", import.meta.url)));
} catch {
  console.warn("[rls] db/rls-policy.json not found — entity routes will run WITHOUT row scoping.");
}

export function entityScope(entity: string) {
  return policy[entity]?.scope ?? "global";
}

/** Merge the owner constraint into a query for reads. Returns the (possibly) scoped query. */
export function scopeQuery(entity: string, query: Record<string, unknown>, userId: string | null): Record<string, unknown> {
  const p = policy[entity];
  if (!p || p.scope === "global") return query;
  if (!userId) return query; // unauthenticated reads on scoped entities are handled by the route (401)
  if (p.scope === "self") return { ...query, id: userId };
  return { ...query, [p.owner_field ?? "user_id"]: userId };
}

/** Whether a write/read on this entity requires an authenticated user. */
export function requiresAuth(entity: string): boolean {
  return entityScope(entity) !== "global";
}
```

## `backend/sdk/queue.ts`
```ts
// In-process concurrency limiter + retry/backoff. Wraps provider calls (LLM, email) so
// provider rate limits become bounded concurrency + retries instead of user-facing 429s.
// For multi-instance scale, swap this for SQS + a worker (see MIGRATION-PLAN.md); the
// call sites don't change.
type Task<T> = () => Promise<T>;

class Limiter {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private concurrency: number) {}
  async run<T>(task: Task<T>): Promise<T> {
    if (this.active >= this.concurrency) await new Promise<void>((res) => this.queue.push(res));
    this.active++;
    try { return await task(); }
    finally { this.active--; const next = this.queue.shift(); if (next) next(); }
  }
}

const limiters = new Map<string, Limiter>();
function limiter(name: string, concurrency: number): Limiter {
  if (!limiters.has(name)) limiters.set(name, new Limiter(concurrency));
  return limiters.get(name)!;
}

/** Run `task` through a named concurrency limiter with exponential backoff on 429/5xx. */
export async function limited<T>(name: string, concurrency: number, task: Task<T>, opts: { retries?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 4;
  return await limiter(name, concurrency).run(async () => {
    let attempt = 0;
    // deno-lint-ignore no-explicit-any
    let lastErr: any;
    while (attempt <= retries) {
      try { return await task(); }
      catch (e) {
        lastErr = e;
        const status = (e as { status?: number })?.status ?? 0;
        if (status && status !== 429 && status < 500) throw e; // don't retry client errors
        const wait = Math.min(20000, 500 * 2 ** attempt) + Math.floor(attempt * 137); // backoff (no RNG)
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
      }
    }
    throw lastErr;
  });
}

export const LLM_CONCURRENCY = Number(Deno.env.get("LLM_CONCURRENCY") ?? "4");
export const EMAIL_CONCURRENCY = Number(Deno.env.get("EMAIL_CONCURRENCY") ?? "8");
```

## `backend/sdk/runtime.ts`
```ts
// Lets a converted function `export default __handler(async (req) => {...})`.
// __handler is an identity wrapper so the router can import the default handler.
export const __handler = <T>(fn: T): T => fn;
```

## `backend/sdk/email-smtp.ts`
```ts
// SMTP email provider (EMAIL_PROVIDER=smtp). Handy for local dev with Mailhog, or any
// SMTP relay in production. Uses denomailer. For Mailhog: SMTP_HOST=mailhog, SMTP_PORT=1025,
// no auth/TLS.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export async function smtpSend(args: { to: string; subject: string; body: string; from?: string }) {
  const host = Deno.env.get("SMTP_HOST") ?? "localhost";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "1025");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const tls = (Deno.env.get("SMTP_TLS") ?? "false") === "true";
  const from = args.from ?? Deno.env.get("EMAIL_FROM") ?? "no-reply@yourdomain.com";

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls,
      ...(user && pass ? { auth: { username: user, password: pass } } : {}),
    },
  });
  try {
    await client.send({ from, to: args.to, subject: args.subject, html: args.body });
    return { success: true, provider: "smtp" };
  } finally {
    await client.close();
  }
}
```

## `backend/sdk/aws/sigv4.ts`
```ts
// Minimal AWS Signature V4 for Deno (Web Crypto only — no aws-sdk dependency).
// Used by s3.ts (presigned PUT) and ses.ts (SendEmail). Enough surface for our needs.
const enc = new TextEncoder();

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === "string" ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return hex(new Uint8Array(hash));
}
function hex(b: Uint8Array): string { return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); }

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
async function signingKey(secret: string, date: string, region: string, service: string): Promise<Uint8Array> {
  const kDate = await hmac(enc.encode("AWS4" + secret), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, "aws4_request");
}
function amzDate(d = new Date()): { amz: string; date: string } {
  const amz = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz, date: amz.slice(0, 8) };
}
const uriEncode = (s: string, encodeSlash = true) =>
  encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, encodeSlash ? "%2F" : "/");

export interface AwsCreds { accessKeyId: string; secretAccessKey: string; region: string; sessionToken?: string; }

/** Presign an S3 PUT URL (query-string auth, UNSIGNED-PAYLOAD). */
export async function presignS3Put(creds: AwsCreds, bucket: string, key: string, expires = 900): Promise<string> {
  const host = `${bucket}.s3.${creds.region}.amazonaws.com`;
  const { amz, date } = amzDate();
  const scope = `${date}/${creds.region}/s3/aws4_request`;
  const q = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${creds.accessKeyId}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  if (creds.sessionToken) q.set("X-Amz-Security-Token", creds.sessionToken);
  const canonicalUri = "/" + key.split("/").map((s) => uriEncode(s, false)).join("/");
  const canonicalQuery = [...q.entries()].map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`).sort().join("&");
  const canonicalReq = ["PUT", canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, await sha256Hex(canonicalReq)].join("\n");
  const sig = hex(await hmac(await signingKey(creds.secretAccessKey, date, creds.region, "s3"), sts));
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${sig}`;
}

/** Signed POST to an AWS JSON/REST service (used by SES v2). */
export async function signedFetch(creds: AwsCreds, service: string, host: string, pathname: string, bodyStr: string, contentType = "application/json"): Promise<Response> {
  const { amz, date } = amzDate();
  const scope = `${date}/${creds.region}/${service}/aws4_request`;
  const payloadHash = await sha256Hex(bodyStr);
  const headers: Record<string, string> = {
    "content-type": contentType, host, "x-amz-content-sha256": payloadHash, "x-amz-date": amz,
  };
  if (creds.sessionToken) headers["x-amz-security-token"] = creds.sessionToken;
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join("");
  const canonicalReq = ["POST", pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, await sha256Hex(canonicalReq)].join("\n");
  const sig = hex(await hmac(await signingKey(creds.secretAccessKey, date, creds.region, service), sts));
  headers["authorization"] = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;
  return await fetch(`https://${host}${pathname}`, { method: "POST", headers, body: bodyStr });
}

export function credsFromEnv(): AwsCreds {
  return {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID") ?? "",
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? "",
    region: Deno.env.get("AWS_REGION") ?? "us-east-1",
    sessionToken: Deno.env.get("AWS_SESSION_TOKEN") ?? undefined,
  };
}
```

## `backend/sdk/aws/s3.ts`
```ts
// S3 uploads via presigned PUT. UploadFile returns { upload_url, file_url }: the client
// PUTs the file bytes to upload_url, then references file_url. (Base44 UploadFile took
// bytes directly; the presigned pattern keeps large files off the backend.)
import { presignS3Put, credsFromEnv } from "./sigv4.ts";

export async function uploadFileUrls(filename: string): Promise<{ upload_url: string; file_url: string; key: string }> {
  const bucket = Deno.env.get("S3_BUCKET")!;
  const region = Deno.env.get("AWS_REGION") ?? "us-east-1";
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  const key = `uploads/${Date.now()}-${safe}`;
  const upload_url = await presignS3Put(credsFromEnv(), bucket, key, Number(Deno.env.get("S3_PRESIGN_EXPIRES") ?? "900"));
  const publicBase = Deno.env.get("S3_PUBLIC_BASE") ?? `https://${bucket}.s3.${region}.amazonaws.com`;
  return { upload_url, file_url: `${publicBase}/${key}`, key };
}
```

## `backend/sdk/aws/ses.ts`
```ts
// SES v2 SendEmail via signed POST. Enable with EMAIL_PROVIDER=ses.
import { signedFetch, credsFromEnv } from "./sigv4.ts";

export async function sesSend(args: { to: string; subject: string; body: string; from?: string }) {
  const creds = credsFromEnv();
  const from = args.from ?? Deno.env.get("EMAIL_FROM") ?? "no-reply@yourdomain.com";
  const host = `email.${creds.region}.amazonaws.com`;
  const payload = JSON.stringify({
    FromEmailAddress: from,
    Destination: { ToAddresses: [args.to] },
    Content: { Simple: { Subject: { Data: args.subject }, Body: { Html: { Data: args.body } } } },
  });
  const r = await signedFetch(creds, "ses", host, "/v2/email/outbound-emails", payload);
  return { success: r.ok, status: r.status };
}
```
# ===== BACKEND: SERVER =====

## `backend/server/main.ts`
```ts
// Nexus backend entrypoint (Deno). Mounts all converted functions as HTTP routes and
// registers them for in-process functions.invoke(). Run: deno run --allow-net --allow-env --allow-read server/main.ts
import { functionRegistry } from "../sdk/mod.ts";
import { authRoutes } from "./auth-routes.ts";
import { entityRoutes } from "./entity-routes.ts";
import { integrationRoutes } from "./integration-routes.ts";
import { runAgent, listAgents } from "../agents-runtime/agent-runtime.ts";
import { extraRoutes } from "./extra-routes.ts";

const manifest: string[] = JSON.parse(await Deno.readTextFile(new URL("../functions/_manifest.json", import.meta.url)));

// Dynamically import each function's default handler and register it by name.
let loaded = 0;
for (const name of manifest) {
  try {
    const mod = await import(new URL(`../functions/${name}/entry.ts`, import.meta.url).href);
    if (typeof mod.default === "function") { functionRegistry.set(name, mod.default); loaded++; }
    else console.warn(`[load] ${name}: no default handler`);
  } catch (e) { console.error(`[load] ${name} failed:`, (e as Error).message); }
}
console.log(`Loaded ${loaded}/${manifest.length} functions`);

const PORT = Number(Deno.env.get("PORT") ?? "8000");
const CORS = {
  "access-control-allow-origin": Deno.env.get("CORS_ORIGIN") ?? "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Health check
  if (url.pathname === "/health") return Response.json({ ok: true, functions: loaded, agents: listAgents().length });

  // Auth endpoints: /auth/signup, /auth/login, /auth/me
  if (url.pathname.startsWith("/auth/")) {
    const res = await authRoutes(req, url.pathname);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }

  // Extra routes: /analytics, /applogs, /agents/conversations* (checked before /agents/:name)
  if (url.pathname === "/analytics" || url.pathname === "/applogs" || url.pathname.startsWith("/agents/conversations")) {
    const res = await extraRoutes(req, url.pathname);
    if (res) { for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v); return res; }
  }

  // Agent runtime: GET /agents (list), POST /agents/:name { message, context }
  if (url.pathname === "/agents" && req.method === "GET") {
    return Response.json({ agents: listAgents() }, { headers: CORS });
  }
  const am = url.pathname.match(/^\/agents\/([A-Za-z0-9_]+)$/);
  if (am && req.method === "POST") {
    try {
      const { message, context } = await req.json();
      const out = await runAgent(am[1], message ?? "", context);
      return Response.json(out, { headers: CORS });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500, headers: CORS });
    }
  }

  // Entity routes (frontend DB access): /entities/:name/:op
  if (url.pathname.startsWith("/entities/")) {
    const res = await entityRoutes(req, url.pathname);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }

  // Integration routes (frontend): /integrations/:name
  if (url.pathname.startsWith("/integrations/")) {
    const res = await integrationRoutes(req, url.pathname);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }

  // Function routes: /functions/:name
  const m = url.pathname.match(/^\/functions\/([A-Za-z0-9_]+)$/);
  if (m) {
    const handler = functionRegistry.get(m[1]);
    if (!handler) return Response.json({ error: "Function not found" }, { status: 404, headers: CORS });
    const res = await handler(req);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }

  return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
});
console.log(`Nexus backend listening on :${PORT}`);
```

## `backend/server/auth-routes.ts`
```ts
// Email/password + Google auth issuing JWTs, replacing Base44's hosted auth.
// Includes password reset (token by email) and Sign in with Google.
import { db } from "../sdk/db.ts";
import { signJwt, verifyJwt } from "../sdk/auth.ts";
import { Core } from "../sdk/integrations.ts";

const FRONTEND_URL = (Deno.env.get("FRONTEND_URL") ?? "http://localhost:5173").replace(/\/$/, "");
const RESET_TTL_MIN = Number(Deno.env.get("RESET_TOKEN_TTL_MIN") ?? "60");

function hex(b: Uint8Array): string { return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function sha256Hex(s: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
}
function randomToken(): string { return hex(crypto.getRandomValues(new Uint8Array(32))); }

async function hash(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.digest("SHA-256", new Uint8Array([...salt, ...new TextEncoder().encode(pw)]));
  return btoa(String.fromCharCode(...salt)) + ":" + btoa(String.fromCharCode(...new Uint8Array(bits)));
}
async function checkPw(pw: string, stored: string): Promise<boolean> {
  const [saltB64] = stored.split(":");
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const bits = await crypto.subtle.digest("SHA-256", new Uint8Array([...salt, ...new TextEncoder().encode(pw)]));
  return btoa(String.fromCharCode(...salt)) + ":" + btoa(String.fromCharCode(...new Uint8Array(bits))) === stored;
}

export async function authRoutes(req: Request, pathname: string): Promise<Response> {
  if (pathname === "/auth/signup" && req.method === "POST") {
    const { email, password, full_name } = await req.json();
    if (!email || !password) return Response.json({ error: "email and password required" }, { status: 400 });
    const existing = await db.filter("User", { email }, undefined, 1);
    if (existing.length) return Response.json({ error: "Email already registered" }, { status: 409 });
    const user = await db.create("User", { email, password_hash: await hash(password), role: "user", full_name, current_balance: 0, total_earnings: 0 });
    const token = await signJwt(user.id as string, { email });
    return Response.json({ token, user: safeUser(user) });
  }

  if (pathname === "/auth/login" && req.method === "POST") {
    const { email, password } = await req.json();
    const rows = await db.filter("User", { email }, undefined, 1);
    const user = rows[0];
    if (!user || !user.password_hash || !(await checkPw(password, user.password_hash as string)))
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    const token = await signJwt(user.id as string, { email });
    return Response.json({ token, user: safeUser(user) });
  }

  if (pathname === "/auth/updateMe" && req.method === "POST") {
    const authz = req.headers.get("authorization") ?? "";
    const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
    const payload = token ? await verifyJwt(token) : null;
    if (!payload) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const patch = await req.json();
    delete patch.password_hash; delete patch.role; // don't let users self-elevate
    const updated = await db.update("User", payload.sub, patch);
    return updated ? Response.json(safeUser(updated)) : Response.json({ error: "Not found" }, { status: 404 });
  }

  // --- Password reset: request a reset link by email ---
  if (pathname === "/auth/request-reset" && req.method === "POST") {
    const { email } = await req.json();
    const rows = email ? await db.filter("User", { email }, undefined, 1) : [];
    const user = rows[0];
    // Always return success (don't reveal whether an email is registered).
    if (user) {
      const token = randomToken();
      const expires = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000).toISOString();
      await db.update("User", user.id as string, { reset_token_hash: await sha256Hex(token), reset_token_expires: expires });
      const link = `${FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      try {
        await Core.SendEmail({
          to: email,
          subject: "Reset your PlayEarning Nexus password",
          body: `<p>We received a request to reset your password.</p>
<p><a href="${link}">Click here to choose a new password</a>. This link expires in ${RESET_TTL_MIN} minutes.</p>
<p>If you didn't request this, you can ignore this email.</p>`,
        });
      } catch (e) { console.error("[request-reset] email failed:", (e as Error).message); }
      // DEV ONLY: return the link in the response so you can verify reset without email.
      if (Deno.env.get("DEV_RETURN_RESET_LINK") === "true") {
        return Response.json({ success: true, dev_reset_link: link });
      }
    }
    return Response.json({ success: true, message: "If that email exists, a reset link has been sent." });
  }

  // --- Password reset: set a new password with a valid token ---
  if (pathname === "/auth/reset-password" && req.method === "POST") {
    const { email, token, new_password } = await req.json();
    if (!email || !token || !new_password) return Response.json({ error: "email, token and new_password required" }, { status: 400 });
    if (String(new_password).length < 8) return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    const rows = await db.filter("User", { email }, undefined, 1);
    const user = rows[0];
    const okToken = user && user.reset_token_hash && user.reset_token_hash === await sha256Hex(token);
    const notExpired = user && user.reset_token_expires && new Date(user.reset_token_expires as string) > new Date();
    if (!okToken || !notExpired) return Response.json({ error: "Invalid or expired reset link" }, { status: 400 });
    await db.update("User", user.id as string, { password_hash: await hash(new_password), reset_token_hash: null, reset_token_expires: null });
    const jwt = await signJwt(user.id as string, { email });
    return Response.json({ success: true, token: jwt, user: safeUser({ ...user, password_hash: undefined }) });
  }

  // --- Admin: invite a user (creates the account + emails a set-password link) ---
  if (pathname === "/auth/invite" && req.method === "POST") {
    const authz = req.headers.get("authorization") ?? "";
    const tok = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
    const payload = tok ? await verifyJwt(tok) : null;
    if (!payload) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const inviter = await db.get("User", payload.sub);
    if (inviter?.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    const { email, full_name, role } = await req.json();
    if (!email) return Response.json({ error: "email required" }, { status: 400 });
    const existing = await db.filter("User", { email }, undefined, 1);
    let user = existing[0];
    if (!user) user = await db.create("User", { email, role: role === "admin" ? "admin" : "user", full_name: full_name ?? "", invited_by: inviter.id, current_balance: 0, total_earnings: 0 });

    // Issue a set-password (reset) token so the invitee can choose a password.
    const token = randomToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7-day invite
    await db.update("User", user.id as string, { reset_token_hash: await sha256Hex(token), reset_token_expires: expires });
    const link = `${FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    try {
      await Core.SendEmail({
        to: email,
        subject: "You've been invited to PlayEarning Nexus",
        body: `<p>${inviter.full_name || "An admin"} invited you to PlayEarning Nexus.</p>
<p><a href="${link}">Click here to set your password and get started</a>. This invite expires in 7 days.</p>`,
      });
    } catch (e) { console.error("[invite] email failed:", (e as Error).message); }
    return Response.json({ success: true, user_id: user.id, ...(Deno.env.get("DEV_RETURN_RESET_LINK") === "true" ? { dev_invite_link: link } : {}) });
  }

  // --- Sign in with Google (client sends a Google ID token) ---
  if (pathname === "/auth/google" && req.method === "POST") {
    const { id_token } = await req.json();
    if (!id_token) return Response.json({ error: "id_token required" }, { status: 400 });
    // Verify with Google's tokeninfo endpoint (checks signature + expiry server-side).
    const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`).then((r) => r.ok ? r.json() : null).catch(() => null);
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!info || !info.email || (clientId && info.aud !== clientId)) {
      return Response.json({ error: "Invalid Google token" }, { status: 401 });
    }
    if (info.email_verified === "false") return Response.json({ error: "Google email not verified" }, { status: 401 });
    let rows = await db.filter("User", { email: info.email }, undefined, 1);
    let user = rows[0];
    if (!user) {
      user = await db.create("User", { email: info.email, role: "user", full_name: info.name ?? "", avatar_url: info.picture ?? "", google_sub: info.sub, current_balance: 0, total_earnings: 0 });
    }
    const jwt = await signJwt(user.id as string, { email: info.email });
    return Response.json({ token: jwt, user: safeUser(user) });
  }

  if (pathname === "/auth/me" && req.method === "GET") {
    const authz = req.headers.get("authorization") ?? "";
    const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
    const payload = token ? await verifyJwt(token) : null;
    if (!payload) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const user = await db.get("User", payload.sub);
    return user ? Response.json(safeUser(user)) : Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

function safeUser(u: Record<string, unknown>) { const { password_hash, reset_token_hash, reset_token_expires, ...rest } = u; return rest; }
```

## `backend/server/entity-routes.ts`
```ts
// Generic entity REST routes for the FRONTEND (the browser can no longer talk to the
// database directly the way the Base44 client did). Maps 1:1 to the frontend shim.
// Row-Level Security (Phase 3): user-scoped entities are auto-filtered to the signed-in
// user via db/rls-policy.json; global entities are open. Backend functions use the
// service-role SDK and bypass all of this.
import { db } from "../sdk/db.ts";
import { verifyJwt } from "../sdk/auth.ts";
import { entityScope, scopeQuery, requiresAuth } from "../sdk/rls.ts";

async function userIdFrom(req: Request): Promise<string | null> {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
  const payload = token ? await verifyJwt(token) : null;
  return payload?.sub ?? null;
}

export async function entityRoutes(req: Request, pathname: string): Promise<Response> {
  const m = pathname.match(/^\/entities\/([A-Za-z0-9_]+)\/([a-zA-Z]+)$/);
  if (!m) return Response.json({ error: "Not found" }, { status: 404 });
  const [, entity, op] = m;

  const uid = await userIdFrom(req);
  // User-scoped entities require a signed-in user for every operation.
  if (requiresAuth(entity) && !uid) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const scope = entityScope(entity);

  try {
    switch (op) {
      case "filter": return Response.json(await db.filter(entity, scopeQuery(entity, body.query ?? {}, uid), body.sort, body.limit));
      case "list": return Response.json(await db.filter(entity, scopeQuery(entity, {}, uid), body.sort, body.limit));
      case "get": {
        const row = await db.get(entity, body.id);
        if (row && scope !== "global" && !ownedBy(row, entity, uid)) return Response.json({ error: "Forbidden" }, { status: 403 });
        return Response.json(row);
      }
      case "create": {
        const data = body.data ?? body;
        // Stamp ownership on user-scoped creates.
        if (scope === "owner") { const of = ownerFieldFor(entity); if (of && data[of] == null && uid) data[of] = uid; }
        return Response.json(await db.create(entity, data, uid ?? undefined));
      }
      case "update": {
        if (scope !== "global") { const row = await db.get(entity, body.id); if (!row || !ownedBy(row, entity, uid)) return Response.json({ error: "Forbidden" }, { status: 403 }); }
        return Response.json(await db.update(entity, body.id, body.data ?? {}));
      }
      case "delete": {
        if (scope !== "global") { const row = await db.get(entity, body.id); if (!row || !ownedBy(row, entity, uid)) return Response.json({ error: "Forbidden" }, { status: 403 }); }
        return Response.json(await db.remove(entity, body.id));
      }
      case "bulkCreate": return Response.json(await db.bulkCreate(entity, body.docs ?? [], uid ?? undefined));
      default: return Response.json({ error: `Unknown op ${op}` }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Cache owner field lookups from the policy via scopeQuery's shape.
function ownerFieldFor(entity: string): string | null {
  const probe = scopeQuery(entity, {}, "__uid__");
  const k = Object.keys(probe).find((key) => probe[key] === "__uid__");
  return k ?? null;
}
function ownedBy(row: Record<string, unknown>, entity: string, uid: string | null): boolean {
  if (!uid) return false;
  if (entityScope(entity) === "self") return row.id === uid;
  const of = ownerFieldFor(entity);
  return of ? row[of] === uid : true;
}
```

## `backend/server/integration-routes.ts`
```ts
// Integration passthrough for the FRONTEND: POST /integrations/:name
// Covers InvokeLLM, SendEmail, GenerateImage, GenerateSpeech, UploadFile.
import { Core } from "../sdk/integrations.ts";

export async function integrationRoutes(req: Request, pathname: string): Promise<Response> {
  const m = pathname.match(/^\/integrations\/([A-Za-z]+)$/);
  if (!m) return Response.json({ error: "Not found" }, { status: 404 });
  const name = m[1];
  const args = await req.json().catch(() => ({}));
  try {
    switch (name) {
      case "InvokeLLM": return Response.json({ result: await Core.InvokeLLM(args) });
      case "SendEmail": return Response.json(await Core.SendEmail(args));
      case "GenerateImage": return Response.json(await Core.GenerateImage(args));
      case "GenerateSpeech": return await generateSpeech(args);
      case "UploadFile": return await uploadFile(req, args);
      default: return Response.json({ error: `Unknown integration ${name}` }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// OpenAI TTS → returns a data URL (swap to S3 in Phase 3 for large files).
async function generateSpeech(args: { text?: string; voice?: string }): Promise<Response> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return Response.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("TTS_MODEL") ?? "tts-1", voice: args.voice ?? "alloy", input: args.text ?? "" }),
  });
  const buf = new Uint8Array(await r.arrayBuffer());
  const b64 = btoa(String.fromCharCode(...buf));
  return Response.json({ url: `data:audio/mpeg;base64,${b64}` });
}

// UploadFile → returns presigned S3 URLs. The client PUTs bytes to upload_url, then uses
// file_url. (If your frontend previously sent bytes to UploadFile, switch it to: request
// URLs here, then PUT the File to upload_url — see PHASE-3-NOTES.md.)
async function uploadFile(_req: Request, args: { filename?: string }): Promise<Response> {
  const bucket = Deno.env.get("S3_BUCKET");
  if (!bucket) {
    return Response.json(
      { error: "UploadFile not configured", hint: "Set S3_BUCKET + AWS creds (see PHASE-3-NOTES.md)." },
      { status: 501 },
    );
  }
  const { uploadFileUrls } = await import("../sdk/aws/s3.ts");
  const urls = await uploadFileUrls(args.filename ?? "file.bin");
  return Response.json(urls);
}
```

## `backend/server/extra-routes.ts`
```ts
// Routes for features restored after Base44 removal: in-app agent conversations,
// analytics events, and app logs. Wired into server/main.ts.
import { db } from "../sdk/db.ts";
import { verifyJwt } from "../sdk/auth.ts";
import { runAgent } from "../agents-runtime/agent-runtime.ts";

async function uid(req: Request): Promise<string | null> {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
  const p = token ? await verifyJwt(token) : null;
  return p?.sub ?? null;
}

export async function extraRoutes(req: Request, pathname: string): Promise<Response | null> {
  // ---- Analytics ----
  if (pathname === "/analytics" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const user = await uid(req);
    const row = await db.create("AnalyticsEvent", { ...body, ts: new Date().toISOString() }, user ?? undefined);
    return Response.json({ ok: true, id: row.id });
  }

  // ---- App logs ----
  if (pathname === "/applogs" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const user = await uid(req);
    const row = await db.create("AppLog", { ...body }, user ?? undefined);
    return Response.json({ ok: true, id: row.id });
  }

  // ---- Agent conversations ----
  if (pathname === "/agents/conversations" && req.method === "POST") {
    const { agent_name, metadata } = await req.json().catch(() => ({}));
    const user = await uid(req);
    const conv = await db.create("AgentConversation", { agent_name, metadata: metadata ?? {}, user_id: user }, user ?? undefined);
    return Response.json(conv);
  }

  if (pathname === "/agents/conversations/list" && req.method === "POST") {
    const { agent_name } = await req.json().catch(() => ({}));
    const user = await uid(req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const q: Record<string, unknown> = { created_by: user };
    if (agent_name) q.agent_name = agent_name;
    return Response.json(await db.filter("AgentConversation", q, "-created_date", 100));
  }

  // /agents/conversations/:id/messages
  const msgMatch = pathname.match(/^\/agents\/conversations\/([A-Za-z0-9-]+)\/messages$/);
  if (msgMatch) {
    const convId = msgMatch[1];
    const user = await uid(req);

    if (req.method === "GET") {
      const msgs = await db.filter("AgentMessage", { conversation_id: convId }, "created_date", 500);
      return Response.json(msgs);
    }

    if (req.method === "POST") {
      const message = await req.json().catch(() => ({}));
      // Persist the incoming (usually user) message.
      const userMsg = await db.create("AgentMessage", { conversation_id: convId, role: message.role ?? "user", content: message.content ?? "" }, user ?? undefined);

      // If it's a user message, run the agent and persist its reply.
      if ((message.role ?? "user") === "user") {
        const conv = await db.get("AgentConversation", convId);
        const agentName = (conv?.agent_name as string) ?? "";
        try {
          const history = await db.filter("AgentMessage", { conversation_id: convId }, "created_date", 50);
          const context = history.map((m) => ({ role: m.role, content: m.content }));
          const out = await runAgent(agentName, message.content ?? "", context);
          await db.create("AgentMessage", { conversation_id: convId, role: "assistant", content: out.reply, steps: out.steps }, user ?? undefined);
        } catch (e) {
          await db.create("AgentMessage", { conversation_id: convId, role: "assistant", content: `⚠ ${(e as Error).message}` }, user ?? undefined);
        }
      }
      return Response.json(userMsg);
    }
  }

  return null; // not an extra route
}
```
# ===== BACKEND: AGENTS + SCHEDULER =====

## `backend/agents-runtime/agent-runtime.ts`
```ts
// Agent runtime — replaces Base44's hosted AI agents. Each agent (agents.json) has
// instructions + a set of entities it may read/write (tool_configs). We expose those as
// OpenAI function-calling tools and run a bounded tool-use loop. The agent's entity
// access is enforced to exactly its allowed operations.
//
// Route: POST /agents/:name  { message, context? }  → { reply, steps }
import { db } from "../sdk/db.ts";
import { limited, LLM_CONCURRENCY } from "../sdk/queue.ts";

type AgentDef = { description: string; instructions: string; model: string | null; tools: { entity: string; ops: string[] }[] };
const registry: Record<string, AgentDef> = JSON.parse(await Deno.readTextFile(new URL("./agents.json", import.meta.url)));

const MODEL = Deno.env.get("AGENT_MODEL") ?? Deno.env.get("LLM_MODEL_LARGE") ?? "gpt-4o";
const MAX_STEPS = Number(Deno.env.get("AGENT_MAX_STEPS") ?? "6");

export function listAgents() { return Object.keys(registry); }

// Build OpenAI tool specs from an agent's allowed entity operations.
function toolsFor(def: AgentDef) {
  const tools: unknown[] = [];
  for (const t of def.tools) {
    if (t.ops.includes("read")) {
      tools.push(fn(`read_${t.entity}`, `Query ${t.entity} records`, { query: { type: "object" }, limit: { type: "number" } }));
    }
    if (t.ops.includes("create")) {
      tools.push(fn(`create_${t.entity}`, `Create a ${t.entity} record`, { data: { type: "object" } }, ["data"]));
    }
    if (t.ops.includes("update")) {
      tools.push(fn(`update_${t.entity}`, `Update a ${t.entity} record by id`, { id: { type: "string" }, data: { type: "object" } }, ["id", "data"]));
    }
  }
  return tools;
}
function fn(name: string, description: string, props: Record<string, unknown>, required: string[] = []) {
  return { type: "function", function: { name, description, parameters: { type: "object", properties: props, required } } };
}

async function runTool(def: AgentDef, name: string, args: Record<string, unknown>) {
  const m = name.match(/^(read|create|update)_(.+)$/);
  if (!m) return { error: "unknown tool" };
  const [, op, entity] = m;
  const allowed = def.tools.find((t) => t.entity === entity);
  if (!allowed) return { error: "entity not permitted" };
  if (op === "read" && allowed.ops.includes("read")) return await db.filter(entity, (args.query as Record<string, unknown>) ?? {}, undefined, (args.limit as number) ?? 25);
  if (op === "create" && allowed.ops.includes("create")) return await db.create(entity, (args.data as Record<string, unknown>) ?? {});
  if (op === "update" && allowed.ops.includes("update")) return await db.update(entity, args.id as string, (args.data as Record<string, unknown>) ?? {});
  return { error: "operation not permitted" };
}

export async function runAgent(name: string, message: string, context?: unknown): Promise<{ reply: string; steps: unknown[] }> {
  const def = registry[name];
  if (!def) throw new Error(`Unknown agent: ${name}`);
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not set (agent runtime uses OpenAI function-calling)");

  const tools = toolsFor(def);
  const messages: Record<string, unknown>[] = [
    { role: "system", content: `${def.instructions}\n\nUse the provided tools to read/write data as needed. When done, reply to the user directly.` },
    { role: "user", content: context ? `${message}\n\nContext: ${JSON.stringify(context)}` : message },
  ];
  const steps: unknown[] = [];

  for (let i = 0; i < MAX_STEPS; i++) {
    const j = await limited("llm", LLM_CONCURRENCY, async () => {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ model: def.model && def.model.startsWith("gpt") ? def.model : MODEL, messages, tools, tool_choice: "auto" }),
      });
      if (!r.ok) throw Object.assign(new Error(`OpenAI ${r.status}`), { status: r.status });
      return await r.json();
    });
    const msg = j?.choices?.[0]?.message;
    if (!msg) break;
    messages.push(msg);
    const calls = msg.tool_calls ?? [];
    if (!calls.length) return { reply: msg.content ?? "", steps };
    for (const c of calls) {
      let out; try { out = await runTool(def, c.function.name, JSON.parse(c.function.arguments || "{}")); }
      catch (e) { out = { error: (e as Error).message }; }
      steps.push({ tool: c.function.name, result: out });
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out).slice(0, 4000) });
    }
  }
  return { reply: "(agent reached step limit)", steps };
}
```

## `backend/scheduler/main.ts`
```ts
// Nexus scheduler — runs automation functions on cron using Deno.cron. Deploy as a
// separate always-on process (ECS service / Deno Deploy). It calls the backend's
// /functions/<name> with a service token, so it needs BACKEND_URL + a service JWT.
//   deno run --allow-net --allow-env --unstable-cron scheduler/main.ts
import { signJwt } from "../sdk/auth.ts";

const BACKEND = (Deno.env.get("BACKEND_URL") ?? "http://localhost:8000").replace(/\/$/, "");
const SERVICE_USER_ID = Deno.env.get("SCHEDULER_SERVICE_USER_ID") ?? "00000000-0000-0000-0000-000000000001"; // seed admin
const cfg = JSON.parse(await Deno.readTextFile(new URL("./schedules.json", import.meta.url)));

async function invoke(fnName: string) {
  const token = await signJwt(SERVICE_USER_ID, { service: true });
  const res = await fetch(`${BACKEND}/functions/${fnName}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ scheduled: true, action: "run" }),
  });
  console.log(`[cron] ${fnName} → ${res.status}`);
}

for (const job of cfg.jobs) {
  // Deno.cron registers a named cron trigger; the runtime fires the handler on schedule.
  Deno.cron(job.name, job.cron, () => invoke(job.function));
  console.log(`registered ${job.name}: "${job.cron}" → ${job.function}`);
}
console.log(`Scheduler up — ${cfg.jobs.length} jobs, backend ${BACKEND}`);
```

## `backend/scheduler/schedules.json`
```json
{
  "_comment": "Cron schedules for automation functions (UTC). Mirrors the Master Launch Guide Phase 7. Edit freely.",
  "jobs": [
    { "name": "daily-referral-contest",     "cron": "0 9 * * *",   "function": "autoReferralContestDaily" },
    { "name": "daily-ecosystem-engine",      "cron": "15 9 * * *",  "function": "autonomousEcosystemEngine" },
    { "name": "daily-credit-pending",        "cron": "30 9 * * *",  "function": "creditPendingReferralPostRewards" },
    { "name": "daily-operations",            "cron": "0 10 * * *",  "function": "autoDailyOperationsEngine" },
    { "name": "daily-ai-goal",               "cron": "0 8 * * *",   "function": "generateAIDailyGoal" },
    { "name": "weekly-prize-pool",           "cron": "0 12 * * 1",  "function": "processWeeklyJackpot" },
    { "name": "weekly-referral-campaign-new","cron": "0 8 * * 1",   "function": "generateWeeklyReferralCampaign" },
    { "name": "weekly-referral-conclude",    "cron": "0 7 * * 1",   "function": "concludeWeeklyReferralCampaign" },
    { "name": "weekly-featurevote-new",      "cron": "0 8 * * 2",   "function": "generateWeeklyFeatureVoteSurvey" },
    { "name": "weekly-featurevote-conclude", "cron": "0 7 * * 2",   "function": "concludeWeeklyFeatureVote" },
    { "name": "weekly-contest-winner",       "cron": "0 13 * * 1",  "function": "weeklyContestWinner" },
    { "name": "weekly-reports",              "cron": "0 6 * * 1",   "function": "autoWeeklyReportsEngine" },
    { "name": "orchestrator-master-6h",      "cron": "0 */6 * * *", "function": "masterOrchestrator" },
    { "name": "orchestrator-ai-6h",          "cron": "0 */6 * * *", "function": "aiOrchestrator" }
  ]
}
```
# ===== BACKEND: TOOLING =====

## `backend/tools/gen-schema.mjs`
```js
#!/usr/bin/env node
/**
 * Generate a PostgreSQL schema from Base44 entity definitions (base44/entities/*.jsonc).
 *
 * Design: Base44 is a document store, so each entity becomes a table with a JSONB `data`
 * column holding all its properties, plus promoted system columns (id, created_date,
 * updated_date, created_by). A GIN index (jsonb_path_ops) makes equality/containment
 * filters fast — which is exactly what the code's .filter({field: value}) calls do.
 *
 * Usage: node tools/gen-schema.mjs <entities_dir> <out.sql>
 */
import fs from 'node:fs';
import path from 'node:path';

const [,, ENT_DIR, OUT] = process.argv;
if (!ENT_DIR || !OUT) { console.error('usage: gen-schema.mjs <entities_dir> <out.sql>'); process.exit(1); }

// Tolerant JSONC → JSON: strip /* */ and // comments that are NOT inside strings.
function stripJsonc(src) {
  let out = ''; let inStr = false; let strCh = ''; let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i+1];
    if (inStr) {
      out += c;
      if (c === '\\') { out += src[i+1] ?? ''; i += 2; continue; }
      if (c === strCh) inStr = false;
      i++; continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i+1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

const files = fs.readdirSync(ENT_DIR).filter(f => f.endsWith('.jsonc') || f.endsWith('.json'));
const SYSTEM = new Set(['id','created_date','updated_date','created_by']);
let sql = `-- PlayEarning Nexus — PostgreSQL schema (generated from ${files.length} Base44 entities)
-- Generated by tools/gen-schema.mjs. Document-store faithful port: properties live in JSONB "data".
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for gen_random_uuid()

`;

let ok = 0, bad = [];
for (const f of files.sort()) {
  const raw = fs.readFileSync(path.join(ENT_DIR, f), 'utf8');
  let def;
  try { def = JSON.parse(stripJsonc(raw)); }
  catch (e) { bad.push(f + ' (' + e.message.slice(0,40) + ')'); continue; }
  const name = def.name || path.basename(f).replace(/\.jsonc?$/, '');
  const props = def.properties || {};
  const t = `"${name}"`;
  sql += `-- ${name}: ${Object.keys(props).length} properties\n`;
  sql += `CREATE TABLE IF NOT EXISTS ${t} (\n`;
  sql += `  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,\n`;
  sql += `  created_date timestamptz NOT NULL DEFAULT now(),\n`;
  sql += `  updated_date timestamptz NOT NULL DEFAULT now(),\n`;
  sql += `  created_by   text,\n`;
  if (name === 'User') {
    sql += `  email         text UNIQUE,\n`;
    sql += `  password_hash text,\n`;
    sql += `  role          text NOT NULL DEFAULT 'user',\n`;
  }
  sql += `  data         jsonb NOT NULL DEFAULT '{}'::jsonb\n`;
  sql += `);\n`;
  sql += `CREATE INDEX IF NOT EXISTS "${name}_data_gin" ON ${t} USING gin (data jsonb_path_ops);\n`;
  sql += `CREATE INDEX IF NOT EXISTS "${name}_created" ON ${t} (created_date DESC);\n\n`;
  ok++;
}

sql += `\n-- Auto-update updated_date on row change\nCREATE OR REPLACE FUNCTION set_updated_date() RETURNS trigger AS $$\nBEGIN NEW.updated_date = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;\n`;

fs.writeFileSync(OUT, sql);
console.log(`Generated ${ok} tables → ${OUT}`);
if (bad.length) { console.log(`SKIPPED ${bad.length} (parse issues):`); bad.slice(0,20).forEach(b => console.log('  - ' + b)); }
```

## `backend/tools/codemod-functions.mjs`
```js
#!/usr/bin/env node
/**
 * Convert Base44 Deno functions to run on the self-hosted SDK.
 *  - swaps  import {...} from 'npm:@base44/sdk@x'  →  ../../sdk/mod.ts
 *  - swaps  Deno.serve(<handler>)  →  export default __handler(<handler>)
 * Usage: node tools/codemod-functions.mjs <src_functions_dir> <dest_functions_dir>
 */
import fs from 'node:fs';
import path from 'node:path';

const [,, SRC, DEST] = process.argv;
if (!SRC || !DEST) { console.error('usage: codemod-functions.mjs <src> <dest>'); process.exit(1); }
fs.mkdirSync(DEST, { recursive: true });

const dirs = fs.readdirSync(SRC).filter(d => fs.existsSync(path.join(SRC, d, 'entry.ts')));
let converted = 0; const flags = [];

const SDK_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]npm:@base44\/sdk@[^'"]+['"]\s*;?/;

for (const d of dirs) {
  const srcFile = path.join(SRC, d, 'entry.ts');
  let code = fs.readFileSync(srcFile, 'utf8');

  const hasImport = SDK_IMPORT.test(code);
  const serveCount = (code.match(/Deno\.serve\s*\(/g) || []).length;

  if (hasImport) {
    code = code.replace(SDK_IMPORT,
      `import {$1} from "../../sdk/mod.ts";\nimport { __handler } from "../../sdk/runtime.ts";`);
  } else {
    // No SDK import (rare) — still add runtime for the handler swap.
    code = `import { __handler } from "../../sdk/runtime.ts";\n` + code;
  }

  if (serveCount === 1) {
    code = code.replace(/Deno\.serve\s*\(/, 'export default __handler(');
  } else {
    flags.push(`${d} (Deno.serve x${serveCount})`);
  }

  const outDir = path.join(DEST, d);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'entry.ts'), code);
  converted++;
}

// Emit a manifest of all function names for the router.
fs.writeFileSync(path.join(DEST, '_manifest.json'), JSON.stringify(dirs.sort(), null, 2));

console.log(`Converted ${converted} functions → ${DEST}`);
console.log(`Manifest: ${dirs.length} function names written to _manifest.json`);
if (flags.length) {
  console.log(`\n⚠ ${flags.length} need manual review (not exactly one Deno.serve):`);
  flags.slice(0, 30).forEach(f => console.log('  - ' + f));
}
```

## `backend/tools/gen-agents.mjs`
```js
#!/usr/bin/env node
// Convert Base44 agent .jsonc files into a runtime registry (agents-runtime/agents.json).
import fs from 'node:fs'; import path from 'node:path';
const [,, DIR, OUT] = process.argv;
function strip(s){let o="",inS=false,ch="";for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if(inS){o+=c;if(c=="\\"){o+=s[++i]||"";continue}if(c==ch)inS=false;continue}if(c=='"'||c=="'"){inS=true;ch=c;o+=c;continue}if(c=="/"&&n=="/"){while(i<s.length&&s[i]!="\n")i++;o+="\n";continue}if(c=="/"&&n=="*"){i+=2;while(i<s.length&&!(s[i]=="*"&&s[i+1]=="/"))i++;i++;continue}o+=c}return o}
const out = {};
let n = 0;
for (const f of fs.readdirSync(DIR).filter(x=>x.endsWith('.jsonc')||x.endsWith('.json'))) {
  let d; try { d = JSON.parse(strip(fs.readFileSync(path.join(DIR,f),'utf8'))); } catch { continue; }
  const name = d.name || f.replace(/\.jsonc?$/,'');
  out[name] = {
    description: d.description || '',
    instructions: d.instructions || '',
    model: d.model || null,
    tools: (d.tool_configs || []).map(t => ({ entity: t.entity_name, ops: t.allowed_operations || ['read'] })),
  };
  n++;
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Wrote ${n} agents → ${OUT}`);
```

## `backend/tools/rls-audit.mjs`
```js
#!/usr/bin/env node
/**
 * Row-Level-Security audit. Classifies each entity as user-scoped (reads must be
 * limited to the owner) vs global (shared/admin data), by inspecting entity property
 * names and how backend functions filter them. Emits db/rls-policy.json which the
 * entity routes enforce for the user-facing client.
 * Usage: node tools/rls-audit.mjs <repo_root> <out.json>
 */
import fs from 'node:fs'; import path from 'node:path';
const [,, ROOT, OUT] = process.argv;
const ENT = path.join(ROOT, 'base44/entities');
const FUN = path.join(ROOT, 'base44/functions');

function strip(s){let o="",inS=false,ch="";for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if(inS){o+=c;if(c=="\\"){o+=s[++i]||"";continue}if(c==ch)inS=false;continue}if(c=='"'||c=="'"){inS=true;ch=c;o+=c;continue}if(c=="/"&&n=="/"){while(i<s.length&&s[i]!="\n")i++;o+="\n";continue}if(c=="/"&&n=="*"){i+=2;while(i<s.length&&!(s[i]=="*"&&s[i+1]=="/"))i++;i++;continue}o+=c}return o}

const OWNER_FIELDS = ['user_id','owner_id','owner_user_id','referrer_user_id','recipient_user_id','account_user_id','user_email','created_by'];
// Read all function source once for filter-pattern scanning.
let funcSrc = '';
for (const d of fs.readdirSync(FUN)) { const f = path.join(FUN, d, 'entry.ts'); if (fs.existsSync(f)) funcSrc += '\n' + fs.readFileSync(f,'utf8'); }

const entities = fs.readdirSync(ENT).filter(f=>f.endsWith('.jsonc')||f.endsWith('.json'));
const policy = {}; const summary = { user_scoped: [], global: [] };

for (const file of entities.sort()) {
  let def; try { def = JSON.parse(strip(fs.readFileSync(path.join(ENT,file),'utf8'))); } catch { continue; }
  const name = def.name || file.replace(/\.jsonc?$/,'');
  const props = Object.keys(def.properties || {});
  const ownerField = OWNER_FIELDS.find(f => props.includes(f));
  // Does code filter this entity by an owner field?
  const filteredByUser = new RegExp(`entities\\.${name}\\.filter\\(\\s*\\{[^}]*(user_id|created_by|user_email|referrer_user_id)`,'m').test(funcSrc);
  const isUser = name === 'User';
  const scoped = !!ownerField || filteredByUser;
  if (isUser) {
    policy[name] = { scope: 'self', owner_field: 'id' };
    summary.user_scoped.push(`${name} (self)`);
  } else if (scoped) {
    const of = ownerField || 'user_id';
    policy[name] = { scope: 'owner', owner_field: of };
    summary.user_scoped.push(`${name} (${of})`);
  } else {
    policy[name] = { scope: 'global' };
    summary.global.push(name);
  }
}

fs.writeFileSync(OUT, JSON.stringify(policy, null, 2));
console.log(`RLS policy → ${OUT}`);
console.log(`  user-scoped: ${summary.user_scoped.length}`);
console.log(`  global:      ${summary.global.length}`);
console.log('\n  Sample user-scoped:', summary.user_scoped.slice(0,18).join(', '));
```

## `backend/tools/import-to-postgres.mjs`
```js
#!/usr/bin/env node
/**
 * Phase 4 — import exported JSONL into Postgres, mapping each document to system
 * columns + JSONB `data` exactly like the SDK's docToColumns (so reads flatten back).
 *
 * Modes:
 *   node tools/import-to-postgres.mjs ./export           # direct insert (needs `pg` + DATABASE_URL)
 *   node tools/import-to-postgres.mjs ./export --emit-sql # print SQL to stdout (pipe to psql)
 *
 * Preserves id, created_date, created_by, and (for User) email/role/password_hash.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const DIR = process.argv[2] || './export';
const EMIT = process.argv.includes('--emit-sql');
const entities = JSON.parse(fs.readFileSync(new URL('../db/entities.json', import.meta.url)));

const SYS = { _default: ['id', 'created_date', 'updated_date', 'created_by'], User: ['id', 'created_date', 'updated_date', 'created_by', 'email', 'password_hash', 'role'] };
const sysCols = (e) => SYS[e] || SYS._default;
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const lit = (v) => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

function toRow(entity, doc) {
  const sys = new Set(sysCols(entity));
  const cols = {}; const data = {};
  for (const [k, v] of Object.entries(doc)) {
    // Base44 returns created_date/id at top level; route them to columns.
    if (sys.has(k)) cols[k] = v; else if (!['created_by_id'].includes(k)) data[k] = v;
  }
  return { cols, data };
}

function insertSql(entity, doc) {
  const { cols, data } = toRow(entity, doc);
  const names = Object.keys(cols).filter((c) => cols[c] !== undefined);
  const colList = names.map(q).concat('data');
  const valList = names.map((c) => c === 'created_date' || c === 'updated_date' ? lit(cols[c]) + '::timestamptz' : lit(cols[c]))
    .concat(`'${JSON.stringify(data).replace(/'/g, "''")}'::jsonb`);
  return `INSERT INTO ${q(entity)} (${colList.join(',')}) VALUES (${valList.join(',')}) ON CONFLICT (id) DO NOTHING;`;
}

async function processEntity(entity, sink) {
  const file = path.join(DIR, `${entity}.jsonl`);
  if (!fs.existsSync(file)) return 0;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) { if (!line.trim()) continue; const doc = JSON.parse(line); await sink(insertSql(entity, doc)); n++; }
  return n;
}

if (EMIT) {
  process.stdout.write('BEGIN;\n');
  let total = 0;
  for (const e of entities) { total += await processEntity(e, (sql) => process.stdout.write(sql + '\n')); }
  process.stdout.write('COMMIT;\n');
  process.stderr.write(`Emitted SQL for ${total} rows across ${entities.length} entities\n`);
} else {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let total = 0;
  for (const e of entities) {
    const n = await processEntity(e, async (sql) => { await client.query(sql); });
    if (n) console.log(`${e}: ${n}`);
    total += n;
  }
  await client.end();
  console.log(`\nImported ${total} rows.`);
}
```

## `backend/tools/export-from-base44.mjs`
```js
#!/usr/bin/env node
/**
 * Phase 4 — export every Base44 entity's rows to JSONL for import into Postgres.
 * Runs in YOUR environment (where `npm i @base44/sdk` works and you have a token).
 *
 * Usage:
 *   BASE44_APP_ID=... BASE44_TOKEN=... BASE44_BASE_URL=https://your-app.base44.app \
 *     node tools/export-from-base44.mjs ./export
 *
 * Writes ./export/<Entity>.jsonl (one JSON document per line) + ./export/_counts.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@base44/sdk';

const OUT = process.argv[2] || './export';
fs.mkdirSync(OUT, { recursive: true });
const entities = JSON.parse(fs.readFileSync(new URL('../db/entities.json', import.meta.url)));

const base44 = createClient({
  appId: process.env.BASE44_APP_ID,
  token: process.env.BASE44_TOKEN,
  appBaseUrl: process.env.BASE44_BASE_URL,
  requiresAuth: true,
});

const PAGE = Number(process.env.EXPORT_PAGE_SIZE || 500);
const counts = {};

for (const name of entities) {
  const client = base44.asServiceRole?.entities?.[name] || base44.entities[name];
  if (!client) { console.warn(`skip ${name}: no client`); continue; }
  const fh = fs.createWriteStream(path.join(OUT, `${name}.jsonl`));
  let total = 0, page = 0;
  try {
    // Base44 list supports pagination via (sort, limit, offset)-style calls; fall back to list().
    // If your SDK version differs, adjust here.
    while (true) {
      let rows;
      try { rows = await client.list('-created_date', PAGE, page * PAGE); }
      catch { rows = await client.list(); }
      if (!rows || rows.length === 0) break;
      for (const r of rows) { fh.write(JSON.stringify(r) + '\n'); total++; }
      if (rows.length < PAGE) break;
      page++;
      if (page > 100000) break; // safety
    }
  } catch (e) { console.error(`error exporting ${name}: ${e.message}`); }
  fh.end();
  counts[name] = total;
  console.log(`${name}: ${total}`);
}
fs.writeFileSync(path.join(OUT, '_counts.json'), JSON.stringify(counts, null, 2));
console.log(`\nDone. ${Object.keys(counts).length} entities → ${OUT}`);
```

## `backend/tools/shadow-compare.mjs`
```js
#!/usr/bin/env node
/**
 * Phase 4 — shadow-compare: verify the migrated Postgres matches the Base44 export.
 * Compares per-entity row counts (export/_counts.json vs live Postgres) and flags drift.
 * Optionally samples N rows/entity and checks they exist by id in Postgres.
 *
 * Usage: DATABASE_URL=... node tools/shadow-compare.mjs ./export [--sample 5]
 * Needs `pg`.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const DIR = process.argv[2] || './export';
const sampleIdx = process.argv.indexOf('--sample');
const SAMPLE = sampleIdx > -1 ? Number(process.argv[sampleIdx + 1] || 5) : 0;
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

const counts = JSON.parse(fs.readFileSync(path.join(DIR, '_counts.json')));
const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let okCount = 0, mismatch = 0, sampleFail = 0;
const rows = [];
for (const [entity, expected] of Object.entries(counts)) {
  let actual = 0;
  try { actual = Number((await client.query(`SELECT count(*)::int AS c FROM ${q(entity)}`)).rows[0].c); }
  catch (e) { rows.push(`  ! ${entity}: table error (${e.message})`); mismatch++; continue; }
  const ok = actual === expected;
  ok ? okCount++ : mismatch++;
  if (!ok) rows.push(`  ✗ ${entity}: export=${expected} postgres=${actual} (Δ${actual - expected})`);

  if (SAMPLE && fs.existsSync(path.join(DIR, `${entity}.jsonl`))) {
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(DIR, `${entity}.jsonl`)), crlfDelay: Infinity });
    let seen = 0;
    for await (const line of rl) {
      if (seen >= SAMPLE) { rl.close(); break; }
      const doc = JSON.parse(line); seen++;
      const r = await client.query(`SELECT 1 FROM ${q(entity)} WHERE id = $1`, [doc.id]);
      if (!r.rowCount) { rows.push(`  ✗ ${entity}: sample id ${doc.id} missing in postgres`); sampleFail++; }
    }
  }
}
await client.end();

console.log(`\nShadow compare — ${DIR}\n`);
console.log(rows.length ? rows.join('\n') : '  (all entities match)');
console.log(`\n${okCount} matched, ${mismatch} count mismatches, ${sampleFail} sample misses\n`);
process.exit(mismatch || sampleFail ? 1 : 0);
```

## `backend/tools/smoke-test.ts`
```js
// Smoke-test the running Nexus backend end-to-end. Run AFTER `docker compose up` and
// after loading db/schema.sql + db/seed.sql:
//   deno run --allow-net --allow-env tools/smoke-test.ts
// Optionally set BASE=http://localhost:8000
const BASE = Deno.env.get("BASE") ?? "http://localhost:8000";
let pass = 0, fail = 0;
const results: string[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); pass++; results.push(`  ✓ ${name}`); }
  catch (e) { fail++; results.push(`  ✗ ${name} — ${(e as Error).message}`); }
}
function assert(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }

async function j(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, { headers: { "content-type": "application/json", ...(opts.headers ?? {}) }, ...opts });
  const t = await r.text(); let d; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: r.status, data: d };
}

let token = "";

await check("health", async () => {
  const r = await j("/health");
  assert(r.status === 200 && r.data?.ok, "health not ok");
  assert(r.data.functions > 0, "no functions loaded");
});

await check("auth: login admin", async () => {
  const r = await j("/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@nexus.local", password: "admin1234" }) });
  assert(r.status === 200 && r.data?.token, "no token returned");
  token = r.data.token;
});

await check("auth: me", async () => {
  const r = await j("/auth/me", { headers: { authorization: `Bearer ${token}` } });
  assert(r.status === 200 && r.data?.email === "admin@nexus.local", "me mismatch");
  assert(r.data.role === "admin", "role not admin");
});

await check("auth: signup (or login if exists) a test user", async () => {
  const creds = { email: "smoke-user@nexus.local", password: "smokepass123", full_name: "Smoke User" };
  let r = await j("/auth/signup", { method: "POST", body: JSON.stringify(creds) });
  if (r.status === 409) {
    r = await j("/auth/login", { method: "POST", body: JSON.stringify({ email: creds.email, password: creds.password }) });
  }
  assert(r.status === 200 && r.data?.token, "signup/login returned no token");
  assert(r.data?.user?.email === creds.email, "user email mismatch");
});

await check("auth: request-reset returns generic success (no account enumeration)", async () => {
  const known = await j("/auth/request-reset", { method: "POST", body: JSON.stringify({ email: "smoke-user@nexus.local" }) });
  assert(known.status === 200 && known.data?.success, "known email did not return success");
  const unknown = await j("/auth/request-reset", { method: "POST", body: JSON.stringify({ email: "does-not-exist@nexus.local" }) });
  assert(unknown.status === 200 && unknown.data?.success, "unknown email should return the same success (no leak)");
  // NOTE: the real reset token is emailed (only its hash is stored), so the full happy-path
  // reset can't be checked over HTTP alone. To verify end-to-end, use a dev email inbox
  // (e.g. Mailhog) to capture the link, then POST /auth/reset-password with that token.
});

await check("auth: reset-password rejects an invalid token", async () => {
  const r = await j("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email: "smoke-user@nexus.local", token: "definitely-not-valid", new_password: "brandnew123" }),
  });
  assert(r.status === 400, `expected 400, got ${r.status}`);
});

await check("auth: google rejects missing and bogus tokens", async () => {
  const missing = await j("/auth/google", { method: "POST", body: JSON.stringify({}) });
  assert(missing.status === 400, `missing id_token: expected 400, got ${missing.status}`);
  const bogus = await j("/auth/google", { method: "POST", body: JSON.stringify({ id_token: "bogus.jwt.value" }) });
  assert(bogus.status === 401, `bogus id_token: expected 401, got ${bogus.status}`);
});

await check("analytics: record an event", async () => {
  const r = await j("/analytics", { method: "POST", body: JSON.stringify({ type: "track", event: "smoke_event" }) });
  assert(r.status === 200 && r.data?.ok, "analytics event not recorded");
});

await check("agents: create conversation + add message", async () => {
  const c = await j("/agents/conversations", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ agent_name: "ab_test_optimizer" }) });
  assert(c.status === 200 && c.data?.id, "conversation not created");
  const list = await j(`/agents/conversations/${c.data.id}/messages`, { method: "GET", headers: { authorization: `Bearer ${token}` } });
  assert(Array.isArray(list.data), "messages list not an array");
});

await check("entities: filter seeded SurveyABTest", async () => {
  const r = await j("/entities/SurveyABTest/filter", { method: "POST", body: JSON.stringify({ query: { status: "active" } }) });
  assert(Array.isArray(r.data), "filter did not return an array");
  assert(r.data.some((x: Record<string, unknown>) => x.id === "abtest-seed-1"), "seeded test not found");
});

await check("entities: create + read-back roundtrip", async () => {
  const created = await j("/entities/UserActivity/create", {
    method: "POST", headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { action: "smoke_test", value: 42 } }),
  });
  assert(created.status === 200 && created.data?.id, "create failed");
  const back = await j("/entities/UserActivity/get", { method: "POST", body: JSON.stringify({ id: created.data.id }) });
  assert(back.data?.value === 42, "roundtrip value mismatch");
});

await check("functions: invoke abTestAssigner (assign)", async () => {
  const r = await j("/functions/abTestAssigner", {
    method: "POST", headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "assign", test_id: "abtest-seed-1", user_id: "smoke-user" }),
  });
  assert(r.status === 200, `status ${r.status}`);
  assert(r.data?.variant === "a" || r.data?.variant === "b", "no variant returned");
});

// Optional: only runs if an LLM key is configured on the backend.
await check("integrations: InvokeLLM (optional)", async () => {
  const r = await j("/integrations/InvokeLLM", { method: "POST", body: JSON.stringify({ prompt: "Reply with the single word: ok" }) });
  if (r.status === 500 && String(r.data?.error ?? "").match(/key|OPENAI|ANTHROPIC/i)) { results.push("    (skipped — no LLM key set)"); return; }
  assert(r.status === 200, `status ${r.status}`);
});

console.log(`\nNexus backend smoke test — ${BASE}\n`);
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed\n`);
Deno.exit(fail ? 1 : 0);
```
# ===== FRONTEND: CLIENT + AUTH (brand-matched) =====

## `src/api/base44Client.js`
```js
// Self-hosted API client — replaces the Base44 SDK. Exposes the same `base44` object
// (entities, auth, functions, integrations) the app already uses, so no call sites change.
// Points at the Nexus backend via VITE_NEXUS_API_URL.
const API = (import.meta.env?.VITE_NEXUS_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'nexus_token';

const getToken = () => (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
const setToken = (t) => { if (typeof localStorage !== 'undefined') { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } };

async function api(path, { method = 'POST', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

// ---- entities: base44.entities.<Name>.<op>(...) ----
const entities = new Proxy({}, {
  get(_t, name) {
    const base = `/entities/${String(name)}`;
    return {
      filter: (query = {}, sort, limit) => api(`${base}/filter`, { body: { query, sort, limit } }),
      list: (sort, limit) => api(`${base}/list`, { body: { sort, limit } }),
      get: (id) => api(`${base}/get`, { body: { id } }),
      create: (data) => api(`${base}/create`, { body: { data } }),
      update: (id, data) => api(`${base}/update`, { body: { id, data } }),
      delete: (id) => api(`${base}/delete`, { body: { id } }),
      bulkCreate: (docs) => api(`${base}/bulkCreate`, { body: { docs } }),
      // Realtime .subscribe() → polling fallback (Base44 used websockets).
      subscribe: (arg1, arg2) => {
        const query = typeof arg1 === 'function' ? {} : (arg1 || {});
        const cb = typeof arg1 === 'function' ? arg1 : arg2;
        const intervalMs = Number(import.meta.env?.VITE_NEXUS_POLL_MS || 8000);
        let stop = false;
        const tick = async () => { if (stop) return; try { cb?.(await api(`${base}/filter`, { body: { query } })); } catch { /* ignore */ } };
        tick();
        const h = setInterval(tick, intervalMs);
        return () => { stop = true; clearInterval(h); };
      },
    };
  },
});

// ---- auth: base44.auth.<op>(...) ----
const auth = {
  async me() { return api('/auth/me', { method: 'GET' }); },
  async updateMe(data) { return api('/auth/updateMe', { body: data }); },
  async login(email, password) { const r = await api('/auth/login', { body: { email, password } }); setToken(r.token); return r.user; },
  async signup(email, password, full_name) { const r = await api('/auth/signup', { body: { email, password, full_name } }); setToken(r.token); return r.user; },
  async requestPasswordReset(email) { return api('/auth/request-reset', { body: { email } }); },
  async resetPassword(email, token, new_password) { const r = await api('/auth/reset-password', { body: { email, token, new_password } }); if (r?.token) setToken(r.token); return r; },
  async googleLogin(idToken) { const r = await api('/auth/google', { body: { id_token: idToken } }); setToken(r.token); return r.user; },
  logout(_returnUrl) {
    setToken(null);
    if (typeof window !== 'undefined') window.location.href = (import.meta.env?.VITE_LOGIN_URL || '/login');
  },
  redirectToLogin(returnUrl) {
    if (typeof window !== 'undefined') {
      const url = import.meta.env?.VITE_LOGIN_URL || '/login';
      const back = returnUrl || window.location.href;
      window.location.href = `${url}?redirect=${encodeURIComponent(back)}`;
    }
  },
  async isAuthenticated() { try { await auth.me(); return true; } catch { return false; } },
  setToken, getToken,
};

// ---- functions: base44.functions.invoke(name, payload) ----
// Base44 returned an axios-style response, so existing code reads `response.data.<field>`
// and relies on a throw for non-2xx. We reproduce that shape exactly for 1:1 compatibility.
const functions = {
  async invoke(name, payload = {}) {
    const headers = { 'content-type': 'application/json' };
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${API}/functions/${name}`, { method: 'POST', headers, body: payload != null ? JSON.stringify(payload) : undefined });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      throw Object.assign(new Error((data && data.error) || `HTTP ${res.status}`),
        { status: res.status, data, response: { data, status: res.status } });
    }
    return { data, status: res.status };   // consumers read response.data.<field>
  },
};

// ---- integrations: base44.integrations.Core.<op>(...) ----
const Core = {
  async InvokeLLM(args) { const r = await api('/integrations/InvokeLLM', { body: args }); return r?.result ?? r; },
  async SendEmail(args) { return api('/integrations/SendEmail', { body: args }); },
  async GenerateImage(args) { return api('/integrations/GenerateImage', { body: args }); },
  async GenerateSpeech(args) { return api('/integrations/GenerateSpeech', { body: args }); },
  // Preserves Base44's one-call UploadFile({ file }) → { file_url }: requests a presigned
  // S3 URL from the backend, PUTs the bytes, and returns the public URL. Also accepts
  // { filename } to just get URLs.
  async UploadFile(args = {}) {
    const file = args.file;
    const filename = args.filename || file?.name || 'file.bin';
    const urls = await api('/integrations/UploadFile', { body: { filename } });
    if (file && urls?.upload_url) {
      await fetch(urls.upload_url, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
      return { file_url: urls.file_url };
    }
    return urls;
  },
};

// ---- analytics: base44.analytics.track(event) ----
const analytics = {
  async track(event) { try { return await api('/analytics', { body: { type: 'track', ...event } }); } catch { return { ok: false }; } },
  async page(props) { try { return await api('/analytics', { body: { type: 'page', ...props } }); } catch { return { ok: false }; } },
  async identify(props) { try { return await api('/analytics', { body: { type: 'identify', ...props } }); } catch { return { ok: false }; } },
};

// ---- agents: in-app AI agent conversations (persisted; assistant replies via the runtime) ----
const agents = {
  createConversation: ({ agent_name, metadata } = {}) => api('/agents/conversations', { body: { agent_name, metadata } }),
  addMessage: (conversation, message) => {
    const convId = conversation?.id || conversation;
    return api(`/agents/conversations/${convId}/messages`, { body: message });
  },
  getMessages: (convId) => api(`/agents/conversations/${convId}/messages`, { method: 'GET' }),
  listConversations: (agent_name) => api('/agents/conversations/list', { body: { agent_name } }),
  // WhatsApp/Telegram channels aren't wired in self-hosted — returns unavailable rather than crashing.
  async getWhatsAppConnectURL() { return { url: null, available: false }; },
  // Polling-based realtime (Base44 used websockets). Calls back with the message list.
  subscribeToConversation: (convId, cb) => {
    const intervalMs = Number(import.meta.env?.VITE_NEXUS_POLL_MS || 4000);
    let stop = false;
    const tick = async () => { if (stop) return; try { cb?.(await api(`/agents/conversations/${convId}/messages`, { method: 'GET' })); } catch { /* ignore */ } };
    tick();
    const h = setInterval(tick, intervalMs);
    return () => { stop = true; clearInterval(h); };
  },
};

// ---- users (admin) ----
const users = {
  inviteUser: (email, opts = {}) => api('/auth/invite', { body: { email, ...opts } }),
  list: (sort, limit) => api('/entities/User/list', { body: { sort, limit } }),
};

// ---- connectors: Base44 app-user connectors → graceful no-op in self-hosted ----
const connectors = {
  async connectAppUser() { return { connected: false, reason: 'connectors are not configured in the self-hosted build' }; },
};

// ---- appLogs: in-app user logging ----
const appLogs = {
  logUserInApp: (entry) => api('/applogs', { body: entry }).catch(() => ({ ok: false })),
};

// ---- asServiceRole: on the frontend this routes through the authenticated user's own
// permissions (the browser can't hold real service-role rights). Server-side RLS still applies. ----
const asServiceRole = { entities, integrations: { Core }, functions };

export const base44 = { entities, auth, functions, integrations: { Core }, analytics, agents, users, connectors, appLogs, asServiceRole };
export default base44;
```

## `src/lib/AuthContext.jsx`
```jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Self-hosted auth context. Replaces the Base44 app-public-settings / axios-client flow
// with simple token-based auth against the Nexus backend: if a token is present we load
// the current user via base44.auth.me(); otherwise the user is unauthenticated.
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  // Kept for compatibility with consumers that read appPublicSettings; self-hosted has no
  // Base44 "app settings" — expose a minimal object (extend via a backend endpoint if needed).
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'playearning-nexus', public_settings: {} });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings({ id: 'playearning-nexus', public_settings: {} });
      setIsLoadingPublicSettings(false);

      const hasToken = !!base44.auth.getToken?.();
      if (hasToken) {
        await checkUserAuth();
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);

      if (currentUser && !currentUser.social_media_connected) {
        sessionStorage.setItem('needs_social_setup', 'true');
      }
      if (currentUser && (!currentUser.full_name || currentUser.full_name.trim() === '')) {
        sessionStorage.setItem('needs_profile_completion', 'true');
      } else {
        sessionStorage.removeItem('needs_profile_completion');
      }

      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      if (error.status === 401 || error.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

## `src/components/auth/AuthForm.jsx`
```jsx
import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import GamerGainLogo from '@/components/branding/GamerGainLogo';

// Self-hosted login/signup form, styled to match the GamerGain app design system
// (green logo/wordmark, red CTA, red-50/white background). Replaces Base44's hosted screen.
// mode: 'login' | 'signup'. On success, stores the JWT and navigates to ?redirect= (or home).
export default function AuthForm({ mode = 'login' }) {
  const isSignup = mode === 'signup';
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const auth = (() => { try { return useAuth(); } catch { return null; } })();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = params.get('redirect') || '/';

  const finishAuth = async () => {
    try { await auth?.checkAppState?.(); } catch { /* non-fatal */ }
    if (redirectTo.startsWith('http')) window.location.href = redirectTo;
    else navigate(redirectTo, { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (isSignup && password !== confirm) { setError('Passwords do not match.'); return; }
    if (isSignup && password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      if (isSignup) await base44.auth.signup(email, password, fullName);
      else await base44.auth.login(email, password);
      await finishAuth();
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <GamerGainLogo className="w-12 h-12" />
            <span className="text-3xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent">GamerGain</span>
          </div>
          <p className="text-gray-500 text-sm">{isSignup ? 'Create your account' : 'Sign in to your account'}</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
          )}

          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Your name" autoComplete="name" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="you@example.com" autoComplete="email" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} placeholder="••••••••" autoComplete={isSignup ? 'new-password' : 'current-password'} />
          </div>

          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputClass} placeholder="••••••••" autoComplete="new-password" />
            </div>
          )}

          {!isSignup && (
            <div className="text-right -mt-1">
              <Link to="/forgot-password" className="text-xs text-red-600 hover:underline">Forgot password?</Link>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-2.5 shadow-lg hover:from-red-700 hover:to-red-800 disabled:opacity-60 transition">
            {loading ? 'Please wait…' : (isSignup ? 'Create account' : 'Sign in')}
          </button>

          {/* Sign in with Google (renders only when VITE_GOOGLE_CLIENT_ID is set) */}
          <div className="pt-1">
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">or</span></div>
            </div>
            <GoogleSignInButton onSuccess={finishAuth} onError={(m) => setError(m)} />
          </div>

          <div className="text-center text-sm text-gray-500 pt-1">
            {isSignup ? (
              <>Already have an account? <Link to="/login" className="text-red-600 font-medium hover:underline">Sign in</Link></>
            ) : (
              <>New here? <Link to="/signup" className="text-red-600 font-medium hover:underline">Create an account</Link></>
            )}
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          The premium game discovery platform. By continuing you agree to our{' '}
          <Link to="/TermsOfService" className="hover:underline">Terms</Link> and{' '}
          <Link to="/PrivacyPolicy" className="hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
```

## `src/components/auth/GoogleSignInButton.jsx`
```jsx
import React, { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// Renders Google Identity Services "Sign in with Google". Requires VITE_GOOGLE_CLIENT_ID.
// On credential, exchanges the Google ID token for our JWT via base44.auth.googleLogin,
// then calls onSuccess (usually navigate to the redirect target).
export default function GoogleSignInButton({ onSuccess, onError }) {
  const ref = useRef(null);
  const clientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return; // silently hidden when not configured
    const SCRIPT = 'https://accounts.google.com/gsi/client';

    const handleCredential = async (response) => {
      try {
        await base44.auth.googleLogin(response.credential);
        onSuccess?.();
      } catch (e) {
        onError?.(e?.data?.error || e?.message || 'Google sign-in failed');
      }
    };

    const init = () => {
      if (!window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
    };

    if (window.google?.accounts?.id) { init(); return; }
    let script = document.querySelector(`script[src="${SCRIPT}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT; script.async = true; script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', init);
    return () => script?.removeEventListener('load', init);
  }, [clientId]);

  if (!clientId) return null;
  return <div className="flex justify-center"><div ref={ref} /></div>;
}
```

## `src/pages/Login.jsx`
```jsx
import React from 'react';
import AuthForm from '@/components/auth/AuthForm';

export default function Login() {
  return <AuthForm mode="login" />;
}
```

## `src/pages/Signup.jsx`
```jsx
import React from 'react';
import AuthForm from '@/components/auth/AuthForm';

export default function Signup() {
  return <AuthForm mode="signup" />;
}
```

## `src/pages/ForgotPassword.jsx`
```jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import GamerGainLogo from '@/components/branding/GamerGainLogo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await base44.auth.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <GamerGainLogo className="w-12 h-12" />
            <span className="text-3xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent">GamerGain</span>
          </div>
          <p className="text-gray-500 text-sm">Reset your password — we'll email you a link.</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-green-600 text-4xl">✓</div>
              <p className="text-gray-700">If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox.</p>
              <Link to="/login" className="inline-block text-red-600 font-medium hover:underline">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="you@example.com" autoComplete="email" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-2.5 shadow-lg hover:from-red-700 hover:to-red-800 disabled:opacity-60 transition">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <div className="text-center text-sm text-gray-500">
                <Link to="/login" className="text-red-600 font-medium hover:underline">Back to sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

## `src/pages/ResetPassword.jsx`
```jsx
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import GamerGainLogo from '@/components/branding/GamerGainLogo';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !token || !email;
  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500";

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await base44.auth.resetPassword(email, token, password);
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Reset failed. The link may have expired.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <GamerGainLogo className="w-12 h-12" />
            <span className="text-3xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent">GamerGain</span>
          </div>
          <p className="text-gray-500 text-sm">Choose a new password{email ? ` for ${email}` : ''}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          {invalidLink ? (
            <div className="text-center space-y-3">
              <p className="text-gray-700">This reset link is missing information. Please request a new one.</p>
              <Link to="/forgot-password" className="inline-block text-red-600 font-medium hover:underline">Request a new link</Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-2">
              <div className="text-green-600 text-4xl">✓</div>
              <p className="text-gray-700">Password updated. Signing you in…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputClass} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-2.5 shadow-lg hover:from-red-700 hover:to-red-800 disabled:opacity-60 transition">
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

## `src/components/branding/GamerGainLogo.jsx`
```jsx
import React from 'react';

export default function GamerGainLogo({ className = "w-10 h-10" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dollarGreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#85bb65', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#6b9b4f', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="whiteGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#f0f0f0', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {/* Background Circle */}
      <circle cx="50" cy="50" r="48" fill="url(#dollarGreen)" />
      
      {/* Abstract Modern "G" */}
      <path
        d="M 50 20 C 35 20, 25 30, 25 45 C 25 60, 35 70, 50 70 L 65 70 L 65 55 L 45 55 L 45 50 L 70 50 L 70 75 L 50 75 C 32 75, 20 63, 20 45 C 20 27, 32 15, 50 15 C 65 15, 75 23, 78 35 L 72 37 C 70 27, 61 20, 50 20 Z"
        fill="url(#whiteGlow)"
        stroke="#ffffff"
        strokeWidth="1.5"
      />
      
      {/* Dynamic Tech Lines */}
      <path
        d="M 55 35 L 75 35"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M 60 42 L 75 42"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}```

## `vite.config.js`
```js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  plugins: [
    react(),
  ]
});
```

## `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- GamerGain favicons -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <link rel="manifest" href="/manifest.json" />
    <!-- PWA / mobile app meta -->
    <meta name="theme-color" content="#111827" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="PlayEarning" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <title>PlayEarning Nexus</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

## `.env.example`
```bash
# Frontend (Vite) — self-hosted config. No Base44 values needed anymore.
VITE_NEXUS_API_URL=http://localhost:8000     # your deployed backend URL in production
VITE_LOGIN_URL=/login
VITE_NEXUS_POLL_MS=8000                       # polling interval for entity .subscribe() fallback
VITE_GOOGLE_CLIENT_ID=                         # enables "Sign in with Google" (optional)
```
