#!/usr/bin/env node
// e2e-smoke — one command that walks the critical path against a LIVE backend and checks each
// step responds, so nobody has to click through signup → survey credit → store order → payout by hand.
//   BACKEND_URL=https://your-backend node deploy-kit/e2e-smoke.mjs
// Node 18+ (built-in fetch). Read-only-ish: it creates one throwaway test user.
const BASE = (process.env.BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
const stamp = process.env.SMOKE_STAMP || 'x';            // pass a unique stamp per run to avoid dupes
const email = `smoke+${stamp}@example.com`;
let token = null, pass = 0, fail = 0;

const H = () => ({ 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) });
async function step(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name} — ${e.message}`); fail++; }
}
const jassert = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log(`\nE2E smoke — ${BASE}\n` + '-'.repeat(52));

await step('backend /health is green', async () => {
  const r = await fetch(`${BASE}/health`); const j = await r.json();
  jassert(r.ok && j.ok, `health ${r.status}`);
});
await step('signup creates an account', async () => {
  const r = await fetch(`${BASE}/auth/signup`, { method: 'POST', headers: H(), body: JSON.stringify({ email, password: 'Smoke!12345', full_name: 'Smoke Test' }) });
  const j = await r.json().catch(() => ({}));
  jassert(r.ok || r.status === 409, `signup ${r.status}`);      // 409 = already exists (re-run) is fine
  if (j.token) token = j.token;
});
await step('login returns a token', async () => {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: H(), body: JSON.stringify({ email, password: 'Smoke!12345' }) });
  const j = await r.json(); jassert(r.ok && j.token, `login ${r.status}`); token = j.token;
});
await step('auth/me returns the user', async () => {
  const r = await fetch(`${BASE}/auth/me`, { headers: H() });
  const j = await r.json(); jassert(r.ok && (j.email || j.id), `me ${r.status}`);
});
await step('entities read works (surveys list)', async () => {
  const r = await fetch(`${BASE}/entities/PPCSurvey/filter`, { method: 'POST', headers: H(), body: JSON.stringify({ query: {}, limit: 1 }) });
  jassert(r.ok, `entities ${r.status}`);
});
await step('store order endpoint is reachable', async () => {
  // Expect a controlled 4xx (bad/empty input) not a 5xx — proves the route + validation are alive.
  const r = await fetch(`${BASE}/functions/placeStoreOrder`, { method: 'POST', headers: H(), body: JSON.stringify({}) });
  jassert(r.status < 500, `placeStoreOrder ${r.status}`);
});
await step('payout endpoint is reachable', async () => {
  const r = await fetch(`${BASE}/functions/requestPayout`, { method: 'POST', headers: H(), body: JSON.stringify({}) });
  jassert(r.status < 500, `requestPayout ${r.status}`);
});

console.log('-'.repeat(52));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
