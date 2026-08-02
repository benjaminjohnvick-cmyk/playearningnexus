// Replacements for base44.integrations.Core.* — you own the keys, so you control
// (and pay for) the rate limits directly. Providers are swappable via env.
//
// NOTE ON RATE LIMITS: moving off Base44 does not remove LLM/email rate limits — it
// moves them to YOUR provider account. Set LLM_PROVIDER's tier appropriately and add
// a queue (see MIGRATION-PLAN.md, "Throughput") for high volume.

import { limited, LLM_CONCURRENCY, EMAIL_CONCURRENCY } from "./queue.ts";
import { sesSend } from "./aws/ses.ts";
import { signedFetch, credsFromEnv } from "./aws/sigv4.ts";

// Chunked base64 encode (btoa on a huge spread arg overflows the call stack).
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

type LLMArgs = {
  prompt: string;
  response_json_schema?: unknown;
  model?: string;
  add_context_from_internet?: boolean;
};

import { snapString, snapNumber } from "./settings.ts";
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") ?? "openai"; // openai | anthropic (env fallback; live via snapString)

// ---- AI daily spend guardrail (AI_DAILY_SPEND_CAP_USD; 0 = no cap) --------------------------------
// A per-process accumulator of estimated LLM spend, reset each UTC day. Every InvokeLLM checks the
// cap before running and adds the call's estimated cost after. Approximate (token estimate × a
// configurable blended rate) and per-process, but a real global brake on runaway AI cost.
let _aiSpend = { day: "", usd: 0 };
function aiSpendToday(): number {
  const day = new Date().toISOString().slice(0, 10);
  if (_aiSpend.day !== day) _aiSpend = { day, usd: 0 };
  return _aiSpend.usd;
}
function addAiSpend(usd: number) {
  const day = new Date().toISOString().slice(0, 10);
  if (_aiSpend.day !== day) _aiSpend = { day, usd: 0 };
  _aiSpend.usd += Math.max(0, Number(usd) || 0);
}
function estimateLlmCostUsd(totalTokens: number): number {
  const per1k = snapNumber("AI_COST_PER_1K_TOKENS", 0.01); // blended input+output estimate ($/1k tokens)
  return (Math.max(0, Number(totalTokens) || 0) / 1000) * per1k;
}
/** Current estimated AI spend today (for status endpoints). */
export function aiDailySpendUsd(): number { return Math.round(aiSpendToday() * 100) / 100; }

// ---- Shared meter for LLM callers OUTSIDE InvokeLLM (agent runtime, TTS, any direct provider call) --
// These let every direct-to-provider path honor the SAME global AI_DAILY_SPEND_CAP_USD brake and feed
// the same per-day accumulator, instead of each one silently bypassing the cap.

/** Throw if today's estimated AI spend has already reached the cap (0 = no cap). Call BEFORE a
 *  direct provider request so agent-runtime / TTS refuse once the daily ceiling is hit. */
export function assertAiSpendUnderCap(): void {
  const cap = snapNumber("AI_DAILY_SPEND_CAP_USD", 0);
  if (cap > 0 && aiSpendToday() >= cap) {
    throw new Error(`AI daily spend cap reached ($${cap}). Raise AI_DAILY_SPEND_CAP_USD or wait until tomorrow.`);
  }
}
/** True when the cap is set and already reached (non-throwing variant). */
export function aiSpendCapReached(): boolean {
  const cap = snapNumber("AI_DAILY_SPEND_CAP_USD", 0);
  return cap > 0 && aiSpendToday() >= cap;
}
/** Record estimated spend for a direct provider call, by total (input+output) tokens. */
export function recordAiTokenSpend(totalTokens: number): void {
  try { addAiSpend(estimateLlmCostUsd(totalTokens)); } catch { /* best-effort */ }
}
/** Record a flat USD cost for a call we can't token-estimate (e.g. TTS characters). */
export function recordAiUsdSpend(usd: number): void { addAiSpend(usd); }
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Maps the Base44 model aliases (e.g. 'gpt_5_mini') to real model IDs.
const MODEL_MAP: Record<string, string> = {
  gpt_5_mini: Deno.env.get("LLM_MODEL_SMALL") ?? "gpt-4o-mini",
  gpt_5: Deno.env.get("LLM_MODEL_LARGE") ?? "gpt-4o",
  default: Deno.env.get("LLM_MODEL_DEFAULT") ?? "gpt-4o-mini",
};

// Claude equivalents, tiered the same small/large/default way so the Anthropic
// path honours per-call model tiers instead of one flat model. Overridable via env.
// ANTHROPIC_MODEL (legacy) still works as a flat override for every tier.
const CLAUDE_MODEL_MAP: Record<string, string> = {
  gpt_5_mini: Deno.env.get("CLAUDE_MODEL_SMALL") ?? "claude-3-5-haiku-latest",
  gpt_5: Deno.env.get("CLAUDE_MODEL_LARGE") ?? "claude-3-5-sonnet-latest",
  // Cheap tier by DEFAULT (matches the OpenAI default, which is already gpt-4o-mini). The ~190 call
  // sites that don't name a model do simple structured work and run cheap on both providers; sites that
  // need real reasoning pass model:"gpt_5" explicitly. Owner can override globally via CLAUDE_MODEL_DEFAULT.
  default: Deno.env.get("CLAUDE_MODEL_DEFAULT") ?? "claude-3-5-haiku-latest",
};

/** Resolve a Base44 alias (or raw model id) to a real model id for the active provider. */
function resolveModelId(alias?: string): string {
  const key = alias ?? "default";
  // Provider + per-tier model IDs are admin-adjustable live (DB override → env → default).
  const provider = snapString("LLM_PROVIDER", LLM_PROVIDER);
  if (provider === "anthropic") {
    const flat = Deno.env.get("ANTHROPIC_MODEL");
    if (flat) return flat;
    if (key.startsWith("claude")) return key;
    const cmap: Record<string, string> = {
      gpt_5_mini: snapString("CLAUDE_MODEL_SMALL", CLAUDE_MODEL_MAP.gpt_5_mini),
      gpt_5: snapString("CLAUDE_MODEL_LARGE", CLAUDE_MODEL_MAP.gpt_5),
      default: snapString("CLAUDE_MODEL_DEFAULT", CLAUDE_MODEL_MAP.default),
    };
    return cmap[key] ?? cmap.default;
  }
  const mmap: Record<string, string> = {
    gpt_5_mini: snapString("LLM_MODEL_SMALL", MODEL_MAP.gpt_5_mini),
    gpt_5: snapString("LLM_MODEL_LARGE", MODEL_MAP.gpt_5),
    default: snapString("LLM_MODEL_DEFAULT", MODEL_MAP.default),
  };
  return mmap[key] ?? mmap.default;
}

/** InvokeLLM — returns a string, or a parsed object when response_json_schema is given.
 *  Runs through a concurrency limiter with retry/backoff so provider rate limits are absorbed. */
export function InvokeLLM(args: LLMArgs): Promise<unknown> {
  const cap = snapNumber("AI_DAILY_SPEND_CAP_USD", 0);
  if (cap > 0 && aiSpendToday() >= cap) {
    return Promise.reject(new Error(`AI daily spend cap reached ($${cap}). Raise AI_DAILY_SPEND_CAP_USD or wait until tomorrow.`));
  }
  return limited("llm", LLM_CONCURRENCY, () => invokeLLMRaw(args));
}

async function invokeLLMRaw(args: LLMArgs): Promise<unknown> {
  const wantJson = !!args.response_json_schema;
  const model = resolveModelId(args.model);
  // Read the LIVE provider (DB→env→default) so an admin switching provider in the panel routes to the
  // matching API. Using the load-time const here would send a Claude model id to OpenAI (or vice-versa).
  const provider = snapString("LLM_PROVIDER", LLM_PROVIDER);
  const sys = wantJson
    ? "You are a helpful assistant. Respond ONLY with valid JSON matching the requested schema. No prose."
    : "You are a helpful assistant.";

  if (provider === "self") {
    // Your own OpenAI-compatible server (vLLM/Ollama/TGI). Falls back to OpenAI on error if a key is set.
    try {
      const { selfChat } = await import("./providers.ts");
      const text = await selfChat(args.prompt + (wantJson ? `\n\nJSON schema: ${JSON.stringify(args.response_json_schema)}` : ""), sys, wantJson);
      return wantJson ? safeJson(text) : text;
    } catch (e) {
      if (!OPENAI_KEY) throw e;   // no managed fallback available — surface the self error
      // else fall through to the OpenAI path below
    }
  }

  if (provider === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model, // tiered small/large/default via CLAUDE_MODEL_MAP (or ANTHROPIC_MODEL flat override)
        max_tokens: 2048, system: sys,
        messages: [{ role: "user", content: args.prompt + (wantJson ? `\n\nJSON schema: ${JSON.stringify(args.response_json_schema)}` : "") }],
      }),
    });
    if (!r.ok) throw Object.assign(new Error(`Anthropic ${r.status}`), { status: r.status });
    const j = await r.json();
    const text = j?.content?.[0]?.text ?? "";
    try { addAiSpend(estimateLlmCostUsd((Number(j?.usage?.input_tokens) || 0) + (Number(j?.usage?.output_tokens) || 0))); } catch { /* cost tracking is best-effort */ }
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
  try { addAiSpend(estimateLlmCostUsd((Number(j?.usage?.prompt_tokens) || 0) + (Number(j?.usage?.completion_tokens) || 0))); } catch { /* cost tracking is best-effort */ }
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
  const from = args.from ?? snapString("EMAIL_FROM", "no-reply@yourdomain.com");
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

/** GenerateImage — companion image provider (Claude has no image API).
 *  IMAGE_PROVIDER: openai (default) | stability | aws_bedrock | aws_sagemaker.
 *   - aws_bedrock    : true serverless — no infra to run. Amazon Nova Canvas / Titan Image / SDXL on
 *                      Bedrock. Pay only per generated image (fractions of a cent). Needs AWS creds.
 *   - aws_sagemaker  : a SageMaker endpoint hosting your OWN open model (SDXL/FLUX). Configure it to
 *                      scale to zero (async / serverless-style) so you pay only while it's generating.
 *                      Needs AWS creds + SAGEMAKER_IMAGE_ENDPOINT.
 *  Both AWS paths generate ORIGINAL images (no third-party catalog content). Returns { url } as a
 *  data URL (base64) so callers get a usable src even without S3; image-gen.ts persists it to S3. */
export async function GenerateImage(args: { prompt: string; size?: string }) {
  const provider = snapString("IMAGE_PROVIDER", "openai");

  if (provider === "aws_bedrock") {
    const creds = credsFromEnv();
    const region = creds.region;
    const modelId = snapString("IMAGE_MODEL", "amazon.nova-canvas-v1:0");
    // Titan / Nova Canvas request shape; Stability-on-Bedrock shape is handled on the response side.
    const [w, h] = (args.size ?? "1024x1024").split("x").map((n) => Number(n) || 1024);
    const body = modelId.startsWith("stability.")
      ? JSON.stringify({ text_prompts: [{ text: args.prompt }], width: w, height: h })
      : JSON.stringify({ taskType: "TEXT_IMAGE", textToImageParams: { text: args.prompt }, imageGenerationConfig: { numberOfImages: 1, width: w, height: h, quality: "standard" } });
    const host = `bedrock-runtime.${region}.amazonaws.com`;
    // Pass the RAW path — signedFetch handles SigV4 path encoding (model ids can contain ':').
    const r = await signedFetch(creds, "bedrock", host, `/model/${modelId}/invoke`, body);
    if (!r.ok && (r.status === 429 || r.status >= 500)) throw Object.assign(new Error(`Bedrock ${r.status}`), { status: r.status });
    if (!r.ok) return { url: "" };
    const j = await r.json().catch(() => ({}));
    const b64 = j?.images?.[0] ?? j?.artifacts?.[0]?.base64 ?? "";
    return { url: b64 ? `data:image/png;base64,${b64}` : "" };
  }

  if (provider === "aws_sagemaker") {
    const creds = credsFromEnv();
    const endpoint = Deno.env.get("SAGEMAKER_IMAGE_ENDPOINT");
    if (!endpoint) return { url: "" };
    const host = `runtime.sagemaker.${creds.region}.amazonaws.com`;
    // Common HF text-to-image container contract: {"inputs": prompt}. Adjust to your container if needed.
    const body = JSON.stringify({ inputs: args.prompt, parameters: {} });
    const r = await signedFetch(creds, "sagemaker", host, `/endpoints/${endpoint}/invocations`, body);
    if (!r.ok && (r.status === 429 || r.status >= 500)) throw Object.assign(new Error(`SageMaker ${r.status}`), { status: r.status });
    if (!r.ok) return { url: "" };
    const ct = r.headers.get("content-type") ?? "";
    if (ct.startsWith("image/")) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      return { url: `data:${ct};base64,${bytesToBase64(bytes)}` };
    }
    const j = await r.json().catch(() => ({}));
    // Containers vary: {image|generated_image|artifacts:[{base64}]} or [{"generated_image": "<b64>"}]
    const b64 = j?.image ?? j?.generated_image ?? j?.[0]?.generated_image ?? j?.artifacts?.[0]?.base64 ?? "";
    return { url: b64 ? `data:image/png;base64,${b64}` : "" };
  }

  if (provider === "stability") {
    const key = Deno.env.get("IMAGE_API_KEY") ?? Deno.env.get("STABILITY_API_KEY");
    const engine = snapString("IMAGE_MODEL", "stable-image/generate/core");
    const form = new FormData();
    form.append("prompt", args.prompt);
    form.append("output_format", "png");
    const r = await fetch(`https://api.stability.ai/v2beta/${engine}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, accept: "application/json" },
      body: form,
    });
    if (!r.ok && (r.status === 429 || r.status >= 500)) throw Object.assign(new Error(`Stability ${r.status}`), { status: r.status });
    const j = await r.json();
    // Stability returns base64; hand back a data URL so callers get a usable src.
    return { url: j?.image ? `data:image/png;base64,${j.image}` : "" };
  }

  if (provider === "self") {
    // Your own SDXL/FLUX HTTP server. Falls back to OpenAI images on empty result if a key is set.
    const { selfImage } = await import("./providers.ts");
    const out = await selfImage(args.prompt, args.size);
    if (out.url) return out;
    if (!(Deno.env.get("IMAGE_API_KEY") ?? OPENAI_KEY)) return { url: "" };
    // else fall through to OpenAI images
  }

  // default: OpenAI images
  const key = Deno.env.get("IMAGE_API_KEY") ?? OPENAI_KEY;
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: snapString("IMAGE_MODEL", "dall-e-3"), prompt: args.prompt, size: args.size ?? "1024x1024", n: 1 }),
  });
  if (!r.ok && (r.status === 429 || r.status >= 500)) throw Object.assign(new Error(`OpenAI image ${r.status}`), { status: r.status });
  const j = await r.json();
  return { url: j?.data?.[0]?.url ?? "" };
}

export const Core = { InvokeLLM, SendEmail, GenerateImage };
