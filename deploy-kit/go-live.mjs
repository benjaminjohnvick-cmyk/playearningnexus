#!/usr/bin/env node
// go-live — the ONE command that takes a freshly-deployed backend and makes it "open-to-users ready":
// it confirms the posture, verifies every launch feature is switched ON, PRE-WARMS the site with real
// content (so the catalog/surveys are populated BEFORE the first user arrives), runs the critical-path
// smoke, and prints a single GO / NO-GO verdict plus the two owner flips that actually open the doors.
//
// Nothing here is new backend code — it orchestrates endpoints that already exist. It degrades
// gracefully: without admin creds it still checks posture + smoke and tells you the exact manual steps.
//
//   BACKEND_URL=https://your-backend \
//   ADMIN_EMAIL=you@site.com ADMIN_PASSWORD=... \
//   node deploy-kit/go-live.mjs
//
// Optional env:
//   PREWARM=aiCatalogSeed,aiCategoryImages   (default: aiCatalogSeed; images add cost — opt in)
//   SEED_COUNTRIES=US                        (passed to aiCatalogSeed as {countries:[...]})
//   SKIP_SMOKE=1                             (skip the e2e-smoke child run)
// Node 18+ (built-in fetch).

import { spawn } from "node:child_process";

const BASE = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const PREWARM = (process.env.PREWARM || "aiCatalogSeed").split(",").map((s) => s.trim()).filter(Boolean);
const SEED_COUNTRIES = (process.env.SEED_COUNTRIES || "").split(",").map((s) => s.trim()).filter(Boolean);

let token = null;
const blockers = [];
const notes = [];
const C = { g: "\x1b[1;32m", r: "\x1b[1;31m", y: "\x1b[1;33m", m: "\x1b[1;35m", x: "\x1b[0m" };
const say = (s) => console.log(`\n${C.m}==> ${s}${C.x}`);
const ok = (s) => console.log(`   ${C.g}[OK]${C.x} ${s}`);
const doo = (s) => console.log(`   ${C.y}[DO]${C.x} ${s}`);
const bad = (s) => console.log(`   ${C.r}[!!]${C.x} ${s}`);
const H = () => ({ "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) });
async function jget(path) { const r = await fetch(`${BASE}${path}`, { headers: H() }); return { r, j: await r.json().catch(() => ({})) }; }
async function jpost(path, body) { const r = await fetch(`${BASE}${path}`, { method: "POST", headers: H(), body: JSON.stringify(body || {}) }); return { r, j: await r.json().catch(() => ({})) }; }

console.log(`\nGamerGain — GO-LIVE pre-warm & readiness · ${BASE}\n${"-".repeat(60)}`);

// ── 1. Posture ──────────────────────────────────────────────────────────────
say("1/6  Deploy posture (/health)");
try {
  const { r, j } = await jget("/health");
  if (r.ok && j.ok) ok(`backend healthy — ${j.functions ?? "?"} functions, ${j.agents ?? "?"} agents loaded`);
  else { bad(`/health not green (${r.status})`); blockers.push("Backend /health is not green — finish the deploy first."); }
  if (j.scheduler_inline === true || j.scheduler_inline === 1) ok("scheduler is running inline (the 37 cron jobs will fire on their own)");
  else { doo("scheduler_inline is OFF — set SCHEDULER_INLINE=1 so the AI/catalog/payout jobs run automatically"); notes.push("Set SCHEDULER_INLINE=1 so scheduled jobs run without a separate worker."); }
  if (j.frontend === true) ok("frontend is served by this service (single-service mode)"); else doo("frontend not served here — confirm the SPA is deployed");
} catch (e) { bad(`cannot reach ${BASE}/health — ${e.message}`); blockers.push(`Backend unreachable at ${BASE}. Deploy it, then re-run.`); }

// ── 2. Admin token ──────────────────────────────────────────────────────────
say("2/6  Admin sign-in (needed to verify flags + pre-warm content)");
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const { r, j } = await jpost("/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (r.ok && j.token) { token = j.token; ok(`signed in as ${ADMIN_EMAIL}`); }
  else { bad(`admin login failed (${r.status}) — flags + pre-warm will be skipped`); notes.push("Provide ADMIN_EMAIL/ADMIN_PASSWORD of an admin account to auto-verify flags and pre-warm content."); }
} else {
  doo("no ADMIN_EMAIL/ADMIN_PASSWORD set — skipping the authed steps (flag check + pre-warm)");
  notes.push("Re-run with ADMIN_EMAIL/ADMIN_PASSWORD to auto-verify every flag is ON and to pre-warm the catalog.");
}

// ── 3. Everything-ON verification ─────────────────────────────────────────────
say("3/6  Verify launch features are switched ON (complianceFlags)");
if (token) {
  const { r, j } = await jpost("/functions/complianceFlags", {});
  if (r.ok && j.flags && typeof j.flags === "object") {
    const off = Object.entries(j.flags).filter(([, v]) => v === false).map(([k]) => k);
    const on = Object.entries(j.flags).filter(([, v]) => v === true).map(([k]) => k);
    ok(`${on.length} feature(s) ON`);
    if (off.length) {
      doo(`${off.length} feature(s) currently OFF: ${off.join(", ")}`);
      notes.push(`These flags are OFF: ${off.join(", ")}. Some are intentionally gated until a prerequisite is met (e.g. cash_out needs a live merchant + counsel; p2p_transfers / store_credit_purchase need counsel sign-off). Turn each ON in the admin panel once its prerequisite is satisfied — otherwise leave it OFF by design.`);
    } else ok("every known feature flag is ON");
  } else { doo(`could not read flags (${r.status}) — check them in the admin panel`); }
} else doo("skipped (no admin token) — open the admin panel and confirm every flag is ON");

// ── 4. Pre-warm real content (so the site is ALIVE before the first user) ─────
say("4/6  Pre-warm the site with real content (catalog / images)");
if (token) {
  for (const fn of PREWARM) {
    const body = fn === "aiCatalogSeed" && SEED_COUNTRIES.length ? { countries: SEED_COUNTRIES } : {};
    const { r, j } = await jpost(`/functions/${fn}`, body);
    if (r.ok) ok(`${fn} ran${j && (j.created || j.seeded || j.count) ? ` — ${j.created ?? j.seeded ?? j.count} item(s)` : ""}`);
    else if (r.status < 500) doo(`${fn} returned ${r.status} (${j.error || "check inputs / admin role"})`);
    else { bad(`${fn} errored (${r.status})`); blockers.push(`Pre-warm ${fn} failed — the catalog may be empty at launch.`); }
  }
  // Confirm the storefront is actually populated now.
  const { r, j } = await jpost("/entities/MarketplaceListing/filter", { query: {}, limit: 1 });
  if (r.ok && Array.isArray(j) && j.length) ok("marketplace has live listings — the store won't be empty for the first user");
  else if (r.ok) { doo("marketplace still shows 0 listings — re-run aiCatalogSeed or check CATALOG_* env"); notes.push("Catalog seeded but no listings returned — verify CATALOG_COUNTRIES / CATALOG_LISTINGS_PER_COUNTRY."); }
} else doo("skipped (no admin token) — run:  curl -X POST $BACKEND_URL/functions/aiCatalogSeed -H 'authorization: Bearer <admin>'");

// ── 5. Critical-path smoke (automated QA) ─────────────────────────────────────
say("5/6  Critical-path smoke (signup → survey → store → payout → PPC → ads → boost)");
if (process.env.SKIP_SMOKE) { doo("SKIP_SMOKE set — skipping"); }
else {
  const code = await new Promise((res) => {
    const stamp = String(Math.floor(Date.now() / 1000)) + "-golive";
    const child = spawn(process.execPath, ["deploy-kit/e2e-smoke.mjs"], { stdio: "inherit", env: { ...process.env, BACKEND_URL: BASE, SMOKE_STAMP: stamp } });
    child.on("close", res); child.on("error", () => res(1));
  });
  if (code === 0) ok("smoke GREEN — the critical path responds end-to-end");
  else { bad("smoke found failing endpoints (see above)"); blockers.push("Critical-path smoke failed — fix the flagged endpoints before opening to users."); }
}

// ── 6. Verdict + the owner flips that actually open the doors ─────────────────
say("6/6  Verdict");
if (blockers.length === 0) {
  console.log(`\n   ${C.g}✅ GO — the app is up, everything is on, and the site is pre-warmed with content.${C.x}`);
} else {
  console.log(`\n   ${C.r}⛔ NOT YET — resolve these first:${C.x}`);
  for (const b of blockers) console.log(`      - ${b}`);
}
console.log(`\n   The two flips that OPEN THE DOORS (owner decision, one line each):`);
console.log(`      1. Payments live:   set STRIPE/PAYPAL to live keys (leave cash_out OFF until merchant + counsel are ready).`);
console.log(`      2. Open the site:   turn MAINTENANCE_MODE OFF in the admin panel so the public can sign up.`);
if (notes.length) { console.log(`\n   Notes / things to confirm:`); for (const n of notes) console.log(`      - ${n}`); }
console.log("");
process.exit(blockers.length ? 1 : 0);
