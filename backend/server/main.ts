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
