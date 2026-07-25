// Replacements for base44.integrations.Core.* — you own the keys, so you control
// (and pay for) the rate limits directly. Providers are swappable via env.
//
// NOTE ON RATE LIMITS: moving off Base44 does not remove LLM/email rate limits — it
// moves them to YOUR provider account. Set LLM_PROVIDER's tier appropriately and add
// a queue (see MIGRATION-PLAN.md, "Throughput") for high volume.

import { limited, LLM_CONCURRENCY, EMAIL_CONCURRENCY } from "./queue.ts";
import { sesSend } from "./aws/ses.ts";

type LLMArgs = {
  prompt: string;
  response_json_schema?: unknown;
  model?: string;
  add_context_from_internet?: boolean;
};

const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") ?? "openai"; // openai | anthropic
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
  default: Deno.env.get("CLAUDE_MODEL_DEFAULT") ?? "claude-3-5-sonnet-latest",
};

/** Resolve a Base44 alias (or raw model id) to a real model id for the active provider. */
function resolveModelId(alias?: string): string {
  const key = alias ?? "default";
  if (LLM_PROVIDER === "anthropic") {
    const flat = Deno.env.get("ANTHROPIC_MODEL"); // legacy flat override → same model for every tier
    if (flat) return flat;
    // If a raw Claude id was passed through, use it as-is; else map the alias/tier.
    if (key.startsWith("claude")) return key;
    return CLAUDE_MODEL_MAP[key] ?? CLAUDE_MODEL_MAP.default;
  }
  return MODEL_MAP[key] ?? MODEL_MAP.default;
}

/** InvokeLLM — returns a string, or a parsed object when response_json_schema is given.
 *  Runs through a concurrency limiter with retry/backoff so provider rate limits are absorbed. */
export function InvokeLLM(args: LLMArgs): Promise<unknown> {
  return limited("llm", LLM_CONCURRENCY, () => invokeLLMRaw(args));
}

async function invokeLLMRaw(args: LLMArgs): Promise<unknown> {
  const wantJson = !!args.response_json_schema;
  const model = resolveModelId(args.model);
  const sys = wantJson
    ? "You are a helpful assistant. Respond ONLY with valid JSON matching the requested schema. No prose."
    : "You are a helpful assistant.";

  if (LLM_PROVIDER === "anthropic") {
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
  const from = args.from ?? Deno.env.get("EMAIL_FROM") ?? "no-reply@yourdomain.com";
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
 *  IMAGE_PROVIDER: openai (default) | stability. Keeps images working regardless of LLM_PROVIDER,
 *  so you can run Claude for all text/reasoning and one small key for images.
 *  IMAGE_API_KEY overrides the provider's key if you want image billing separate from the LLM key. */
export async function GenerateImage(args: { prompt: string; size?: string }) {
  const provider = Deno.env.get("IMAGE_PROVIDER") ?? "openai";

  if (provider === "stability") {
    const key = Deno.env.get("IMAGE_API_KEY") ?? Deno.env.get("STABILITY_API_KEY");
    const engine = Deno.env.get("IMAGE_MODEL") ?? "stable-image/generate/core";
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

  // default: OpenAI images
  const key = Deno.env.get("IMAGE_API_KEY") ?? OPENAI_KEY;
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: Deno.env.get("IMAGE_MODEL") ?? "dall-e-3", prompt: args.prompt, size: args.size ?? "1024x1024", n: 1 }),
  });
  if (!r.ok && (r.status === 429 || r.status >= 500)) throw Object.assign(new Error(`OpenAI image ${r.status}`), { status: r.status });
  const j = await r.json();
  return { url: j?.data?.[0]?.url ?? "" };
}

export const Core = { InvokeLLM, SendEmail, GenerateImage };
