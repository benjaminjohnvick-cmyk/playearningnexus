#!/usr/bin/env node
// setup.mjs — the terminal Setup Wizard. Walks you through the keys, writes backend/.env, auto-generates
// the secrets that can be auto-made, and verifies everything — NO AI/agent needed, just a human at a
// terminal. Pure Node 18+ (built-in fetch + crypto), zero dependencies.
//
//   node deploy-kit/setup.mjs            (interactive)
//   node deploy-kit/setup.mjs --check    (skip prompts, just validate the current .env)
//
// The AI / image / voice / email layer defaults to FREE tiers, so most prompts can be left blank at first —
// the app still runs, and you can re-run this any time to add a key and unlock its $0 path.

import fs from "node:fs";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawnSync } from "node:child_process";

const ENV_PATH = process.env.ENV_PATH || "backend/.env";
const CHECK_ONLY = process.argv.includes("--check");

const C = { g: "\x1b[1;32m", y: "\x1b[1;33m", c: "\x1b[1;36m", d: "\x1b[2m", x: "\x1b[0m", b: "\x1b[1m" };

// The key list — grouped. free:true means "leave blank to stay on a free/fallback path".
const GROUPS = [
  { title: "Core platform (required)", keys: [
    { k: "DATABASE_URL", label: "Postgres URL", hint: "Railway Postgres → Variables (auto-created)" },
    { k: "AUTH_JWT_SECRET", label: "JWT secret", hint: "auto-generated if left blank", gen: true },
    { k: "APP_URL", label: "Frontend URL", hint: "e.g. https://yourdomain.app" },
  ]},
  { title: "FREE AI stack — LLM + speech-to-text (Groq, $0)", keys: [
    { k: "GROQ_API_KEY", label: "Groq API key", hint: "FREE at https://console.groq.com — powers ALL AI + voice transcription", free: true },
  ]},
  { title: "FREE image generation (Cloudflare Workers AI, $0)", keys: [
    { k: "CLOUDFLARE_ACCOUNT_ID", label: "Cloudflare account ID", hint: "FREE at https://dash.cloudflare.com", free: true },
    { k: "CLOUDFLARE_API_TOKEN", label: "Cloudflare API token", hint: "token with the 'Workers AI' permission", free: true },
  ]},
  { title: "Email (Brevo free ~9k/mo, or Amazon SES ~$0.10/1k)", keys: [
    { k: "EMAIL_FROM", label: "From address", hint: "a verified sender" },
    { k: "BREVO_API_KEY", label: "Brevo API key", hint: "FREE ~9k/mo at https://www.brevo.com (then set EMAIL_PROVIDER=brevo)", free: true },
  ]},
  { title: "AWS — enables SES email, Polly voice, S3 uploads (optional)", keys: [
    { k: "AWS_ACCESS_KEY_ID", label: "AWS access key", hint: "IAM user with SES/Polly/S3", free: true },
    { k: "AWS_SECRET_ACCESS_KEY", label: "AWS secret key", hint: "", free: true },
    { k: "S3_BUCKET", label: "S3 bucket", hint: "for uploads + generated images", free: true },
  ]},
  { title: "Survey network (BitLabs — the launch network)", keys: [
    { k: "BITLABS_API_KEY", label: "BitLabs API key", hint: "https://dashboard.bitlabs.ai", free: true },
  ]},
  { title: "Optional", keys: [
    { k: "REDIS_URL", label: "Redis URL", hint: "share the TTS/translation cache across instances", free: true },
    { k: "OPENAI_API_KEY", label: "OpenAI key", hint: "optional fallback for AI/voice", free: true },
  ]},
];

function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_PATH)) for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
function writeEnv(env) {
  // Preserve any lines we don't manage; upsert the ones we do.
  const managed = new Set(GROUPS.flatMap((g) => g.keys.map((x) => x.k)).concat(["LLM_PROVIDER", "PROVIDER_STT", "IMAGE_PROVIDER", "EMAIL_PROVIDER", "PROVIDER_TTS", "TTS_CACHE_ENABLED"]));
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8").split("\n") : [];
  const kept = existing.filter((l) => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=/); return !(m && managed.has(m[1])); });
  const lines = [];
  for (const [k, v] of Object.entries(env)) lines.push(`${k}=${v ?? ""}`);
  const body = [...kept.filter((l) => l.trim() && !l.startsWith("#") ? true : l.trim() === "" ? false : true), "", "# ---- written by setup.mjs ----", ...lines].join("\n");
  fs.mkdirSync(ENV_PATH.replace(/\/[^/]+$/, "") || ".", { recursive: true });
  fs.writeFileSync(ENV_PATH, body.replace(/\n{3,}/g, "\n\n").trim() + "\n");
}

async function run() {
  console.log(`\n${C.b}GamerGain — Setup Wizard (terminal)${C.x}\n${"-".repeat(52)}`);
  console.log(`${C.d}Writes ${ENV_PATH}. Leave a FREE-tier item blank to keep its $0 fallback; re-run any time.${C.x}`);
  const env = readEnv();

  if (!CHECK_ONLY) {
    const rl = readline.createInterface({ input, output });
    for (const group of GROUPS) {
      console.log(`\n${C.c}${group.title}${C.x}`);
      for (const key of group.keys) {
        const cur = env[key.k] || "";
        const shown = cur ? `${C.g}[set]${C.x}` : (key.free ? `${C.y}[free-tier / optional]${C.x}` : `${C.y}[required]${C.x}`);
        const tag = key.hint ? ` ${C.d}(${key.hint})${C.x}` : "";
        const ans = (await rl.question(`  ${key.label} ${shown}${tag}\n    ${key.k}=`)).trim();
        if (ans) env[key.k] = ans;
        else if (!cur && key.gen) { env[key.k] = crypto.randomBytes(48).toString("base64"); console.log(`    ${C.g}auto-generated.${C.x}`); }
      }
    }
    await rl.close();

    // Set the free-stack routing defaults (only if not already chosen).
    env.LLM_PROVIDER ||= env.GROQ_API_KEY ? "groq" : "openai";
    env.PROVIDER_STT ||= env.GROQ_API_KEY ? "groq" : "managed";
    env.IMAGE_PROVIDER ||= (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) ? "cloudflare" : "aws_bedrock";
    env.EMAIL_PROVIDER ||= env.BREVO_API_KEY ? "brevo" : "ses";
    env.PROVIDER_TTS ||= "managed";
    env.TTS_CACHE_ENABLED ||= "1";

    writeEnv(env);
    console.log(`\n${C.g}✓ Wrote ${ENV_PATH}.${C.x}`);
  }

  // Cost-floor readout.
  const free = (k) => !!(env[k] || process.env[k]);
  console.log(`\n${C.b}Cost at the floor${C.x}`);
  console.log(`  AI + speech-to-text : ${free("GROQ_API_KEY") ? `${C.g}Groq free tier — $0${C.x}` : `${C.y}not set → falls back to OpenAI (paid)${C.x}`}`);
  console.log(`  Image generation    : ${free("CLOUDFLARE_ACCOUNT_ID") && free("CLOUDFLARE_API_TOKEN") ? `${C.g}Cloudflare free — $0${C.x}` : `${C.y}not set → falls back to Bedrock/Titan (~$0.01/img)${C.x}`}`);
  console.log(`  Email               : ${free("BREVO_API_KEY") ? `${C.g}Brevo free ~9k/mo${C.x}` : free("AWS_ACCESS_KEY_ID") ? `${C.g}Amazon SES ~$0.10/1k${C.x}` : `${C.y}set BREVO_API_KEY (free) or AWS creds (SES)${C.x}`}`);
  console.log(`  Voice (TTS)         : ${free("AWS_ACCESS_KEY_ID") ? `${C.g}Polly free tier available${C.x}` : `${C.g}free device voice${C.x}`}`);
  console.log(`  Shared cache        : ${free("REDIS_URL") ? `${C.g}Redis${C.x}` : `${C.g}in-memory (free) — Redis optional${C.x}`}`);
  console.log(`  ${C.d}Applied in code (no key): do-once caching, rules-first-before-AI, 8B cheap-model default,${C.x}`);
  console.log(`  ${C.d}FLUX 4-step images, self-host advisor. Revenue offsets (interstitial, survey hold, shopping) cover hosting.${C.x}`);
  console.log(`  ${C.d}→ AI/media/email $0/mo on free tiers. Only recurring cost is hosting (~$5–20/mo).${C.x}`);
  console.log(`  ${C.c}Pin EVERY cost lever to the floor:${C.x} run  ${C.b}npm run cost:floor${C.x}  ${C.d}(adds a spend cap with --cap 5).${C.x}`);

  // Live key validation (reuses env-check).
  console.log(`\n${C.b}Verifying keys…${C.x}`);
  const res = spawnSync(process.execPath, ["deploy-kit/env-check.mjs", ENV_PATH], { stdio: "inherit" });
  console.log(`\n${C.d}Next: load the DB schema (backend/db/schema.sql), then run  bash deploy-kit/launch.sh  to deploy.${C.x}`);
  process.exit(res.status || 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
