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

// Free stack (drives AI/media/email to $0).
await check('Groq (LLM+STT)', 'GROQ_API_KEY', async k => ok(await fetch('https://api.groq.com/openai/v1/models', { headers: { authorization: `Bearer ${k}` } })));
await check('Cloudflare (image)', 'CLOUDFLARE_API_TOKEN', async k => { const acct = g('CLOUDFLARE_ACCOUNT_ID'); if (!acct) return false; const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/tokens/verify`, { headers: { authorization: `Bearer ${k}` } }); return r.status !== 401 && r.status !== 403; });
await check('Brevo (email)', 'BREVO_API_KEY', async k => { const r = await fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': k } }); return r.status !== 401; });
// Managed fallbacks / other providers.
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
for (const r of rows) console.log(`  ${r.status.padEnd(6)} ${r.provider.padEnd(18)} ${r.note}`);
const bad = rows.filter(r => ['FAIL', 'ERR', 'MISSING'].includes(r.status));

// Cost-floor readout — which capabilities are running free vs falling back to paid.
const aws = !!g('AWS_ACCESS_KEY_ID');
const line = (label, free, freeText, paidText) => `  ${label.padEnd(20)} ${free ? '\x1b[1;32m' + freeText + '\x1b[0m' : '\x1b[1;33m' + paidText + '\x1b[0m'}`;
console.log('\nCost at the floor\n' + '-'.repeat(52));
console.log(line('AI + speech-to-text', !!g('GROQ_API_KEY'), 'Groq free tier — $0', 'no GROQ_API_KEY → OpenAI (paid)'));
console.log(line('Image generation', !!(g('CLOUDFLARE_ACCOUNT_ID') && g('CLOUDFLARE_API_TOKEN')), 'Cloudflare free — $0', 'no CF creds → Bedrock/Titan (~$0.01/img)'));
console.log(line('Email', !!g('BREVO_API_KEY') || aws, g('BREVO_API_KEY') ? 'Brevo free ~9k/mo' : 'Amazon SES ~$0.10/1k', 'set BREVO_API_KEY (free) or AWS creds'));
console.log(line('Voice (TTS)', true, aws ? 'Polly free tier / device voice' : 'free device voice', ''));
console.log('  \x1b[2m→ AI/media/email $0/mo on free tiers; only recurring cost is hosting (~$5–20/mo).\x1b[0m');

console.log('-'.repeat(52));
console.log(bad.length ? `\n${bad.length} item(s) need attention before deploy.` : `\nAll configured keys valid. ✓`);
process.exit(bad.length ? 1 : 0);
