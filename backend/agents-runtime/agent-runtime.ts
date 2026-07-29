// Agent runtime — replaces Base44's hosted AI agents. Each agent (agents.json) has
// instructions + a set of entities it may read/write (tool_configs). We expose those as
// OpenAI function-calling tools and run a bounded tool-use loop. The agent's entity
// access is enforced to exactly its allowed operations.
//
// Route: POST /agents/:name  { message, context? }  → { reply, steps }
import { db } from "../sdk/db.ts";
import { limited, LLM_CONCURRENCY } from "../sdk/queue.ts";
import { gate, needsApproval, SENSITIVE_ENTITIES } from "../sdk/oversight.ts";
import { capsFor, costOf, logUsage, resolveModel, spentTodayUsd } from "./guardrails.ts";
import { gatherEvidence } from "../sdk/survey-evidence.ts";
import { recallLessons, recordOutcome } from "./learning.ts";
import { aiSpendCapReached, recordAiTokenSpend } from "../sdk/integrations.ts";
import { aiPaused } from "../sdk/ai-control.ts";

// Normalize a provider usage object to total (input+output) tokens for the GLOBAL spend meter.
function totalTokens(usage: unknown): number {
  const u = (usage ?? {}) as Record<string, number>;
  return (Number(u.prompt_tokens) || 0) + (Number(u.completion_tokens) || 0) +
         (Number(u.input_tokens) || 0) + (Number(u.output_tokens) || 0);
}

type AgentDef = { description: string; instructions: string; model: string | null; tools: { entity: string; ops: string[] }[] };
const registry: Record<string, AgentDef> = JSON.parse(await Deno.readTextFile(new URL("./agents.json", import.meta.url)));

// Model selection and step/cost limits are governed per-agent by guardrails.ts
// (agent-guardrails.json), replacing the old single global model + step count.

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

// --- Provider selection (Claude switch) -------------------------------------
// LLM_PROVIDER=anthropic routes every agent through Claude's Messages API instead of
// OpenAI's chat/completions. The two APIs describe tools and return tool calls in
// different shapes, so the loop below is written provider-agnostically and the two
// builders here translate to/from each provider's native format. Flip LLM_PROVIDER to
// switch cleanly — no per-agent edits needed; model pins translate via OPENAI_TO_CLAUDE.
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") ?? "openai"; // openai | anthropic

// Reversible model translation so the OpenAI model pins in agent-guardrails.json keep
// working when you flip to Claude (and flipping back restores OpenAI exactly).
const OPENAI_TO_CLAUDE: Record<string, string> = {
  "gpt-4o": Deno.env.get("CLAUDE_MODEL_LARGE") ?? "claude-3-5-sonnet-latest",
  "gpt-4o-mini": Deno.env.get("CLAUDE_MODEL_SMALL") ?? "claude-3-5-haiku-latest",
  "gpt-4-turbo": Deno.env.get("CLAUDE_MODEL_LARGE") ?? "claude-3-5-sonnet-latest",
  "gpt-4": Deno.env.get("CLAUDE_MODEL_LARGE") ?? "claude-3-5-sonnet-latest",
  "gpt-3.5-turbo": Deno.env.get("CLAUDE_MODEL_SMALL") ?? "claude-3-5-haiku-latest",
};
function providerModel(model: string): string {
  if (LLM_PROVIDER !== "anthropic") return model;
  if (model.startsWith("claude")) return model;
  return OPENAI_TO_CLAUDE[model] ?? (Deno.env.get("CLAUDE_MODEL_DEFAULT") ?? "claude-3-5-sonnet-latest");
}

// Anthropic tool specs: same tools as toolsFor() but in Claude's { name, input_schema } shape.
function anthropicToolsFor(def: AgentDef) {
  return (toolsFor(def) as { function: { name: string; description: string; parameters: unknown } }[])
    .map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
}

// One normalized turn regardless of provider.
type NormalCall = { id: string; name: string; args: Record<string, unknown> };
type NormalTurn = { assistant: Record<string, unknown>; text: string; calls: NormalCall[]; usage: unknown };

async function callModel(opts: {
  key: string; model: string; system: string; messages: Record<string, unknown>[]; tools: unknown[];
}): Promise<NormalTurn> {
  if (LLM_PROVIDER === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": opts.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: opts.model, max_tokens: 2048, system: opts.system, messages: opts.messages,
        ...(opts.tools.length ? { tools: opts.tools } : {}),
      }),
    });
    if (!r.ok) throw Object.assign(new Error(`Anthropic ${r.status}`), { status: r.status });
    const j = await r.json();
    const blocks: { type: string; text?: string; id?: string; name?: string; input?: unknown }[] = j?.content ?? [];
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    const calls: NormalCall[] = blocks.filter((b) => b.type === "tool_use")
      .map((b) => ({ id: b.id ?? "", name: b.name ?? "", args: (b.input as Record<string, unknown>) ?? {} }));
    // Anthropic usage → normalize to the {prompt_tokens, completion_tokens} shape costOf expects.
    const u = j?.usage ?? {};
    const usage = { prompt_tokens: u.input_tokens ?? 0, completion_tokens: u.output_tokens ?? 0 };
    return { assistant: { role: "assistant", content: j?.content ?? [] }, text, calls, usage };
  }

  // default: OpenAI
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${opts.key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
      ...(opts.tools.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!r.ok) throw Object.assign(new Error(`OpenAI ${r.status}`), { status: r.status });
  const j = await r.json();
  const msg = j?.choices?.[0]?.message ?? {};
  const calls: NormalCall[] = (msg.tool_calls ?? []).map((c: { id: string; function: { name: string; arguments: string } }) => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* leave empty */ }
    return { id: c.id, name: c.function.name, args };
  });
  return { assistant: msg, text: msg.content ?? "", calls, usage: j?.usage };
}

// Append tool results in each provider's native shape so the next turn sees them.
function pushToolResults(messages: Record<string, unknown>[], results: { id: string; output: unknown }[]) {
  if (LLM_PROVIDER === "anthropic") {
    messages.push({
      role: "user",
      content: results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: JSON.stringify(r.output).slice(0, 4000) })),
    });
  } else {
    for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: JSON.stringify(r.output).slice(0, 4000) });
  }
}

async function runTool(def: AgentDef, name: string, args: Record<string, unknown>, agentName = "agent") {
  const m = name.match(/^(read|create|update)_(.+)$/);
  if (!m) return { error: "unknown tool" };
  const [, op, entity] = m;
  const allowed = def.tools.find((t) => t.entity === entity);
  if (!allowed) return { error: "entity not permitted" };
  if (op === "read" && allowed.ops.includes("read")) return await db.filter(entity, (args.query as Record<string, unknown>) ?? {}, undefined, (args.limit as number) ?? 25);

  // Writes to sensitive entities (money/account/etc.) route through the human-in-the-loop
  // gate. Low-risk writes execute immediately (and are audit-logged); sensitive ones are
  // queued for approval and reported back to the agent so it doesn't assume success.
  if ((op === "create" || op === "update")) {
    const write = op === "create" ? allowed.ops.includes("create") : allowed.ops.includes("update");
    if (!write) return { error: "operation not permitted" };
    if (SENSITIVE_ENTITIES.has(entity) || needsApproval(entity)) {
      // Attach the survey signals that justify this action (AI proposes, survey data justifies).
      const data = (args.data as Record<string, unknown>) ?? {};
      const evidence = args.evidence ??
        await gatherEvidence({ userId: (data.user_id as string) ?? (args.id as string) }).catch(() => null);
      const g = await gate({
        action: entity,
        agent: agentName,
        summary: `Agent "${agentName}" requested to ${op} a ${entity} record`,
        payload: { op, entity, id: args.id ?? null, data: args.data ?? {} },
        evidence,
      });
      if (!g.proceed) {
        return { queued_for_approval: true, review_id: g.reviewId, note: `This ${entity} ${op} needs human approval and was queued. It has NOT executed.` };
      }
    }
    if (op === "create") return await db.create(entity, (args.data as Record<string, unknown>) ?? {});
    return await db.update(entity, args.id as string, (args.data as Record<string, unknown>) ?? {});
  }
  return { error: "operation not permitted" };
}

export async function runAgent(name: string, message: string, context?: unknown): Promise<{ reply: string; steps: unknown[]; blocked?: boolean; cost_usd?: number; model?: string }> {
  const def = registry[name];
  if (!def) throw new Error(`Unknown agent: ${name}`);
  const key = LLM_PROVIDER === "anthropic" ? Deno.env.get("ANTHROPIC_API_KEY") : Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    throw new Error(
      LLM_PROVIDER === "anthropic"
        ? "ANTHROPIC_API_KEY not set (LLM_PROVIDER=anthropic → agent runtime uses Claude)"
        : "OPENAI_API_KEY not set (agent runtime uses OpenAI function-calling)",
    );
  }

  // --- Guardrails: pin the model and enforce cost caps for this agent ---
  // resolveModel returns the pinned id (OpenAI ids in the config); providerModel()
  // translates it to the Claude equivalent when LLM_PROVIDER=anthropic. Metering uses
  // the same active model so the daily USD caps stay accurate on whichever provider.
  const model = providerModel(resolveModel(name, def));
  // GLOBAL AI kill-switch + spend cap (same brakes InvokeLLM honors). The agent runtime talks to the
  // provider directly, so it must check these itself or it would bypass the platform-wide ceiling.
  if (await aiPaused().catch(() => false)) {
    return { reply: "(Paused: AI is globally stopped by an admin (ai_paused). Resume to run agents.)", steps: [], blocked: true, cost_usd: 0, model };
  }
  if (aiSpendCapReached()) {
    return { reply: "(Paused: the global AI daily spend cap (AI_DAILY_SPEND_CAP_USD) has been reached. Raise it or wait for the next UTC day.)", steps: [], blocked: true, cost_usd: 0, model };
  }

  const caps = capsFor(name);
  const spentBefore = await spentTodayUsd(name);
  if (spentBefore >= caps.dailyUsdCap) {
    return {
      reply: `(Paused: ${name} has reached its daily AI budget of $${caps.dailyUsdCap.toFixed(2)}. Raise it in agent-guardrails.json or wait for the next UTC day.)`,
      steps: [],
      blocked: true,
      cost_usd: 0,
      model,
    };
  }

  const tools = LLM_PROVIDER === "anthropic" ? anthropicToolsFor(def) : toolsFor(def);
  // RECALL: steer this run by what the agent (and the platform) has already learned.
  const lessons = await recallLessons(name);
  const system = `${def.instructions}\n\nUse the provided tools to read/write data as needed. When done, reply to the user directly.${lessons}`;
  // System prompt is passed out-of-band (OpenAI prepends it as a system message; Anthropic
  // takes it as the `system` param), so `messages` starts with just the user turn.
  const messages: Record<string, unknown>[] = [
    { role: "user", content: context ? `${message}\n\nContext: ${JSON.stringify(context)}` : message },
  ];
  const steps: unknown[] = [];
  const toolsUsed: string[] = [];
  let runCost = 0;

  for (let i = 0; i < caps.maxSteps; i++) {
    const turn = await limited("llm", LLM_CONCURRENCY, () => callModel({ key: key!, model, system, messages, tools }));

    // Meter this call's cost and enforce the caps before doing more work.
    const stepCost = costOf(model, turn.usage);
    runCost += stepCost;
    await logUsage(name, model, turn.usage, stepCost);
    // Feed the GLOBAL per-day meter too, and stop if the platform-wide cap is now reached.
    recordAiTokenSpend(totalTokens(turn.usage));
    if (aiSpendCapReached()) {
      return { reply: `(Stopped mid-run: the global AI daily spend cap (AI_DAILY_SPEND_CAP_USD) was reached.)`, steps, blocked: true, cost_usd: runCost, model };
    }
    if (spentBefore + runCost >= caps.dailyUsdCap || runCost >= caps.perRunUsdCap) {
      return {
        reply: `(Stopped mid-run: ${name} hit a cost cap (run $${runCost.toFixed(4)} / day $${(spentBefore + runCost).toFixed(4)}). Adjust caps in agent-guardrails.json.)`,
        steps,
        blocked: true,
        cost_usd: runCost,
        model,
      };
    }

    messages.push(turn.assistant);
    if (!turn.calls.length) {
      // RECORD: the agent finished with a reply — provisional success (Increment 4 grounds it).
      await recordOutcome(name, { summary: turn.text, success: true, cost_usd: runCost, tools_used: toolsUsed });
      return { reply: turn.text, steps, cost_usd: runCost, model };
    }
    const results: { id: string; output: unknown }[] = [];
    for (const c of turn.calls) {
      toolsUsed.push(c.name);
      let out; try { out = await runTool(def, c.name, c.args, name); }
      catch (e) { out = { error: (e as Error).message }; }
      steps.push({ tool: c.name, result: out });
      results.push({ id: c.id, output: out });
    }
    pushToolResults(messages, results);
  }
  // RECORD: hit the step limit without a clean finish — a weak signal (not a success).
  await recordOutcome(name, { summary: "reached step limit without finishing", success: false, cost_usd: runCost, tools_used: toolsUsed });
  return { reply: "(agent reached step limit)", steps, cost_usd: runCost, model };
}
