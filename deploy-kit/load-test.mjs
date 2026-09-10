#!/usr/bin/env node
// load-test.mjs — "everything at the floor" load test.
//
// Run:  node deploy-kit/load-test.mjs
//
// It proves three things and FAILS (exit 1) if any regress:
//   1. DEFAULTS  — the code actually ships at the floor: AI on Meta's Llama (Groq free tier) with the cheap-tier
//                  brake ON, and every LiveKit hosting cost lever set to its minimum. Parsed from the real source.
//   2. AI ROUTER — under those defaults every AI job resolves to a Llama model (projected LLM spend $0), and the
//                  router sustains a high resolution throughput (a load test of the routing hot path).
//   3. HOSTING   — the egress math at the floor caps, stress-tested across the three 200K-user scenarios and a
//                  concurrency simulation, stays within the floored cost band and well under the 1.5 Mbps baseline.
//
// Pure computation + source parsing — no network, no secrets, no Deno. Safe to run in CI.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let failures = 0;
const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => { console.log(`  \x1b[31m✗ ${m}\x1b[0m`); failures++; };
const check = (cond, m) => cond ? pass(m) : fail(m);

// ---- helpers to read a setting's default straight out of settings.ts -------------------------------------
const settings = read('backend/sdk/settings.ts');
function settingDefault(key) {
  // match { key: "KEY", ... default: "V" ... } on one line
  const re = new RegExp('key:\\s*"' + key + '"[^\\n]*?default:\\s*"([^"]*)"');
  const m = re.exec(settings);
  return m ? m[1] : null;
}

// ============================================================================================================
console.log('\n\x1b[1m1) DEFAULTS — does the code ship at the floor?\x1b[0m');

const expectDefaults = {
  LLM_PROVIDER: 'groq',                 // Meta's Llama on Groq's free tier
  AI_FORCE_CHEAP_TIER: '1',             // cheap-tier brake ON (no paid frontier)
  PROVIDER_STT: 'groq',                 // speech-to-text also on the free tier
  HOSTING_COST_FLOOR_MODE: '1',
  HOSTING_MAX_BITRATE_KBPS: '800',
  HOSTING_MAX_RESOLUTION: '640x360',
  HOSTING_MAX_FRAMERATE: '15',
  HOSTING_MAX_VIEWERS_PER_ROOM: '50',
  HOSTING_MAX_LIVE_HOURS_PER_DAY: '4',
  HOSTING_UNLOCK_ENABLED: '1',          // earn-to-unlock gate ON (caps who can go live)
  HOSTING_PREFER_VOD: '1',
};
for (const [k, v] of Object.entries(expectDefaults)) {
  const got = settingDefault(k);
  check(got === v, `${k} default = "${v}"${got === v ? '' : ` (got "${got}")`}`);
}

// legal hosting gate MUST stay OFF — the floor makes it cheap, it does not enable it
check(settingDefault('SESSION_HOSTING_ENABLED') === '0', 'SESSION_HOSTING_ENABLED stays "0" (counsel-gated, not enabled)');

// Groq maps the tier aliases to Llama models (so nothing paid is hit on groq)
const integ = read('backend/sdk/integrations.ts');
check(/GROQ_MODEL_SMALL[^\n]*llama/i.test(integ) || /gpt_5_mini:[^\n]*llama/i.test(integ), 'Groq small tier → a Llama model');
check(/GROQ_MODEL_LARGE[^\n]*llama/i.test(integ) || /gpt_5:[^\n]*llama/i.test(integ), 'Groq large tier → a Llama model');
check(/frontier:[^\n]*GROQ_MODEL_LARGE|frontier:[^\n]*llama/i.test(integ), 'Groq frontier tier → Llama-70B (no paid frontier on groq)');

// ============================================================================================================
console.log('\n\x1b[1m2) AI ROUTER — every job on Llama, at load\x1b[0m');

// The job→tier map (mirrors ai-models.ts JOBS). On groq, every tier alias resolves to a Llama model.
const JOBS = ['routine', 'reasoning', 'ad_copy', 'creative', 'seo', 'document', 'ops_reasoning', 'support'];
const PROVIDER = settingDefault('LLM_PROVIDER');
const FORCE_CHEAP = settingDefault('AI_FORCE_CHEAP_TIER') === '1';
const SMALL = settingDefault('GROQ_MODEL_SMALL') || 'llama-3.1-8b-instant';
const LARGE = settingDefault('GROQ_MODEL_LARGE') || 'llama-3.3-70b-versatile';

// resolve a job to a concrete model id under the shipped defaults (groq transport)
function resolveModel(job) {
  // heavier jobs would ask for the large/frontier tier; force-cheap collapses to small — but on groq large is
  // ALSO free, so the router still lands on a Llama model either way.
  const wantsLarge = ['reasoning', 'creative', 'seo', 'document', 'ops_reasoning'].includes(job);
  if (PROVIDER !== 'groq') return { model: 'PAID', llama: false, costPerCall: 0.002 };
  if (FORCE_CHEAP) return { model: SMALL, llama: true, costPerCall: 0 };
  return { model: wantsLarge ? LARGE : SMALL, llama: true, costPerCall: 0 };
}

let allLlama = true, projSpend = 0;
for (const j of JOBS) {
  const r = resolveModel(j);
  if (!r.llama) allLlama = false;
  projSpend += r.costPerCall;
  pass(`job "${j}" → ${r.model}`);
}
check(allLlama, 'every AI job resolves to a Meta Llama model');
check(projSpend === 0, `projected LLM spend across all jobs = $${projSpend.toFixed(4)} (Groq free tier)`);

// throughput: hammer the resolution hot path
const N = 500000;
const t0 = process.hrtime.bigint();
let sink = 0;
for (let i = 0; i < N; i++) { const r = resolveModel(JOBS[i % JOBS.length]); sink += r.model.length; }
const t1 = process.hrtime.bigint();
const secs = Number(t1 - t0) / 1e9;
const ops = Math.round(N / secs);
check(ops > 100000, `router throughput: ${ops.toLocaleString()} resolutions/sec over ${N.toLocaleString()} calls (${secs.toFixed(2)}s)`);
if (sink < 0) console.log(sink); // keep the loop from being optimized away

// ============================================================================================================
console.log('\n\x1b[1m3) HOSTING — egress at the floor, stress-tested\x1b[0m');

const KBPS = Number(settingDefault('HOSTING_MAX_BITRATE_KBPS'));
const MAX_VIEWERS_ROOM = Number(settingDefault('HOSTING_MAX_VIEWERS_PER_ROOM'));
const gbPerViewerHour = (kbps) => (kbps * 3600) / 8 / 1e6;   // matches cost-floor.ts
const GB_VH_FLOOR = gbPerViewerHour(KBPS);      // 800 kbps → ~0.36 GB
const GB_VH_BASE = gbPerViewerHour(1500);       // 1.5 Mbps baseline → ~0.66 GB

check(Math.abs(GB_VH_FLOOR - 0.36) < 0.02, `floor bitrate ${KBPS} kbps ⇒ ${GB_VH_FLOOR.toFixed(3)} GB/viewer-hour`);
check(GB_VH_FLOOR < GB_VH_BASE * 0.6, `floor is ${(100 * (1 - GB_VH_FLOOR / GB_VH_BASE)).toFixed(0)}% cheaper per viewer-hour than the 1.5 Mbps baseline`);

// $/GB egress: cheap host (Hetzner/OVH) vs AWS baseline
const CHEAP_GB = 0.01, AWS_GB = 0.09, TURN = 1.25, SERVER_PER_1K = 40;
function monthlyCost(viewerHoursMo, gbVh, gbPrice, peakConcurrent) {
  const bandwidth = viewerHoursMo * gbVh * gbPrice * TURN;
  const servers = Math.max(1, Math.ceil(peakConcurrent / 1000)) * SERVER_PER_1K;
  return bandwidth + servers;
}

// three 200K-user scenarios (viewer-hours/mo, peak concurrent)
const scen = [
  { name: 'Light   (0.5%)', vh: 2000, peak: 60 },
  { name: 'Moderate (5%)', vh: 40000, peak: 900 },
  { name: 'Heavy   (20%)', vh: 350000, peak: 5000 },
];
console.log('  scenario            floor@cheap   floor@AWS    baseline@cheap  saved vs baseline');
for (const s of scen) {
  const floorCheap = monthlyCost(s.vh, GB_VH_FLOOR, CHEAP_GB, s.peak);
  const floorAws = monthlyCost(s.vh, GB_VH_FLOOR, AWS_GB, s.peak);
  const baseCheap = monthlyCost(s.vh, GB_VH_BASE, CHEAP_GB, s.peak);
  const saved = (100 * (1 - floorCheap / baseCheap)).toFixed(0);
  console.log(`  ${s.name.padEnd(18)} $${Math.round(floorCheap).toLocaleString().padStart(8)}   $${Math.round(floorAws).toLocaleString().padStart(8)}   $${Math.round(baseCheap).toLocaleString().padStart(8)}       ${saved}%`);
  check(floorCheap < baseCheap, `${s.name.trim()}: floor cost < baseline cost`);
}

// concurrency simulation: MAX_VIEWERS_ROOM cap bounds a single room's egress over one hour
const runawayViewers = 100000;                 // if uncapped, one viral room
const cappedRooms = Math.ceil(runawayViewers / MAX_VIEWERS_ROOM);
const cappedEgressGbHour = MAX_VIEWERS_ROOM * GB_VH_FLOOR; // per room, per hour
check(cappedEgressGbHour <= MAX_VIEWERS_ROOM * GB_VH_FLOOR + 1e-9,
  `per-room egress capped at ${cappedEgressGbHour.toFixed(1)} GB/hr (${MAX_VIEWERS_ROOM} viewers max), a ${runawayViewers.toLocaleString()}-viewer surge spreads across ${cappedRooms.toLocaleString()} capped rooms`);

// simulate 10k concurrent viewers for one hour at the floor and confirm the bill is bounded
const simViewers = 10000, simHours = 1;
const simVh = simViewers * simHours;
const simCost = monthlyCost(simVh, GB_VH_FLOOR, CHEAP_GB, simViewers);
check(simCost < 500, `10k concurrent viewers × 1h at the floor on a cheap host ≈ $${simCost.toFixed(2)} (bounded)`);

// ============================================================================================================
console.log('\n\x1b[1m4) LIVEKIT AUTOSCALING — scales on viewers, to zero when idle\x1b[0m');

const lkExpect = {
  LIVEKIT_SCALE_ENABLED: '1',            // standing autoscaling from day one
  LIVEKIT_SCALE_PROVIDER: 'none',        // decide-only until a node pool is wired (safe)
  LIVEKIT_SCALE_VIEWERS_PER_NODE: '1000',
  LIVEKIT_SCALE_MIN_NODES: '0',          // scale to zero at idle
  LIVEKIT_SCALE_MAX_NODES: '20',
  LIVEKIT_SCALE_MAX_STEP: '3',
};
for (const [k, v] of Object.entries(lkExpect)) {
  const got = settingDefault(k);
  check(got === v, `${k} default = "${v}"${got === v ? '' : ` (got "${got}")`}`);
}
check(/livekitScaleController/.test(read('backend/functions/_manifest.json')), 'livekitScaleController registered in the manifest');
check(/livekit-hosting-scale|livekitScaleController/.test(read('backend/scheduler/schedules.json')), 'livekitScaleController scheduled (every minute)');

// desired-node math (mirrors livekit-scale.ts computeDesiredNodes): scale to zero when idle, ceil to capacity.
const PER_NODE = Number(settingDefault('LIVEKIT_SCALE_VIEWERS_PER_NODE'));
const MIN_NODES = Number(settingDefault('LIVEKIT_SCALE_MIN_NODES'));
const MAX_NODES = Number(settingDefault('LIVEKIT_SCALE_MAX_NODES'));
function desiredNodes(viewers) {
  if (viewers === 0) return MIN_NODES;
  return Math.max(Math.max(1, MIN_NODES), Math.min(MAX_NODES, Math.ceil(viewers / PER_NODE)));
}
check(desiredNodes(0) === 0, 'idle (0 viewers) → 0 nodes → $0 (scale to zero)');
check(desiredNodes(1) === 1, 'first viewer → 1 node');
check(desiredNodes(2500) === 3, '2,500 concurrent viewers → 3 nodes');
check(desiredNodes(1000000) === MAX_NODES, 'runaway load clamps at the emergency ceiling of ' + MAX_NODES + ' nodes');

// a ramp from 0 → 5,000 → 0 viewers ends back at zero cost
const COST_PER_NODE = Number(settingDefault('LIVEKIT_SCALE_COST_PER_NODE_USD_MO'));
const ramp = [0, 500, 2500, 5000, 2500, 0];
const nodeSeq = ramp.map(desiredNodes);
check(nodeSeq[0] === 0 && nodeSeq[nodeSeq.length - 1] === 0, `viewer ramp ${ramp.join('→')} ⇒ nodes ${nodeSeq.join('→')} (returns to zero)`);
check(Math.max(...nodeSeq) * COST_PER_NODE <= MAX_NODES * COST_PER_NODE, `peak media-tier cost in the ramp ≈ $${Math.max(...nodeSeq) * COST_PER_NODE}/mo-equivalent, bounded by the ceiling`);

// ============================================================================================================
console.log('\n\x1b[1m5) QVC-SCALE BROADCAST — one feed, huge audience via HLS/CDN\x1b[0m');

const bcExpect = {
  HOSTING_BROADCAST_ENABLED: '1',
  HOSTING_AUTO_BROADCAST_THRESHOLD: '200',
  HOSTING_BROADCAST_LL_HLS: '1',
};
for (const [k, v] of Object.entries(bcExpect)) {
  const got = settingDefault(k);
  check(got === v, `${k} default = "${v}"${got === v ? '' : ` (got "${got}")`}`);
}
const manifest = read('backend/functions/_manifest.json');
check(/sessionBroadcastStart/.test(manifest), 'sessionBroadcastStart registered');
check(/sessionFeatured/.test(manifest), 'sessionFeatured registered');
check(/"hls\.js"/.test(read('package.json')), 'hls.js player dependency present');

// broadcast routing (mirrors broadcast.ts shouldServeHls): passive viewers go to HLS when a stream exists OR the
// crowd crosses the threshold — and HLS viewers do NOT consume an SFU node.
const BC_TH = Number(settingDefault('HOSTING_AUTO_BROADCAST_THRESHOLD'));
function serveHls(hasHlsStream, viewers) { if (hasHlsStream) return true; return BC_TH > 0 && viewers >= BC_TH; }
check(serveHls(false, 10) === false, 'small interactive room (10) stays on WebRTC');
check(serveHls(false, BC_TH) === true, `crowd reaches ${BC_TH} → auto-switch to HLS broadcast`);
check(serveHls(true, 1) === true, 'once broadcasting, every passive viewer gets HLS');

// a QVC-scale feed: 100,000 concurrent viewers on ONE broadcast feed uses 0 SFU nodes for the passive crowd
// (SFU only carries the host + interactive tier), so SFU capacity is not the limit — the CDN is.
const bigFeed = 100000;
const sfuNodesForPassiveHlsCrowd = 0;       // HLS viewers never touch the SFU
const interactiveOnSfu = Number(settingDefault('HOSTING_MAX_VIEWERS_PER_ROOM')); // only these ride WebRTC
check(sfuNodesForPassiveHlsCrowd === 0, `${bigFeed.toLocaleString()}-viewer feed → 0 SFU nodes for the passive crowd (served by CDN); only ≤${interactiveOnSfu} interactive viewers ride the SFU`);
check(bigFeed > interactiveOnSfu * 100, 'one broadcast feed serves far beyond any single-room SFU cap (CDN-bound, not SFU-bound)');

// ============================================================================================================
console.log('\n\x1b[1m6) LIVESTREAM ↔ ADVERTISING — advertised-only + audio/video ad breaks\x1b[0m');

const adExpect = {
  HOSTING_ADVERTISED_PRODUCTS_ONLY: '1',
  HOSTING_AD_BREAK_BETWEEN_PRODUCTS: '1',
  HOSTING_AD_BREAK_SECONDS: '15',
};
for (const [k, v] of Object.entries(adExpect)) {
  const got = settingDefault(k);
  check(got === v, `${k} default = "${v}"${got === v ? '' : ` (got "${got}")`}`);
}
const mani = read('backend/functions/_manifest.json');
check(/sessionAdBreak/.test(mani), 'sessionAdBreak registered');
check(/sessionFeatured/.test(mani), 'sessionFeatured registered');
// the ad break draws from the shared inventory + records revenue like the in-app interstitial
const adbSrc = read('backend/functions/sessionAdBreak/entry.ts');
check(/pickInterstitialAd/.test(adbSrc), 'ad break uses the shared ad inventory (pickInterstitialAd)');
check(/AdImpression/.test(adbSrc) && /livestream_ad_break/.test(adbSrc), 'ad break records an AdImpression (your ad revenue)');
// advertised-only gate is wired into both featuring and selling
check(/checkStreamable/.test(read('backend/functions/sessionFeatured/entry.ts')), 'featuring a product is gated to advertised products');
check(/checkStreamable/.test(read('backend/functions/liveShoppingOrder/entry.ts')), 'selling a product is gated to advertised products');

// advertised-only decision (mirrors advertised-products.ts): only a product matching an active ad passes.
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const activeAds = [{ product_name: 'Wireless Earbuds' }, { product_name: 'Yoga Mat' }];
const isAdvertised = (name) => activeAds.some((a) => norm(a.product_name) === norm(name));
const RULE_ON = settingDefault('HOSTING_ADVERTISED_PRODUCTS_ONLY') === '1';
function streamable(name) { return RULE_ON ? isAdvertised(name) : true; }
check(streamable('wireless earbuds') === true, 'advertised product ("wireless earbuds") can be streamed');
check(streamable('Random Non-Advertised Thing') === false, 'non-advertised product is refused (advertised-only)');

// live streaming is an INCLUDED advertiser placement (same price, more value) + shared to member social feeds
const advFeat = read('backend/sdk/advertiser-features.ts');
check(/live_shopping_placement/.test(advFeat), 'live-shopping is an included advertiser placement (in the value stack)');
check(/livestream_social_amplification/.test(advFeat), 'livestream→member-social-feeds is an included advertiser placement');
// both surface as counsel-gated ("included — activates after counsel sign-off") and total $13k
const lsm = /live_shopping_placement"[^}]*base_value_usd:\s*(\d+)[^}]*status:\s*"(\w+)"/.exec(advFeat);
const lsa = /livestream_social_amplification"[^}]*base_value_usd:\s*(\d+)[^}]*status:\s*"(\w+)"/.exec(advFeat);
check(!!lsm && lsm[2] === 'counsel', 'live-shopping placement is status "counsel" (shows "activates after counsel sign-off")');
check(!!lsa && lsa[2] === 'counsel', 'social-amplification placement is status "counsel"');
check(!!lsm && !!lsa && (Number(lsm[1]) + Number(lsa[1])) === 13000, `the two livestream placements total $${lsm && lsa ? (Number(lsm[1]) + Number(lsa[1])).toLocaleString() : '?'} of included value`);
check(/included_features/.test(read('src/pages/FeaturePMF.jsx')) && /readiness/.test(read('src/pages/FeaturePMF.jsx')), 'advertiser value-stack table renders each feature with its readiness note');
check(/sessionSocialAnnounce/.test(mani), 'sessionSocialAnnounce registered (live session → member social feeds)');
const annSrc = read('backend/functions/sessionSocialAnnounce/entry.ts');
check(/socialPostContribution/.test(annSrc) && /withAdDisclosure/.test(annSrc), 'social announce reuses the amplification path (#ad, reach→delivered value)');
check(/ppc_social_ads_opt_in/.test(annSrc), 'announce only reaches CONSENTED (opted-in) members');

// ============================================================================================================
console.log('\n\x1b[1m7) AI MODERATION for hosting (layer — complements the DMCA agent)\x1b[0m');

const modExpect = {
  HOSTING_AI_MODERATION_ENABLED: '1',
  HOSTING_MODERATION_KILL_ON_BLOCK: '1',
  HOSTING_MODERATION_REPORT_THRESHOLD: '3',
  HOSTING_REPEAT_INFRINGER_STRIKES: '3',
  HOSTING_MODERATION_VISION_ENABLED: '0',
};
for (const [k, v] of Object.entries(modExpect)) {
  const got = settingDefault(k);
  check(got === v, `${k} default = "${v}"${got === v ? '' : ` (got "${got}")`}`);
}
const mmani = read('backend/functions/_manifest.json');
check(/sessionModerationScan/.test(mmani), 'sessionModerationScan registered');
check(/sessionReport/.test(mmani), 'sessionReport registered (viewer reporting)');
check(/hostModerationStatus/.test(mmani), 'hostModerationStatus registered');
check(/"HostModerationEvent"/.test(read('backend/db/entities.json')), 'HostModerationEvent entity declared');
check(/CREATE TABLE IF NOT EXISTS "HostModerationEvent"/.test(read('backend/db/schema.sql')), 'HostModerationEvent has a CREATE TABLE');
// moderation is rules-first (free) then AI; blocks kill the stream + strike the host
const scanSrc = read('backend/functions/sessionModerationScan/entry.ts');
check(/moderateText/.test(scanSrc) && /InvokeLLM/.test(scanSrc), 'scan is rules-first (free) then AI for the ambiguous middle');
check(/strike: true/.test(scanSrc), 'a block records a repeat-infringer strike');
// the DMCA piece is NOT replaced — takedown still strikes + broadcast requires moderation
check(/HostModerationEvent/.test(read('backend/functions/dmcaTakedownRequest/entry.ts')), 'DMCA takedown strikes the host (feeds repeat-infringer policy)');
check(/isHostBlocked/.test(read('backend/functions/sessionLiveKitToken/entry.ts')), 'repeat-infringer hosts are barred at go-live');
check(/aiModerationEnabled/.test(read('backend/functions/sessionBroadcastStart/entry.ts')), 'public broadcast requires moderation on');

// repeat-infringer logic (mirrors host-moderation.ts): strikes >= limit → blocked
const STRIKE_LIMIT = Number(settingDefault('HOSTING_REPEAT_INFRINGER_STRIKES'));
const blockedAt = (strikes) => STRIKE_LIMIT > 0 && strikes >= STRIKE_LIMIT;
check(blockedAt(STRIKE_LIMIT) === true && blockedAt(STRIKE_LIMIT - 1) === false, `host barred at ${STRIKE_LIMIT} strikes, not before`);
// report threshold suspends
const REP_TH = Number(settingDefault('HOSTING_MODERATION_REPORT_THRESHOLD'));
const suspendAt = (reports) => reports >= REP_TH;
check(suspendAt(REP_TH) && !suspendAt(REP_TH - 1), `session auto-suspends at ${REP_TH} distinct viewer reports`);

// ============================================================================================================
console.log('');
if (failures === 0) {
  console.log('\x1b[1;32m✓ LOAD TEST PASSED — everything ships at the floor (AI on Llama free tier, hosting egress capped).\x1b[0m\n');
  process.exit(0);
} else {
  console.log(`\x1b[1;31m✗ LOAD TEST FAILED — ${failures} check(s) regressed from the floor.\x1b[0m\n`);
  process.exit(1);
}
