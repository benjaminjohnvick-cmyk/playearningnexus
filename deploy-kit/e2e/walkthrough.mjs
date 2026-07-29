#!/usr/bin/env node
// ============================================================================
//  deploy-kit/e2e/walkthrough.mjs — automated "act like a user" site walkthrough.
//
//  A headless browser logs in as the demo reviewer and visits EVERY app route,
//  catching the functional errors a person would hit clicking around: pages that
//  throw, server 500s, uncaught console/JS errors, and React error boundaries.
//  No AI needed — this is deterministic and launchable by anyone.
//
//  It FINDS issues (and screenshots them). It does NOT auto-fix — fixing needs
//  judgment (a human, or a reviewed AI pass). See CODE-AUDITOR.md for that line.
//
//  Prereq: a running sandbox (bash deploy-kit/sandbox.sh) and Playwright:
//     npm i -D playwright        (browsers download once; skip with your CI cache)
//  Usage:  APP_URL=http://localhost:4173 node deploy-kit/e2e/walkthrough.mjs
//    APP_URL      app origin (default http://localhost:4173)
//    ROUTES_MAX   cap routes checked (default: all)
//  Exit: 0 if every route rendered without a hard error; 1 otherwise.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const APP = (process.env.APP_URL || 'http://localhost:4173').replace(/\/$/, '');
const OUT = path.join(REPO, 'deploy-kit', 'e2e', 'artifacts');
fs.mkdirSync(OUT, { recursive: true });

// --- Extract the route list straight from the app's router (source of truth) ---
function routes() {
  const app = fs.readFileSync(path.join(REPO, 'src', 'App.jsx'), 'utf8');
  const found = new Set(['/']);
  for (const m of app.matchAll(/path=["'`](\/[A-Za-z0-9_\/-]*)["'`]/g)) {
    const p = m[1];
    if (p.includes(':') || p.includes('*')) continue;         // skip param/wildcard routes
    found.add(p);
  }
  let list = [...found];
  const max = Number(process.env.ROUTES_MAX) || 0;
  if (max > 0) list = list.slice(0, max);
  return list;
}

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.error("Playwright not installed. Run:  npm i -D playwright\n(browsers download once)."); process.exit(2); }

const ROUTES = routes();
console.log(`\nSite walkthrough — ${APP} — ${ROUTES.length} routes\n${'-'.repeat(56)}`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

// Try the demo login so authenticated routes render as a real user would see them.
try {
  await page.goto(`${APP}/ReviewerLogin`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500); // let the demo login call + redirect settle
  console.log('  (demo login attempted via /ReviewerLogin)');
} catch { console.log('  (could not reach /ReviewerLogin — checking public routes)'); }

const results = [];
for (const route of ROUTES) {
  const consoleErrors = [];
  const serverErrors = [];
  const onConsole = (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); };
  const onPageErr = (err) => consoleErrors.push('JS: ' + String(err).slice(0, 200));
  const onResp = (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url().replace(APP, '')}`); };
  page.on('console', onConsole); page.on('pageerror', onPageErr); page.on('response', onResp);

  let boundary = false, navOk = true;
  try {
    await page.goto(`${APP}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(700);
    const body = (await page.textContent('body').catch(() => '')) || '';
    boundary = /something went wrong|application error|unexpected error|this page (crashed|failed)/i.test(body);
  } catch { navOk = false; }

  page.off('console', onConsole); page.off('pageerror', onPageErr); page.off('response', onResp);
  const failed = !navOk || boundary || serverErrors.length > 0 || consoleErrors.length > 0;
  if (failed) {
    const shot = path.join(OUT, 'fail_' + route.replace(/\W+/g, '_').replace(/^_|_$/g, '') + '.png');
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    results.push({ route, navOk, boundary, serverErrors, consoleErrors, shot });
    console.log(`  ✗ ${route}` +
      (!navOk ? ' [no-load]' : '') + (boundary ? ' [error-boundary]' : '') +
      (serverErrors.length ? ` [5xx: ${serverErrors.length}]` : '') +
      (consoleErrors.length ? ` [console: ${consoleErrors.length}]` : ''));
  } else {
    console.log(`  ✓ ${route}`);
  }
}

await browser.close();

const failures = results.length;
fs.writeFileSync(path.join(OUT, 'walkthrough-report.json'),
  JSON.stringify({ app: APP, checked: ROUTES.length, failures, results }, null, 2));
console.log('-'.repeat(56));
console.log(`${ROUTES.length - failures}/${ROUTES.length} routes OK; ${failures} with issues.`);
if (failures) console.log(`Report + screenshots: deploy-kit/e2e/artifacts/`);
console.log('NOTE: this FINDS issues; it does not auto-fix. Fix logic/money by hand or a reviewed AI pass.');
process.exit(failures ? 1 : 0);
