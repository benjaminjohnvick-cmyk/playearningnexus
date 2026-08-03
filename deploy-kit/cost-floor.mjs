#!/usr/bin/env node
// cost-floor.mjs — one command that pins EVERY cost lever to its floor and prints the full picture.
//
//   node deploy-kit/cost-floor.mjs           (write floor values into backend/.env, then show the readout)
//   node deploy-kit/cost-floor.mjs --dry      (show what WOULD change + the readout; write nothing)
//   node deploy-kit/cost-floor.mjs --cap 5    (also set the global AI daily spend cap to $5)
//
// Nothing is turned OFF to save money — every feature stays ON. The floor comes from: free-tier providers,
// do-once caching, rules-first-before-AI, right-sized models, and revenue that offsets the tiny hosting bill.
// Every setting is env-overridable by its own key (see settings.ts), so writing these to backend/.env makes
// them take effect. Re-run any time; safe and idempotent. Pure Node 18+, zero dependencies.

import fs from "node:fs";

const ENV_PATH = process.env.ENV_PATH || "backend/.env";
const DRY = process.argv.includes("--dry");
const capIdx = process.argv.indexOf("--cap");
const CAP = capIdx > -1 ? process.argv[capIdx + 1] : null;
const C = { g: "\x1b[1;32m", y: "\x1b[1;33m", c: "\x1b[1;36m", d: "\x1b[2m", x: "\x1b[0m", b: "\x1b[1m" };

function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_PATH)) for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "").trim();
  }
  return env;
}
const env = readEnv();
const has = (k) => !!(process.env[k] || env[k]);

// The floor lever set. Each: [key, floorValue, why]. Grouped for the readout.
const LEVERS = [
  ["— Free-tier providers (AI/media/email at $0, no GPU) —"],
  ["LLM_PROVIDER", "groq", "all AI on Groq's free tier (Llama 3.1-8B / 3.3-70B)"],
  ["PROVIDER_STT", "groq", "voice transcription on Groq Whisper — same free key"],
  ["IMAGE_PROVIDER", "cloudflare", "images on Cloudflare Workers AI (FLUX-schnell) free tier"],
  ["EMAIL_PROVIDER", has("BREVO_API_KEY") ? "brevo" : "ses", "email on Brevo free ~9k/mo (else SES ~$0.10/1k)"],
  ["PROVIDER_TTS", "managed", "premium voice falls back to the device's free voice for everyone else"],
  ["— Right-sized models (cheap tier does the many simple jobs) —"],
  ["GROQ_MODEL_SMALL", "llama-3.1-8b-instant", "8B handles most calls; 70B only on model:gpt_5"],
  ["CF_IMAGE_MODEL", "@cf/black-forest-labs/flux-1-schnell", "fast, commercially-licensed, free tier"],
  ["CF_IMAGE_STEPS", "4", "FLUX-schnell sweet spot — fewer steps = faster + cheaper"],
  ["SERVICE_SUBCATEGORY_IMAGES", "0", "only top-level tiles get a GPU image (one-time), not every subsection"],
  ["— Do-once caching (repeated output never re-bills) —"],
  ["TTS_CACHE_ENABLED", "1", "survey prompts / cheers synthesize ONCE — biggest TTS cut"],
  ["TTS_CACHE_TTL_DAYS", "30", "cached audio lives 30 days"],
  ["PRODUCT_FEED_CACHE_TTL_S", "3600", "product-feed searches cached 1h so repeats don't re-bill"],
  ["— Rules-first before AI (free path handles the easy cases) —"],
  ["AUTOFILL_MATCH_MIN_CONFIDENCE", "0.5", "answers the free rules matcher resolves skip the AI entirely"],
  ["— Revenue that offsets the tiny hosting bill (stays ON) —"],
  ["SURVEY_INTERSTITIAL_ENABLED", "1", "30s own-inventory ad between surveys (non-premium) → your ad revenue"],
  ["MARKETPLACE_EQUIV_HOLD_ENABLED", "1", "inventory-free marketplace revenue: equal % held on gross surveys"],
  ["SHOPPING_EXT_ENABLED", "1", "opt-in shopping extension earns affiliate commission (backend ready)"],
];

// Apply.
const changes = [];
for (const row of LEVERS) {
  if (row.length === 1) continue;               // header
  const [k, v] = row;
  const cur = env[k];
  if (cur !== v) { changes.push([k, cur ?? "(unset)", v]); env[k] = v; }
}
if (CAP != null && env.AI_DAILY_SPEND_CAP_USD !== String(CAP)) {
  changes.push(["AI_DAILY_SPEND_CAP_USD", env.AI_DAILY_SPEND_CAP_USD ?? "(unset)", String(CAP)]);
  env.AI_DAILY_SPEND_CAP_USD = String(CAP);
}

if (!DRY && changes.length) {
  const managed = new Set([...LEVERS.filter(r => r.length > 1).map(r => r[0]), "AI_DAILY_SPEND_CAP_USD"]);
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8").split("\n") : [];
  const kept = existing.filter((l) => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=/); return !(m && managed.has(m[1])); });
  const block = LEVERS.filter(r => r.length > 1).map(([k]) => `${k}=${env[k]}`);
  if (CAP != null) block.push(`AI_DAILY_SPEND_CAP_USD=${env.AI_DAILY_SPEND_CAP_USD}`);
  const body = [...kept, "", "# ---- cost floor (cost-floor.mjs) ----", ...block].join("\n");
  fs.mkdirSync(ENV_PATH.replace(/\/[^/]+$/, "") || ".", { recursive: true });
  fs.writeFileSync(ENV_PATH, body.replace(/\n{3,}/g, "\n\n").trim() + "\n");
}

// Readout.
console.log(`\n${C.b}GamerGain — Cost Floor${C.x}  ${C.d}(${ENV_PATH})${C.x}\n${"-".repeat(60)}`);
console.log(`${C.d}Everything stays ON. The floor = free tiers + caching + rules-first + right-sized models.${C.x}`);
for (const row of LEVERS) {
  if (row.length === 1) { console.log(`\n${C.c}${row[0]}${C.x}`); continue; }
  const [k, v, why] = row;
  console.log(`  ${C.g}✓${C.x} ${k}=${C.b}${v}${C.x}  ${C.d}${why}${C.x}`);
}

console.log(`\n${C.b}Provider keys — free path vs paid fallback${C.x}`);
const pk = (label, ok, freeText, elseText) => console.log(`  ${label.padEnd(22)} ${ok ? C.g + freeText + C.x : C.y + elseText + C.x}`);
pk("AI + speech-to-text", has("GROQ_API_KEY"), "Groq free — $0", "add GROQ_API_KEY (free) → else OpenAI paid");
pk("Image generation", has("CLOUDFLARE_ACCOUNT_ID") && has("CLOUDFLARE_API_TOKEN"), "Cloudflare free — $0", "add CF creds (free) → else Bedrock ~$0.01/img");
pk("Email", has("BREVO_API_KEY") || has("AWS_ACCESS_KEY_ID"), has("BREVO_API_KEY") ? "Brevo free ~9k/mo" : "Amazon SES ~$0.10/1k", "add BREVO_API_KEY (free) or AWS creds");
pk("Shared cache (Redis)", has("REDIS_URL"), "Redis shared cache", "in-memory cache (free) — Redis optional at scale");

console.log(`\n${C.b}Guardrail${C.x}`);
console.log(has("AI_DAILY_SPEND_CAP_USD") && (process.env.AI_DAILY_SPEND_CAP_USD || env.AI_DAILY_SPEND_CAP_USD) !== "0"
  ? `  ${C.g}✓${C.x} AI_DAILY_SPEND_CAP_USD=${process.env.AI_DAILY_SPEND_CAP_USD || env.AI_DAILY_SPEND_CAP_USD}  ${C.d}hard brake — no path can exceed it${C.x}`
  : `  ${C.y}○${C.x} AI_DAILY_SPEND_CAP_USD not set ${C.d}(0 = no cap). Set a hard ceiling with:  node deploy-kit/cost-floor.mjs --cap 5${C.x}`);

console.log(`\n${C.b}Bottom line${C.x}`);
console.log(`  ${C.g}AI + images + transcription + voice + email → $0/mo${C.x} on free tiers at launch scale.`);
console.log(`  Only recurring cost is hosting ${C.b}~$5–20/mo${C.x} (Railway + Postgres). Redis optional.`);
console.log(`  ${C.d}The interstitial ad, survey hold, and shopping cashback generate revenue that offsets even that.${C.x}`);
console.log(`  ${C.d}Later, admin → ProviderAdvisor tells you IF paid volume ever makes an owned GPU cheaper.${C.x}`);

console.log(`\n${"-".repeat(60)}`);
if (DRY) console.log(`${C.y}--dry: no file written.${C.x} ${changes.length} lever(s) would change.`);
else if (changes.length) { console.log(`${C.g}✓ Pinned ${changes.length} lever(s) to the floor in ${ENV_PATH}.${C.x}`); for (const [k, was, now] of changes) console.log(`  ${C.d}${k}: ${was} → ${now}${C.x}`); }
else console.log(`${C.g}✓ Already at the floor — nothing to change.${C.x}`);
console.log(`${C.d}Next:  npm run env:check   (validate keys + see the same readout)${C.x}\n`);
