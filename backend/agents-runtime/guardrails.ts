// Non-money guardrails for the agent runtime: per-agent MODEL PINNING and COST CAPS.
//
// Reuses the existing `AgentPerformanceLog` entity to record each LLM call's token usage
// and USD cost, so per-agent daily spend can be summed without a new table. All limits
// live in `agent-guardrails.json` — change a model or a cap there with no code change.
import { db } from "../sdk/db.ts";

type Pricing = Record<string, { inPer1k: number; outPer1k: number }>;
type Guardrails = {
  defaultModel: string;
  smallModel: string;
  modelAliases: Record<string, string>;
  pricing: Pricing;
  defaults: { dailyUsdCap: number; perRunUsdCap: number; maxSteps: number };
  perAgent: Record<
    string,
    { model?: string; dailyUsdCap?: number; perRunUsdCap?: number; maxSteps?: number }
  >;
};

const cfg: Guardrails = JSON.parse(
  await Deno.readTextFile(new URL("./agent-guardrails.json", import.meta.url)),
);

export type AgentDefLike = { model?: string | null };
export type Usage = { prompt_tokens?: number; completion_tokens?: number } | undefined;

function alias(m: string): string {
  return cfg.modelAliases[m] ?? m;
}

/** Resolve an agent's model: per-agent override → agents.json value → default. */
export function resolveModel(agentName: string, def: AgentDefLike): string {
  const override = cfg.perAgent[agentName]?.model;
  if (override) return alias(override);
  if (def.model) return alias(def.model);
  return cfg.defaultModel;
}

/** The caps in force for an agent (per-agent override → global defaults). */
export function capsFor(agentName: string) {
  const a = cfg.perAgent[agentName] ?? {};
  return {
    dailyUsdCap: a.dailyUsdCap ?? cfg.defaults.dailyUsdCap,
    perRunUsdCap: a.perRunUsdCap ?? cfg.defaults.perRunUsdCap,
    maxSteps: a.maxSteps ?? cfg.defaults.maxSteps,
  };
}

/** USD cost of one LLM call from its token usage + the pricing table. */
export function costOf(model: string, usage: Usage): number {
  if (!usage) return 0;
  const p = cfg.pricing[model] ?? cfg.pricing[cfg.defaultModel];
  if (!p) return 0;
  const inK = (usage.prompt_tokens ?? 0) / 1000;
  const outK = (usage.completion_tokens ?? 0) / 1000;
  return inK * p.inPer1k + outK * p.outPer1k;
}

function startOfUtcDayISO(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())).toISOString();
}

/** Sum today's (UTC) USD spend for an agent from AgentPerformanceLog. */
export async function spentTodayUsd(agentName: string): Promise<number> {
  try {
    const rows = await db.filter(
      "AgentPerformanceLog",
      { agent: agentName, kind: "llm_usage", created_date: { $gte: startOfUtcDayISO() } },
      "-created_date",
      2000,
    );
    return rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.cost_usd) || 0), 0);
  } catch {
    return 0; // never block an agent because the meter query failed
  }
}

/** Record one LLM call's usage + cost (feeds the daily meter and observability). */
export async function logUsage(agentName: string, model: string, usage: Usage, costUsd: number) {
  try {
    await db.create("AgentPerformanceLog", {
      kind: "llm_usage",
      agent: agentName,
      model,
      prompt_tokens: usage?.prompt_tokens ?? 0,
      completion_tokens: usage?.completion_tokens ?? 0,
      cost_usd: Math.round(costUsd * 1e6) / 1e6,
      at: new Date().toISOString(),
    });
  } catch { /* best-effort; metering must never break the agent */ }
}
