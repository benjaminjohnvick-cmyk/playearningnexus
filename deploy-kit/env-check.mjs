#!/usr/bin/env node
// env-check — validate provider keys by actually calling each provider, so a wrong/expired key
// is caught in seconds instead of during deploy debugging. Node 18+ (built-in fetch).
//   node deploy-kit/env-check.mjs [path/to/.env]     (default: backend/.env)
import fs from 'node:fs';

const envPath = process.argv[2] || 'backend/.env';
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const g = (k) => process.env[k] || env[k] || '';
const rows = [];
const add = (name, status, note) => rows.push({ provider: name, status, note });

async function check(name, key, fn) {
  if (!g(key)) return add(name, 'skip', `${key} not set`);
  try { const ok = await fn(g(key)); add(name, ok ? 'OK' : 'FAIL', ok ? 'key valid' : 'key rejected'); }
  catch (e) { add(name, 'ERR', e.message); }
}
const ok = (r) => r.ok || r.status === 200;

await check('OpenAI', 'OPENAI_API_KEY', async k => ok(await fetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${k}` } })));
await check('Anthropic', 'ANTHROPIC_API_KEY', async k => { const r = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' } }); return r.status !== 401; });
await check('Stripe', 'STRIPE_SECRET_KEY', async k => ok(await fetch('https://api.stripe.com/v1/balance', { headers: { authorization: `Bearer ${k}` } })));
await check('SendGrid', 'SENDGRID_API_KEY', async k => ok(await fetch('https://api.sendgrid.com/v3/scopes', { headers: { authorization: `Bearer ${k}` } })));
await check('BitLabs', 'BITLABS_API_KEY', async k => { const r = await fetch('https://api.bitlabs.ai/v1/client/settings', { headers: { 'X-Api-Token': k } }); return r.status !== 401 && r.status !== 403; });
await check('PayPal', 'PAYPAL_CLIENT_ID', async () => {
  const id = g('PAYPAL_CLIENT_ID'), sec = g('PAYPAL_SECRET_KEY'); if (!sec) return false;
  const r = await fetch('https://api-m.paypal.com/v1/oauth2/token', { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  return ok(r);
});

// Required-but-not-pingable presence checks
for (const [name, key] of [['Database URL', 'DATABASE_URL'], ['JWT secret', 'AUTH_JWT_SECRET'], ['S3 bucket', 'S3_BUCKET'], ['App URL', 'APP_URL']]) {
  add(name, g(key) ? 'set' : 'MISSING', g(key) ? 'present' : `${key} not set`);
}

console.log(`\nProvider / key check (${envPath})\n` + '-'.repeat(52));
for (const r of rows) console.log(`  ${r.status.padEnd(6)} ${r.provider.padEnd(14)} ${r.note}`);
const bad = rows.filter(r => ['FAIL', 'ERR', 'MISSING'].includes(r.status));
console.log('-'.repeat(52));
console.log(bad.length ? `\n${bad.length} item(s) need attention before deploy.` : `\nAll configured keys valid. ✓`);
process.exit(bad.length ? 1 : 0);
