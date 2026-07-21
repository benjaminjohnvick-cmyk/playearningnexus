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
