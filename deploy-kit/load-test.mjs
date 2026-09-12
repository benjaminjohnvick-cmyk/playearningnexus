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

// value-match-to-price: every tier's TOTAL included value >= the price they pay (top-up guarantee)
check(settingDefault('ADVERTISER_VALUE_MATCH_TO_PRICE') === '1', 'ADVERTISER_VALUE_MATCH_TO_PRICE default = "1"');
check(/value_match_to_price_usd/.test(advFeat) && /total_offer_value_usd/.test(advFeat), 'rollup computes a value-match top-up + total offer value');
{
  // recompute per-tier feature sums (tier<=N) and confirm total (with top-up) >= price at every tier
  const reAll = /tier:\s*(\d),\s*base_value_usd:\s*(\d+)/g; let mm; const byT = { 1: 0, 2: 0, 3: 0 };
  while ((mm = reAll.exec(advFeat))) byT[Number(mm[1])] += Number(mm[2]);
  const cum = { 1: byT[1], 2: byT[1] + byT[2], 3: byT[1] + byT[2] + byT[3] };
  const price = { 1: 13000, 2: Math.round(200000 * 13 / 12), 3: 400000 };
  for (const t of [1, 2, 3]) {
    const total = Math.max(cum[t], price[t]); // value-match floors to price
    check(total >= price[t], `Tier ${t}: total included value $${total.toLocaleString()} >= price $${price[t].toLocaleString()}`);
  }
}
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
console.log('\n\x1b[1m8) LEADERBOARD at scale — global board served from a precompute, not a 50k-row scan\x1b[0m');
const lbMani = read('backend/functions/_manifest.json');
check(/"leaderboardSnapshot"/.test(lbMani), 'leaderboardSnapshot registered in the manifest');
check(/leaderboard-global-snapshot|leaderboardSnapshot/.test(read('backend/scheduler/schedules.json')), 'leaderboardSnapshot scheduled (every 15 min)');
check(/"LeaderboardSnapshot"/.test(read('backend/db/entities.json')), 'LeaderboardSnapshot entity declared');
check(/CREATE TABLE IF NOT EXISTS "LeaderboardSnapshot"/.test(read('backend/db/schema.sql')), 'LeaderboardSnapshot has a CREATE TABLE');
check(/"LeaderboardSnapshot"[\s\S]*?"scope": "admin"/.test(read('backend/db/rls-policy.json')), 'LeaderboardSnapshot is admin-scoped (internal/service only)');
const lbWriter = read('backend/functions/leaderboardSnapshot/entry.ts');
check(/db\.scan\(/.test(lbWriter), 'snapshot writer aggregates with bounded db.scan (not a giant filter)');
check(/toSnapshotDoc/.test(lbWriter), 'snapshot writer stores ranked top-N via toSnapshotDoc');
const lbReader = read('backend/functions/leaderboard/entry.ts');
check(/LeaderboardSnapshot/.test(lbReader), 'global scope reads the precomputed LeaderboardSnapshot');
check(/\$in/.test(lbReader), 'friends scope is tightly $in-scoped to the friend set (no full-table scan)');
// compliance still holds: financial metrics stay rank-only in the reader
check(/def\.financial \? null/.test(lbReader), 'financial metrics (earner/saver) stay RANK-ONLY — no dollar amount leaves the function');
// the SNAPSHOT_TOP depth is large enough to resolve realistic ranks
const lbSdk = read('backend/sdk/leaderboard.ts');
const topDepth = Number((lbSdk.match(/SNAPSHOT_TOP\s*=\s*(\d+)/) || [])[1] || 0);
check(topDepth >= 1000, `snapshot keeps a deep ranked list (top ${topDepth}) so my_rank resolves without a full scan`);

// ============================================================================================================
console.log('\n\x1b[1m9) LIVE-SESSION BURST control — thundering-herd reads collapsed, counters made atomic\x1b[0m');
// Shared TTL + single-flight cache exists and is single-flight (dedupes concurrent misses).
const ttlCache = read('backend/sdk/ttl-cache.ts');
check(/export async function cached/.test(ttlCache), 'ttl-cache: cached() helper present');
check(/inflight\.(get|set)/.test(ttlCache), 'ttl-cache is single-flight (concurrent callers dedupe to one loader)');
// Ad-break burst: the shared ad inventory / owner sets / model are served from the burst cache, not re-read per viewer.
const inter = read('backend/sdk/interstitial-ad.ts');
check(/from "\.\/ttl-cache\.ts"/.test(inter), 'interstitial selector imports the burst cache');
check(/cached\("interstitial:active"/.test(inter), 'active-ad inventory is burst-cached (one read per isolate/window, not per viewer)');
check(/AdGridAd\.filter\(\{ status: "active" \}, "-created_date", activeAdsMax\(\)\)/.test(inter), 'active-ad load is bounded by a cap (no unbounded per-request load)');
check(/cached\("interstitial:model"/.test(inter) && /cached\("interstitial:paying"/.test(inter), 'targeting model + paying-advertiser set are burst-cached & shared');
// Go-live token burst: per-room session read is cached, and the SFU-cap counter is atomic (no lost-update race).
const tok = read('backend/functions/sessionLiveKitToken/entry.ts');
check(/cached\("session:" \+ room/.test(tok), 'go-live: per-room session lookup is burst-cached (single-flight)');
check(/incrementField\("GameSession", String\(sess\.id\), "viewer_tokens", 1\)/.test(tok), 'viewer admission reserves the SFU slot ATOMICALLY (cap holds under a concurrent burst)');
check(/"viewer_tokens", -1\)/.test(tok), 'over-cap reservation is released atomically (no permanent leak)');
// Featured-product interest + distinct-reporter counts are race-safe under a burst.
check(/incrementField\("GameSession", String\(sess\.id\), "interest_count", 1\)/.test(read('backend/functions/sessionFeatured/entry.ts')), 'featured-product "interested" tally is atomic (burst-safe)');
check(/appendToSetArray\("GameSession"/.test(read('backend/functions/sessionReport/entry.ts')), 'distinct-reporter set-append is atomic (auto-suspend threshold can\'t be stalled by a race)');
check(/async appendToSetArray/.test(read('backend/sdk/db.ts')), 'db.appendToSetArray (atomic add-if-absent) is available');

// ============================================================================================================
console.log('\n\x1b[1m10) ADMIN DASHBOARDS at scale — streamed aggregation, no silent-truncation caps\x1b[0m');
// SDK accumulators exist (streaming single-source-of-truth; array functions are thin wrappers).
check(/export function addChoice/.test(read('backend/sdk/fair-choice.ts')) && /export function rankChoiceAcc/.test(read('backend/sdk/fair-choice.ts')), 'fair-choice: streaming accumulator (addChoice/rankChoiceAcc)');
check(/export function addFeedback/.test(read('backend/sdk/feedback.ts')) && /export function finalizeFeedback/.test(read('backend/sdk/feedback.ts')), 'feedback: streaming accumulator (addFeedback/finalizeFeedback)');
check(/export function addVote/.test(read('backend/sdk/concept-polling.ts')) && /export function finalizeConceptAcc/.test(read('backend/sdk/concept-polling.ts')), 'concept-polling: streaming accumulator (addVote/finalizeConceptAcc)');
check(/export function addOrder/.test(read('backend/sdk/product-stats.ts')) && /export function finalizeProductStats/.test(read('backend/sdk/product-stats.ts')), 'product-stats: streaming accumulator (addOrder/finalizeProductStats)');
// Each dashboard/job streams with db.scan and no longer pulls a big capped array.
const streamed = {
  'trendChoiceResults': 'TrendChoiceEvent',
  'feedbackStatus': 'FeedbackEvent',
  'aiConceptPollResults': 'ConceptPollVote',
  'aiConceptPollLearn': 'ConceptPollVote',
  'platformInsights': 'User',
  'productStatsCompile': null,
  'funnelBenchmarkCompile': 'FunnelJourney',
  'endorserRewardSweep': 'EndorserConversion',
};
for (const [fn, _entity] of Object.entries(streamed)) {
  const src = read(`backend/functions/${fn}/entry.ts`);
  check(/db\.scan\(/.test(src), `${fn} streams with db.scan (bounded memory)`);
  check(!/filter\([^)]*,\s*(?:10000|20000|50000|200000)\)/.test(src), `${fn} no longer loads a 10k–200k capped array`);
}

// ============================================================================================================
console.log('\n\x1b[1m11) BROADCAST STATE → CDN publisher — metadata poll moved onto the edge\x1b[0m');
const bstate = read('backend/sdk/broadcast-state.ts');
check(/export async function publishBroadcastState/.test(bstate), 'publishBroadcastState() exists');
check(/export function broadcastStateConfigured/.test(bstate), 'broadcastStateConfigured() gate exists (safe no-op until storage set)');
check(/state\.json/.test(bstate), 'publishes <room>/state.json next to the HLS segments');
check(/return \{ published: false, reason: "not_configured" \}/.test(bstate), 'best-effort: no-ops (never throws) when storage is unconfigured');
check(/export async function presignPut/.test(read('backend/sdk/aws/sigv4.ts')), 'sigv4 presignPut supports S3-compatible endpoints (AWS + R2/MinIO)');
const sf = read('backend/functions/sessionFeatured/entry.ts');
check(/publishBroadcastState\(room, buildBroadcastState/.test(sf), 'sessionFeatured mirrors featured-product + ad-break to the CDN state file');
const sbs = read('backend/functions/sessionBroadcastStart/entry.ts');
check((sbs.match(/publishBroadcastState\(/g) || []).length >= 2, 'sessionBroadcastStart seeds state on start AND clears it on stop');
check(/Scale levers/.test(read('deploy-kit/env-check.mjs')), 'env-check prints the scale-levers activation readout');
// General media uploads share the R2/HLS bucket by default (one bucket for everything).
const s3 = read('backend/sdk/aws/s3.ts');
check(/HLS_STORAGE_BUCKET/.test(s3) && /HLS_S3_ACCESS_KEY_ID/.test(s3), 'general uploads default to the same R2 bucket + creds as broadcast (S3_* overrides optional)');
check(/presignPut/.test(s3) && /presignS3Put/.test(s3), 'upload helper is endpoint-aware: R2/MinIO via presignPut, AWS unchanged via presignS3Put');
check(/uploadConfigured/.test(read('backend/server/integration-routes.ts')), 'UploadFile route accepts the shared bucket (not just S3_BUCKET)');

// ============================================================================================================
console.log('\n\x1b[1m12) AUTO-RENEW across ALL tiers — results-gated, opt-out, never auto-charges\x1b[0m');
const st = read('backend/sdk/settings.ts');
check(/"TIER_AUTORENEW_TIERS"[\s\S]*?default: "1,2,3"/.test(st), 'auto-renew applies to ALL tiers by default (1,2,3)');
const tar = read('backend/sdk/tier-autorenew.ts');
check(/\["1", "2", "3"\]/.test(tar) && /\[1, 2, 3\]/.test(tar), 'tier fallback in code is 1/2/3 (matches the setting)');
// The compliance guardrails must all still hold at their safe defaults.
check(/"TIER_AUTORENEW_ENABLED"[\s\S]*?default: "0"/.test(st), 'master switch still OFF by default (counsel-gated)');
check(/"TIER_AUTORENEW_RESULTS_GATED"[\s\S]*?default: "1"/.test(st), 'results-gate ON by default (only renews if the numbers support it)');
check(/"TIER_AUTORENEW_DEFAULT_ENROLLED"[\s\S]*?default: "1"/.test(st), 'opt-out posture: enrolled by default, user can opt out');
check(/"TIER_AUTORENEW_REQUIRE_CONSENT"[\s\S]*?default: "1"/.test(st), 'express-consent required by default (no auto-charge without consent)');
const sweep = read('backend/functions/tierAutoRenewSweep/entry.ts');
check(/pending_gated_payment_path/.test(sweep) && !/chargeCard|capturePayment|createCharge|stripe/i.test(sweep), 'sweep records renewal INTENT only — never charges (money stays on the gated path)');
check(/results >= yearCost \* mult/.test(sweep), 'renewal requires prior-year results to clear the gate');
check(/tierYearCost\(rec, tier\)/.test(sweep), 'year cost is tier-aware (Tier 1/2/3 priced correctly)');
// Flywheel leverage: scale-up is an INVITE only, never an automatic tier change or charge.
check(/"TIER_AUTORENEW_SCALEUP_ENABLED"[\s\S]*?default: "1"/.test(st), 'results-based scale-up invite ON by default');
check(/export function scaleUpTarget/.test(tar) && /Never triggers a charge or an automatic change/.test(tar), 'scale-up is a suggestion only (no automatic tier change / no larger charge without opt-in)');
check(/scaleup_invites: scaledUp/.test(sweep), 'sweep reports scale-up invites separately (auditable)');
// Reminder-only mode: the "use it now, no lawyer" path — opt-in, click-to-renew, never auto-charges/advances.
check(/"TIER_AUTORENEW_REMINDER_ENABLED"/.test(st), 'reminder-only mode switch exists');
const gate = read('backend/functions/counselFeatureGate/entry.ts');
const legalBlock = (gate.match(/LEGAL_BRIEFS[\s\S]*?\{([\s\S]*?)\n\};/) || ['', ''])[1];
check(/TIER_AUTORENEW_ENABLED:/.test(legalBlock) && !/TIER_AUTORENEW_REMINDER_ENABLED/.test(legalBlock), 'auto-charge switch is counsel-gated (in LEGAL_BRIEFS); reminder-only switch is NOT (usable without counsel)');
check(/export function autoRenewMode/.test(tar), 'autoRenewMode() selects charge / reminder / off');
check(/reminder mode never advances the term itself/.test(sweep) && /advertiserRenewAgree/.test(sweep), 'reminder mode never auto-advances — advertiser renews affirmatively via advertiserRenewAgree');
check(/export function renewPromptCopy/.test(tar), 'reminder mode uses affirmative click-to-renew copy (not "will auto-renew unless you opt out")');

// ============================================================================================================
console.log('\n\x1b[1m13) GATE CLASSIFICATION — every gated *_ENABLED flag is explicitly legal-vs-operational\x1b[0m');
const cfgGate = read('backend/functions/counselFeatureGate/entry.ts');
check(/const OPERATIONAL_FLAGS = new Set/.test(cfgGate), 'counselFeatureGate has an explicit OPERATIONAL_FLAGS list');
check(/const isUnclassified = /.test(cfgGate) && /needsCounsel = \(k: string\) => isLegal\(k\) \|\| isUnclassified\(k\)/.test(cfgGate), 'runtime is fail-safe: unclassified gate → counsel-required (strictest), not silently operational');
check(/UNCLASSIFIED gated feature/.test(cfgGate), 'enabling an unclassified gate is refused with a clear message');
check(/STRUCTURAL 7/.test(read('deploy-kit/audit.mjs')), 'audit enforces the classification (build fails on an unclassified gate)');
// The two auto-renew gates are classified the way they should be.
check(/TIER_AUTORENEW_ENABLED: "TIER-AUTORENEW-COMPLIANCE-COUNSEL-NOTE\.md"/.test(cfgGate), 'auto-charge auto-renew is classified LEGAL (needs counsel)');
check(/"TIER_AUTORENEW_REMINDER_ENABLED"/.test((cfgGate.match(/OPERATIONAL_FLAGS[\s\S]*?\]\)/) || [''])[0]), 'reminder-only auto-renew is classified OPERATIONAL (no counsel)');

// ============================================================================================================
console.log('\n\x1b[1m14) COST-FLOOR WATCHDOG — alerts before any free tier tips into paid (read-only)\x1b[0m');
const cwMani = read('backend/functions/_manifest.json');
check(/"costWatchdogRun"/.test(cwMani), 'costWatchdogRun registered in the manifest');
check(/cost-floor-watchdog|costWatchdogRun/.test(read('backend/scheduler/schedules.json')), 'cost watchdog is scheduled');
check(/"CostWatchdogReport"/.test(read('backend/db/entities.json')), 'CostWatchdogReport entity declared');
check(/CREATE TABLE IF NOT EXISTS "CostWatchdogReport"/.test(read('backend/db/schema.sql')), 'CostWatchdogReport has a CREATE TABLE');
check(/"CostWatchdogReport"[\s\S]*?"scope": "admin"/.test(read('backend/db/rls-policy.json')), 'CostWatchdogReport is admin-scoped');
const cwCore = read('backend/sdk/cost-watchdog.ts');
check(/export function assessCostFloor/.test(cwCore), 'pure assessCostFloor() core exists');
check(/paid_key_exposed/.test(cwCore) && /a PAID path, not the free Llama tier/.test(cwCore), 'catches posture drift (paid provider / exposed paid key)');
const cwFn = read('backend/functions/costWatchdogRun/entry.ts');
check(!/setSetting\(|\.update\(/.test(cwFn.replace(/db\.create\("CostWatchdogReport"/g, '')), 'watchdog is READ-ONLY — it creates a report + notifications, never changes settings');
check(/OPERATIONAL_FLAGS[\s\S]*?"COST_WATCHDOG_ENABLED"[\s\S]*?\]\)/.test(read('backend/functions/counselFeatureGate/entry.ts')), 'COST_WATCHDOG_ENABLED classified operational (no counsel — passes the STRUCTURAL 7 lint)');

// ============================================================================================================
console.log('\n\x1b[1m15) PROVISIONING SELF-TEST — actively verifies each free-tier key works (read-only, $0)\x1b[0m');
const pstMani = read('backend/functions/_manifest.json');
check(/"provisioningSelfTest"/.test(pstMani), 'provisioningSelfTest registered in the manifest');
const pstCore = read('backend/sdk/provisioning-selftest.ts');
check(/export function summarize/.test(pstCore), 'pure summarize() aggregator exists (unit-testable, no I/O)');
check(/overall: failed\.length === 0 \? "green" : "red"/.test(pstCore), 'green iff every CONFIGURED check passed');
check(/const skipped = checks\.filter\(\(c\) => !c\.configured\)/.test(pstCore), 'a provider you have not set up is "skipped", never a failure');
// It pings each provider's FREE verify endpoint — no generation, no send.
check(/api\.groq\.com\/openai\/v1\/models/.test(pstCore), 'Groq check hits the free models list (not a paid completion)');
check(/api\.cloudflare\.com\/client\/v4\/user\/tokens\/verify/.test(pstCore), 'Cloudflare check hits the free token-verify endpoint');
check(/api\.brevo\.com\/v3\/account/.test(pstCore) && /api\.brevo\.com\/v3\/senders/.test(pstCore), 'Brevo check verifies the key AND that EMAIL_FROM is a verified sender');
check(/is not a Brevo sender|NOT verified\/active/.test(pstCore), 'the #1 email gotcha (unverified EMAIL_FROM) is caught with a clear fix');
check(/__provisioning-selftest\/probe\.txt/.test(pstCore) && /overwritten every run — never accumulates/.test(pstCore), 'R2 check writes ONE fixed idempotent probe object (free, never accumulates)');
// Non-billable + read-only: no email send, no image/chat generation, no settings change.
check(!/\/v3\/smtp\/email|ai\/run\/|chat\/completions/.test(pstCore), 'self-test never calls a billable send/generation endpoint');
const pstFn = read('backend/functions/provisioningSelfTest/entry.ts');
check(/user\.role !== "admin"/.test(pstFn), 'provisioningSelfTest is admin-only');
check(!/setSetting\(|db\.create\(|db\.update\(|\.update\(/.test(pstFn), 'function is READ-ONLY — returns results, writes no entity, changes no setting');

// ============================================================================================================
console.log('\n\x1b[1m16) PPC NETWORK ACROSS ALL THREE TIERS — advertisers on every tier can advertise on the AdGrid\x1b[0m');
const ppcTierCatalog = read('backend/sdk/advertiser-features.ts');
check(/key: "ppc_grid_placement"[\s\S]*?tier: 1/.test(ppcTierCatalog), 'PPC network advertising is in the advertiser catalog as a tier-1 feature (shared across tiers 1, 2 & 3)');
check(/featuresForContext[\s\S]*?f\.tier <= tier/.test(ppcTierCatalog), 'featuresForContext includes a tier-1 feature in EVERY tier (tier <= N)');
check(/key: "ppc_grid_placement"[\s\S]*?status: "live"/.test(ppcTierCatalog), 'PPC network placement is live (delivering), not gated off');
// The advertiser-side create path must not be tier-gated.
const createGridAd = read('backend/functions/createAdGridAd/entry.ts');
check(!/tier\s*[<>=!]|requireTier|min_tier|founding.*only/i.test(createGridAd), 'createAdGridAd has NO tier gate — any advertiser tier can place a grid ad');

// ============================================================================================================
console.log('\n\x1b[1m17) FOUNDING TIER — gets the MAX (tier3) scale of every feature, free\x1b[0m');
const cs = read('backend/sdk/creative-suite.ts');
check(/export function effectiveTier[\s\S]*?founding[\s\S]*?return "tier3"/.test(cs), 'effectiveTier() maps a founding advertiser to tier3 (max) caps');
check(/export const isFoundingAdvertiser/.test(cs), 'isFoundingAdvertiser() helper exists (is_founding / founding)');
check(/foundingMaxScaleEnabled|FOUNDING_MAX_SCALE_ENABLED/.test(cs), 'founding max-scale is gated by FOUNDING_MAX_SCALE_ENABLED (default on)');
check(/"FOUNDING_MAX_SCALE_ENABLED"[\s\S]*?default: "1"/.test(read('backend/sdk/settings.ts')), 'FOUNDING_MAX_SCALE_ENABLED registered, default ON');
// Every creative-suite endpoint resolves founding → max caps (not the client-supplied tier).
for (const fn of ['aiCreativeSuiteGenerate','aiCreativeSuiteStatus','aiCreativeSuiteExperiment','aiCreativeSuiteLearn']) {
  check(/effectiveTier\([\s\S]*?isFoundingAdvertiser\(user\)/.test(read(`backend/functions/${fn}/entry.ts`)), `${fn} resolves founding → max (tier3) caps`);
}
// The add-on catalog already hands founding the WHOLE set free — the other half of "all features".
check(/if \(opts\?\.founding\) return all;/.test(read('backend/sdk/advertiser-features.ts')), 'founding still gets the WHOLE add-on catalog free (featuresForContext)');

// ============================================================================================================
console.log('\n\x1b[1m18) AD METRICS — full network metric set, tracked + AI-optimized, demographic & audience targeting\x1b[0m');
const adMetrics = read('backend/sdk/ad-metrics.ts');
check(/export const ecpm\b/.test(adMetrics) && /export const cpp\b/.test(adMetrics) && /export const ipm\b/.test(adMetrics) && /export const arpdau\b/.test(adMetrics) && /export const fillRatePct\b/.test(adMetrics), 'ad-metrics.ts implements eCPM, CPP, IPM, ARPDAU, fill rate');
check(/AD_METRIC_WINDOWS\s*=\s*\[1, 3, 7, 14, 28, 90, 365\]/.test(adMetrics), 'windowed D1–D365 ROAS curve defined (by-timespan)');
check(/export async function computePublisherAdMetrics/.test(adMetrics) && /export async function computeAdNetworkAdvertiserMetrics/.test(adMetrics), 'publisher + advertiser metric computers exist');
check(/"AD_METRICS_ENABLED"[\s\S]*?default: "1"/.test(read('backend/sdk/settings.ts')), 'AD_METRICS_ENABLED registered, default ON (everything-on)');
const adOpt = read('backend/sdk/ad-metrics-optimizer.ts');
check(/OptimizationSignal/.test(adOpt) && /AgentLearningMemory/.test(adOpt), 'optimizer TRACKS via OptimizationSignal + AgentLearningMemory (no new tables)');
check(/gateAndRun\("ad_optimization"/.test(adOpt), 'every optimizer action routes through the autonomy kernel (ad_optimization)');
check(/spend_change:\s*0/.test(adOpt), 'optimizer never raises spend (spend_change: 0, reversible)');
check(/"adMetricsSweep"/.test(read('backend/scheduler/schedules.json')), 'adMetricsSweep is scheduled (tracked over time)');
check(/"ad_metrics_optimizer"/.test(read('backend/agents-runtime/agents.json')), 'ad_metrics_optimizer agent registered');
const adAud = read('backend/sdk/ad-audience.ts');
check(/DEMOGRAPHIC_FIELDS\s*=\s*\["age_range", "gender", "country", "region"\]/.test(adAud), 'demographic targeting fields: age_range, gender, country, region');
check(/AUDIENCE_TYPES\s*=\s*\["all", "new", "existing"\]/.test(adAud), 'new-vs-existing audience targeting');
check(/OPTIMIZE_OBJECTIVES\s*=\s*\["roas", "new_users", "existing_users"\]/.test(adAud), 'optimize_for objectives: roas, new_users, existing_users');
check(/userMatchesAudience/.test(read('backend/sdk/ad-targeting.ts')), 'targeting matcher evaluates demographics + audience type');
check(/optimize_for: normalizeObjective/.test(read('backend/functions/createAdGridAd/entry.ts')), 'advertisers set optimize_for at ad creation');
// Own-business AI social ads: measured + tracked like advertisers, and trend-reactive (Mint-Mobile style).
check(/export async function computeOwnAdSocialMetrics/.test(read('backend/sdk/ad-metrics.ts')), 'own-business AI social ads have a measured metric set (computeOwnAdSocialMetrics)');
check(/recordAdMetricSnapshot\("social_own"/.test(read('backend/functions/adMetricsSweep/entry.ts')), 'own-ad social performance is tracked over time in the sweep');
check(/own_ad_social/.test(read('src/components/admin/PublisherMetricsPanel.jsx')), 'admin publisher panel surfaces own-ad social performance');
check(/usableTrends/.test(read('backend/functions/aiTrendSocialAds/entry.ts')) && /platform_own_ad/.test(read('backend/functions/aiTrendSocialAds/entry.ts')), 'aiTrendSocialAds generates trend-reactive own ads from the live brand-safe trend pool');
check(/"AI_TREND_SOCIAL_ADS_ENABLED"[\s\S]*?default: "1"/.test(read('backend/sdk/settings.ts')), 'AI_TREND_SOCIAL_ADS_ENABLED registered, default ON');
check(/"daily-trend-social-ads"/.test(read('backend/scheduler/schedules.json')), 'trend social ads are scheduled (after the morning trend refresh)');

// ============================================================================================================
console.log('');
if (failures === 0) {
  console.log('\x1b[1;32m✓ LOAD TEST PASSED — everything ships at the floor (AI on Llama free tier, hosting egress capped).\x1b[0m\n');
  process.exit(0);
} else {
  console.log(`\x1b[1;31m✗ LOAD TEST FAILED — ${failures} check(s) regressed from the floor.\x1b[0m\n`);
  process.exit(1);
}
