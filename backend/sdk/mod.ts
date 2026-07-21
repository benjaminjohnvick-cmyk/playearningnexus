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
