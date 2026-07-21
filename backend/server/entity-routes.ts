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
