// provisioning-selftest.ts — actively VERIFY that each free-tier provider credential really works, instead of
// waiting for the first real feature to discover a bad key. setupStatus only reports whether an env var is
// *present*; this pings each provider's free verify endpoint and reports green/red per provider.
//
// Every check here is FREE and non-billable: model/metadata GETs, a token-verify GET, an account GET, a sender
// list GET, and a single idempotent tiny R2 probe object (fixed key, overwritten each run — never accumulates).
// No AI generation, no image render, no email send. It changes no settings. Read-only by design.
//
// summarize() is a pure function (no I/O) so it can be unit-tested without network. runProvisioningSelfTest()
// does the live fetches and hands its per-provider results to summarize().

import { presignPut, type AwsCreds } from "./aws/sigv4.ts";

export type CheckState = "ok" | "fail" | "skipped";

export interface ProviderCheck {
  key: string;          // stable id: groq | cloudflare | r2 | email | email_sender
  label: string;        // human label
  configured: boolean;  // were the creds present to even attempt it?
  state: CheckState;    // ok | fail | skipped(=not configured)
  detail: string;       // what happened / the fix
  latency_ms?: number;  // round-trip for attempted checks
}

export interface SelfTestSummary {
  overall: "green" | "red";   // red iff any CONFIGURED check failed; unconfigured never makes it red
  configured: number;
  ok: number;
  failed: string[];           // keys of configured checks that failed
  skipped: string[];          // keys that were not configured (nothing to verify yet)
}

/** Pure aggregator. overall is green when every *configured* check is ok; a provider you haven't set up yet is
 *  "skipped", not a failure. No network — safe to unit-test. */
export function summarize(checks: ProviderCheck[]): SelfTestSummary {
  const configured = checks.filter((c) => c.configured);
  const failed = configured.filter((c) => c.state !== "ok").map((c) => c.key);
  const skipped = checks.filter((c) => !c.configured).map((c) => c.key);
  return {
    overall: failed.length === 0 ? "green" : "red",
    configured: configured.length,
    ok: configured.length - failed.length,
    failed,
    skipped,
  };
}

const env = (k: string) => (Deno.env.get(k) || "").trim();

/** fetch with a hard timeout so a hung provider can't stall the whole self-test. Returns the Response or throws. */
async function timedFetch(url: string, init: RequestInit, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function checkGroq(): Promise<ProviderCheck> {
  const key = env("GROQ_API_KEY");
  const base: ProviderCheck = { key: "groq", label: "Groq — LLM + speech-to-text + agents", configured: !!key, state: "skipped", detail: "GROQ_API_KEY not set — free at console.groq.com. Everything falls back to OpenAI until set." };
  if (!key) return base;
  const t0 = Date.now();
  try {
    const r = await timedFetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${key}` } });
    const latency_ms = Date.now() - t0;
    if (!r.ok) return { ...base, state: "fail", latency_ms, detail: `Key rejected (HTTP ${r.status}). Regenerate GROQ_API_KEY at console.groq.com and update it in Railway.` };
    const j = await r.json().catch(() => ({})) as { data?: unknown[] };
    const n = Array.isArray(j.data) ? j.data.length : 0;
    return { ...base, state: "ok", latency_ms, detail: `Working — ${n} model(s) available.` };
  } catch (e) {
    return { ...base, state: "fail", latency_ms: Date.now() - t0, detail: `Could not reach Groq: ${String((e as Error)?.message || e).slice(0, 100)}` };
  }
}

async function checkCloudflare(): Promise<ProviderCheck> {
  const token = env("CLOUDFLARE_API_TOKEN");
  const acct = env("CLOUDFLARE_ACCOUNT_ID");
  const base: ProviderCheck = { key: "cloudflare", label: "Cloudflare Workers AI — image generation", configured: !!token, state: "skipped", detail: "CLOUDFLARE_API_TOKEN not set — free at dash.cloudflare.com. Falls back to Bedrock/Titan until set." };
  if (!token) return base;
  const t0 = Date.now();
  try {
    const r = await timedFetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: { authorization: `Bearer ${token}` } });
    const latency_ms = Date.now() - t0;
    const j = await r.json().catch(() => ({})) as { success?: boolean; result?: { status?: string } };
    if (!r.ok || !j.success) return { ...base, state: "fail", latency_ms, detail: `Token rejected (HTTP ${r.status}). Recreate a Workers AI token at dash.cloudflare.com and update CLOUDFLARE_API_TOKEN.` };
    const status = j.result?.status || "active";
    if (status !== "active") return { ...base, state: "fail", latency_ms, detail: `Token status is "${status}" — it must be active. Recreate the token.` };
    const acctNote = acct ? "" : " (also set CLOUDFLARE_ACCOUNT_ID — image runs need it.)";
    return { ...base, state: "ok", latency_ms, detail: `Working — token active.${acctNote}` };
  } catch (e) {
    return { ...base, state: "fail", latency_ms: Date.now() - t0, detail: `Could not reach Cloudflare: ${String((e as Error)?.message || e).slice(0, 100)}` };
  }
}

async function checkR2(): Promise<ProviderCheck> {
  const bucket = env("HLS_STORAGE_BUCKET");
  const endpoint = env("HLS_S3_ENDPOINT");
  const accessKeyId = env("HLS_S3_ACCESS_KEY_ID") || env("AWS_ACCESS_KEY_ID");
  const secretAccessKey = env("HLS_S3_SECRET_ACCESS_KEY") || env("AWS_SECRET_ACCESS_KEY");
  const region = env("HLS_S3_REGION") || (endpoint ? "auto" : (env("AWS_REGION") || "us-east-1"));
  const configured = !!(bucket && accessKeyId && secretAccessKey);
  const base: ProviderCheck = { key: "r2", label: "Object store (Cloudflare R2 / S3) — media", configured, state: "skipped", detail: "Bucket/creds not set — set HLS_STORAGE_BUCKET + HLS_S3_* (see SCALE-FLIPS.md). Uploads fall back until set." };
  if (!configured) return base;
  const creds: AwsCreds = { accessKeyId, secretAccessKey, region };
  const pathStyle = env("HLS_S3_PATH_STYLE") ? env("HLS_S3_PATH_STYLE") === "1" : !!endpoint;
  const probeKey = "__provisioning-selftest/probe.txt"; // fixed key, overwritten every run — never accumulates
  const t0 = Date.now();
  try {
    const url = await presignPut(creds, bucket, probeKey, { endpoint: endpoint || undefined, pathStyle, expires: 120 });
    const r = await timedFetch(url, { method: "PUT", headers: { "content-type": "text/plain", "cache-control": "no-store" }, body: `selftest ${new Date().toISOString()}` });
    const latency_ms = Date.now() - t0;
    if (!r.ok) return { ...base, state: "fail", latency_ms, detail: `Write rejected (HTTP ${r.status}) to bucket "${bucket}". Check the R2 keys + bucket name in Railway (HLS_S3_ACCESS_KEY_ID / _SECRET_ACCESS_KEY / HLS_STORAGE_BUCKET).` };
    return { ...base, state: "ok", latency_ms, detail: `Working — wrote a probe object to "${bucket}".` };
  } catch (e) {
    return { ...base, state: "fail", latency_ms: Date.now() - t0, detail: `Could not write to R2: ${String((e as Error)?.message || e).slice(0, 100)}` };
  }
}

// Brevo returns two checks: the API key works (account), and EMAIL_FROM is a VERIFIED sender (the #1 email
// failure mode). Only runs when the email provider is Brevo (or a BREVO_API_KEY is present).
async function checkBrevo(emailProviderRaw: string): Promise<ProviderCheck[]> {
  const key = env("BREVO_API_KEY");
  const from = env("EMAIL_FROM");
  const provider = (emailProviderRaw || "").toLowerCase();
  const relevant = provider === "brevo" || !!key;
  const acctBase: ProviderCheck = { key: "email", label: "Email — Brevo API key", configured: !!key, state: "skipped", detail: "BREVO_API_KEY not set — free at brevo.com (300/day, no card). Set EMAIL_PROVIDER=brevo + BREVO_API_KEY." };
  const senderBase: ProviderCheck = { key: "email_sender", label: "Email — EMAIL_FROM is a Verified sender", configured: false, state: "skipped", detail: "Set EMAIL_FROM to an address you've verified in Brevo (Senders, Domains & Dedicated IPs)." };
  if (!relevant || !key) return [acctBase, senderBase];

  const headers = { "api-key": key, accept: "application/json" };
  const t0 = Date.now();
  let acct: ProviderCheck;
  try {
    const r = await timedFetch("https://api.brevo.com/v3/account", { headers });
    const latency_ms = Date.now() - t0;
    if (!r.ok) {
      acct = { ...acctBase, state: "fail", latency_ms, detail: `Key rejected (HTTP ${r.status}). Regenerate the v3 API key in Brevo (SMTP & API) and update BREVO_API_KEY.` };
      return [acct, senderBase]; // no point checking senders with a dead key
    }
    const j = await r.json().catch(() => ({})) as { plan?: Array<{ type?: string; credits?: number }>; email?: string };
    const plan = Array.isArray(j.plan) ? j.plan.find((p) => (p.type || "").toLowerCase().includes("free")) || j.plan[0] : undefined;
    const credits = plan?.credits;
    acct = { ...acctBase, state: "ok", latency_ms, detail: `Working — account reachable${typeof credits === "number" ? ` (${credits} email credit(s) available)` : ""}.` };
  } catch (e) {
    acct = { ...acctBase, state: "fail", latency_ms: Date.now() - t0, detail: `Could not reach Brevo: ${String((e as Error)?.message || e).slice(0, 100)}` };
    return [acct, senderBase];
  }

  // Verified-sender check — only meaningful once EMAIL_FROM is set.
  const senderConfigured = !!from;
  const s0 = Date.now();
  let sender: ProviderCheck;
  try {
    const r = await timedFetch("https://api.brevo.com/v3/senders", { headers });
    const latency_ms = Date.now() - s0;
    if (!senderConfigured) {
      sender = { ...senderBase, configured: false, state: "skipped", detail: "EMAIL_FROM not set. Set it to a Brevo-verified sender address so sends aren't rejected." };
    } else if (!r.ok) {
      sender = { ...senderBase, configured: true, state: "fail", latency_ms, detail: `Could not list senders (HTTP ${r.status}) to confirm EMAIL_FROM "${from}".` };
    } else {
      const j = await r.json().catch(() => ({})) as { senders?: Array<{ email?: string; active?: boolean }> };
      const list = Array.isArray(j.senders) ? j.senders : [];
      const match = list.find((s) => (s.email || "").toLowerCase() === from.toLowerCase());
      if (match && match.active !== false) {
        sender = { ...senderBase, configured: true, state: "ok", latency_ms, detail: `Verified — "${from}" is an active Brevo sender.` };
      } else if (match) {
        sender = { ...senderBase, configured: true, state: "fail", latency_ms, detail: `"${from}" exists in Brevo but is NOT verified/active yet. Confirm the verification email Brevo sent.` };
      } else {
        const known = list.map((s) => s.email).filter(Boolean).slice(0, 5).join(", ");
        sender = { ...senderBase, configured: true, state: "fail", latency_ms, detail: `EMAIL_FROM "${from}" is not a Brevo sender. Add & verify it in Brevo, or set EMAIL_FROM to a verified one${known ? ` (verified: ${known})` : ""}.` };
      }
    }
  } catch (e) {
    sender = { ...senderBase, configured: senderConfigured, state: senderConfigured ? "fail" : "skipped", latency_ms: Date.now() - s0, detail: `Could not verify sender: ${String((e as Error)?.message || e).slice(0, 100)}` };
  }
  return [acct, sender];
}

export interface SelfTestResult {
  ran_at: string;
  summary: SelfTestSummary;
  checks: ProviderCheck[];
}

/** Run every provider check in parallel and summarize. Live network; returns per-provider ok/fail/skipped. */
export async function runProvisioningSelfTest(): Promise<SelfTestResult> {
  const emailProvider = (env("EMAIL_PROVIDER") || "ses");
  const [groq, cf, r2, brevo] = await Promise.all([
    checkGroq(),
    checkCloudflare(),
    checkR2(),
    checkBrevo(emailProvider),
  ]);
  const checks = [groq, cf, r2, ...brevo];
  return { ran_at: new Date().toISOString(), summary: summarize(checks), checks };
}
