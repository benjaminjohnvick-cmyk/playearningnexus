// Nexus backend entrypoint (Deno). Mounts all converted functions as HTTP routes and
// registers them for in-process functions.invoke(). Run: deno run --allow-net --allow-env --allow-read server/main.ts
import { functionRegistry } from "../sdk/mod.ts";
import { authRoutes } from "./auth-routes.ts";
import { entityRoutes } from "./entity-routes.ts";
import { integrationRoutes } from "./integration-routes.ts";
import { runAgent, listAgents } from "../agents-runtime/agent-runtime.ts";
import { extraRoutes } from "./extra-routes.ts";
import { autoMigrate } from "./migrate.ts";
import { frontendEnabled, serveStatic } from "./static.ts";
import { primeSettings, snapBool } from "../sdk/settings.ts";
import { verifyJwt } from "../sdk/auth.ts";
import { db } from "../sdk/db.ts";

// True only for a request bearing a valid admin bearer token (used for the maintenance-mode bypass).
async function requesterIsAdmin(req: Request): Promise<boolean> {
  try {
    const authz = req.headers.get("authorization") ?? "";
    const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : null;
    if (!token) return false;
    const payload = await verifyJwt(token);
    if (!payload?.sub) return false;
    const u = await db.get("User", payload.sub);
    return (u as Record<string, unknown> | null)?.role === "admin";
  } catch { return false; }
}

// Ensure the DB schema exists before serving (idempotent; skip with AUTO_MIGRATE=0).
await autoMigrate();

// Optional: run the cron scheduler inside this same process (one service instead of two).
// Needs --unstable-cron in the start command and BACKEND_URL pointing at this server.
if ((Deno.env.get("SCHEDULER_INLINE") ?? "0") === "1") {
  try { await import("../scheduler/main.ts"); console.log("[scheduler] running inline in the web process"); }
  catch (e) { console.warn("[scheduler] inline start failed (needs --unstable-cron):", (e as Error).message); }
}

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
  if (url.pathname === "/health") return Response.json({ ok: true, functions: loaded, agents: listAgents().length, frontend: frontendEnabled(), scheduler_inline: (Deno.env.get("SCHEDULER_INLINE") ?? "0") === "1" });

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

  // Maintenance mode: when ON, only admins may reach data / function / integration routes. Auth,
  // health, static, and OPTIONS stay open so the login page and status still load.
  if (url.pathname.startsWith("/entities/") || url.pathname.startsWith("/functions/") || url.pathname.startsWith("/integrations/")) {
    await primeSettings().catch(() => {});
    if (snapBool("MAINTENANCE_MODE", false) && !(await requesterIsAdmin(req))) {
      return Response.json({ error: "maintenance", message: "GamerGain is briefly down for maintenance. Please check back soon." }, { status: 503, headers: CORS });
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
    // Refresh the admin-settings snapshot so every function sees live DB overrides (30s-cached; cheap).
    await primeSettings().catch(() => {});
    const res = await handler(req);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }

  // Single-service mode: serve the built frontend (SPA) for any non-API GET, if FRONTEND_DIR is set.
  if (frontendEnabled() && req.method === "GET") {
    const res = await serveStatic(url.pathname);
    if (res) return res;
  }

  return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
});
console.log(`Nexus backend listening on :${PORT}${frontendEnabled() ? " (serving frontend + API on one origin)" : ""}`);
