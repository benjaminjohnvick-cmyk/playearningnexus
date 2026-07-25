#!/usr/bin/env node
// gen-screenshots — capture the store screenshots automatically by loading the live app at each
// required device size, instead of taking them by hand. Outputs PNGs fastlane can upload.
//   APP_URL=https://your-app  node deploy-kit/mobile/gen-screenshots.mjs
// Requires Playwright:  npm i -D playwright  (then `npx playwright install chromium` once)
import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const OUT = 'fastlane/screenshots';
// The key screens reviewers and users see first.
const screens = [
  { name: '1-home', path: '/' },
  { name: '2-surveys', path: '/Surveys' },
  { name: '3-games', path: '/Games' },
  { name: '4-store', path: '/InAppGameStore' },
  { name: '5-wallet', path: '/Wallet' },
];
// Required device frames: phone + tablet (portrait). Sizes satisfy both stores' minimums.
const devices = [
  { name: 'phone', width: 1080, height: 1920, scale: 3 },
  { name: 'tablet', width: 1600, height: 2560, scale: 2 },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let n = 0;
for (const d of devices) {
  const ctx = await browser.newContext({ viewport: { width: Math.round(d.width / d.scale), height: Math.round(d.height / d.scale) }, deviceScaleFactor: d.scale });
  const page = await ctx.newPage();
  for (const s of screens) {
    try {
      await page.goto(APP + s.path, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);
      const file = `${OUT}/${d.name}-${s.name}.png`;
      await page.screenshot({ path: file, fullPage: false });
      console.log('  ✓', file); n++;
    } catch (e) { console.log('  ✗', d.name, s.name, '—', e.message); }
  }
  await ctx.close();
}
await browser.close();
console.log(`\nCaptured ${n} screenshots into ${OUT}/  (fastlane will upload these).`);
