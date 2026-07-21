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

/** InvokeLLM — returns a string, or a parsed object when response_json_schema is given.
 *  Runs through a concurrency limiter with retry/backoff so provider rate limits are absorbed. */
export function InvokeLLM(args: LLMArgs): Promise<unknown> {
  return limited("llm", LLM_CONCURRENCY, () => invokeLLMRaw(args));
}

async function invokeLLMRaw(args: LLMArgs): Promise<unknown> {
  const wantJson = !!args.response_json_schema;
  const model = MODEL_MAP[args.model ?? "default"] ?? MODEL_MAP.default;
  const sys = wantJson
    ? "You are a helpful assistant. Respond ONLY with valid JSON matching the requested schema. No prose."
    : "You are a helpful assistant.";

  if (LLM_PROVIDER === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-3-5-sonnet-latest",
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

/** GenerateImage — OpenAI images by default; returns { url }. */
export async function GenerateImage(args: { prompt: string; size?: string }) {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: Deno.env.get("IMAGE_MODEL") ?? "dall-e-3", prompt: args.prompt, size: args.size ?? "1024x1024", n: 1 }),
  });
  const j = await r.json();
  return { url: j?.data?.[0]?.url ?? "" };
}

export const Core = { InvokeLLM, SendEmail, GenerateImage };
