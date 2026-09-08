// ai-models.ts — the ONE swappable AI-model registry + per-job routing map.
//
// WHY: the platform calls Core.InvokeLLM from ~190 sites. Rather than hard-code a model at each site, every
// site names a JOB ("document", "reasoning", "ad_copy", …) and this module decides WHICH model runs it. A
// future model (or a whole new company's model) drops in as ONE registry row; pointing a job at it is a
// settings change. Nothing else in the codebase changes.
//
// HOW IT SITS ON THE STACK: this module returns a TIER ALIAS (or a raw/gateway model id) that you pass as
// `args.model` to Core.InvokeLLM. integrations.ts::resolveModelId then maps that alias to the concrete id for
// the ACTIVE provider (openai | anthropic | groq | self | gateway). So the two layers compose:
//   ai-models.ts  = "which model for this job" (portfolio / routing)
//   integrations  = "how to call the active provider for that model" (transport)
//
// GATEWAY / "always the latest from every company": set LLM_PROVIDER=gateway and point AI_GATEWAY_URL at an
// OpenRouter-style unified endpoint. Then a registry row can carry a full "vendor/model" id and reach any
// company's model through one key — adding a newly released model is just editing this file (or the
// GATEWAY_MODEL_* settings). No provider is guaranteed to expose a brand-new model on day one (early access
// is gated), so treat the registry as the place you bump ids as models ship.

import { snapString, snapBool } from "./settings.ts";

export type CostTier = "free" | "cheap" | "standard" | "frontier";
export type ModelCapability = "text" | "json" | "reasoning" | "documents" | "vision" | "long_context";

export interface ModelDef {
  key: string;                    // stable registry key a job route points at
  label: string;
  tierAlias: string;              // what gets passed to Core.InvokeLLM as args.model
  providerHint: string;           // which provider this is meant for (openai | anthropic | groq | self | gateway | any)
  gatewayId?: string;             // full "vendor/model" id when reached through the unified gateway
  cost: CostTier;
  capabilities: ModelCapability[];
  note?: string;
}

// THE REGISTRY. Add a future model as a new row — that is the whole "swap in a new model" operation.
export const MODELS: ModelDef[] = [
  {
    key: "cheap", label: "Cheap / high-volume", tierAlias: "gpt_5_mini", providerHint: "any",
    gatewayId: "openai/gpt-4o-mini", cost: "cheap", capabilities: ["text", "json"],
    note: "Default for routine, high-volume structured calls. Cheapest path (Llama on Groq's free tier by default).",
  },
  {
    key: "standard", label: "Standard reasoning", tierAlias: "gpt_5", providerHint: "any",
    gatewayId: "openai/gpt-4o", cost: "standard", capabilities: ["text", "json", "reasoning"],
    note: "For calls that need real reasoning. Pass this for decisions, not routine formatting.",
  },
  {
    key: "astra", label: "GPT-6 Astra (frontier)", tierAlias: "frontier", providerHint: "openai",
    gatewayId: "openai/gpt-6-astra", cost: "frontier",
    capabilities: ["text", "json", "reasoning", "documents", "long_context"],
    note: "OpenAI gpt-6-astra (also on AWS Bedrock, and via the gateway). Highest cost (~$10/$50 per M tokens). " +
      "Reserve for the hard, high-value jobs (documents, complex ops reasoning). Requires AI_FORCE_CHEAP_TIER OFF to actually run.",
  },
];

export const modelByKey = (k: string): ModelDef | undefined => MODELS.find((m) => m.key === k);
export const modelKeys = (): string[] => MODELS.map((m) => m.key);

// THE JOB → MODEL MAP ("uses"). Each platform use names a default model key + a fallback chain. An admin can
// override any job live with a setting AI_JOB_MODEL_<JOB> = a model key (e.g. AI_JOB_MODEL_DOCUMENT=astra).
export interface JobRoute { job: string; label: string; defaultModel: string; fallback: string[]; group: string; }
export const JOBS: JobRoute[] = [
  { job: "routine", label: "Routine / structured calls", defaultModel: "cheap", fallback: ["standard"], group: "general" },
  { job: "reasoning", label: "Reasoning / decisions", defaultModel: "standard", fallback: ["cheap"], group: "general" },
  { job: "ad_copy", label: "Ad copy generation", defaultModel: "cheap", fallback: ["standard"], group: "content" },
  { job: "creative", label: "Creative concepting", defaultModel: "standard", fallback: ["cheap"], group: "content" },
  { job: "seo", label: "SEO & AI-search optimization", defaultModel: "standard", fallback: ["cheap"], group: "content" },
  { job: "document", label: "Document / report generation", defaultModel: "astra", fallback: ["standard", "cheap"], group: "documents" },
  { job: "ops_reasoning", label: "Operations reasoning (autonomy)", defaultModel: "standard", fallback: ["cheap"], group: "ops" },
  { job: "support", label: "Support answer drafts", defaultModel: "cheap", fallback: ["standard"], group: "ops" },
];

export const jobByKey = (j: string): JobRoute | undefined => JOBS.find((r) => r.job === j);
const jobSettingKey = (job: string): string => `AI_JOB_MODEL_${job.toUpperCase()}`;

/** Resolve a job to the model KEY it should use: an admin override if valid, else the job's default, else cheap. */
export function modelKeyForJob(job: string): string {
  const route = jobByKey(job);
  const override = snapString(jobSettingKey(job), "").trim();
  if (override && modelByKey(override)) return override;
  return route?.defaultModel ?? "cheap";
}

/** Resolve a job to the TIER ALIAS to pass to Core.InvokeLLM as `args.model`.
 *  Usage:  Core.InvokeLLM({ model: modelForJob("document"), prompt })  */
export function modelForJob(job: string): string {
  const m = modelByKey(modelKeyForJob(job)) ?? modelByKey("cheap")!;
  return m.tierAlias;
}

/** The next model key to try if a job's chosen model fails (first fallback whose model still exists). */
export function fallbackModelForJob(job: string): string | null {
  const route = jobByKey(job);
  for (const k of route?.fallback ?? []) if (modelByKey(k)) return k;
  return null;
}

/** Whether the frontier model (Astra) can actually run right now: it's registered AND the cheap-tier brake is
 *  OFF. When this is false, any job pointed at "astra" transparently runs on the cheap tier (cost stays capped). */
export function frontierActive(): boolean {
  return !snapBool("AI_FORCE_CHEAP_TIER", false) && !!modelByKey("astra");
}

/** Admin summary of the registry + the EFFECTIVE job routing (for the aiModelStatus endpoint). */
export function modelRoutingSummary(): Record<string, unknown> {
  return {
    provider: snapString("LLM_PROVIDER", "groq"),
    gateway_url: snapString("AI_GATEWAY_URL", "https://openrouter.ai/api/v1/chat/completions"),
    frontier_active: frontierActive(),
    force_cheap_tier: snapBool("AI_FORCE_CHEAP_TIER", false),
    models: MODELS.map((m) => ({ key: m.key, label: m.label, tier: m.tierAlias, cost: m.cost, capabilities: m.capabilities, gateway_id: m.gatewayId ?? null, note: m.note })),
    jobs: JOBS.map((r) => {
      const chosen = modelKeyForJob(r.job);
      return {
        job: r.job, label: r.label, group: r.group,
        model: chosen, tier: modelByKey(chosen)?.tierAlias ?? "gpt_5_mini",
        default: r.defaultModel, overridden: chosen !== r.defaultModel, fallback: r.fallback,
      };
    }),
  };
}
