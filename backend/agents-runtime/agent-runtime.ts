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
