// GamerGain / PlayEarning Nexus — k6 load-test script
// -----------------------------------------------------------------------------
// Implements the four load profiles and the weighted user journeys from
// LOAD-TEST-PLAN.md, with the SLO thresholds baked in as pass/fail gates.
//
// GROUND RULES (see LOAD-TEST-PLAN.md §0):
//   • Point this at a STAGING environment that mirrors production — never live
//     prod, never a laptop. Seed ~200k users first (an empty DB lies).
//   • Use provider SANDBOX keys (Stripe/PayPal/Twilio/OpenAI/SendGrid) so no
//     real money moves and no real messages send.
//
// USAGE:
//   BASE_URL=https://staging.yourdomain.com PROFILE=smoke k6 run loadtest.k6.js
//   PROFILE ∈ { smoke | ramp | soak | spike }   (default: smoke)
//   Optional: TARGET_VUS (ramp/soak/spike peak), AUTH_TOKEN (bearer, if used).
//
// The four profiles mirror LOAD-TEST-PLAN.md §3. Run them in order:
//   smoke → ramp (find the knee) → soak (2–4h endurance) → spike (scale-out lag).
// -----------------------------------------------------------------------------

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ---- Config -----------------------------------------------------------------
const BASE_URL   = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const PROFILE    = (__ENV.PROFILE  || "smoke").toLowerCase();
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || "10000", 10); // ramp/soak/spike peak
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";                    // optional bearer
const FN_PATH    = __ENV.FN_PATH || "/fn";                    // public function route

// Public function caller — matches the deployed backend's /fn/<name> convention.
function fn(name, body) {
  const headers = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  return http.post(`${BASE_URL}${FN_PATH}/${name}`, JSON.stringify(body || {}), {
    headers,
    tags: { name }, // group latency by endpoint in the summary
  });
}

// ---- Custom metrics ---------------------------------------------------------
const errorRate    = new Rate("gg_errors");            // 5xx + timeouts + failed checks
const cacheHitRate = new Rate("gg_cache_hits");        // prize-pool/leaderboard from cache
const journeyDur   = new Trend("gg_journey_ms", true); // whole-journey wall time

// ---- SLO thresholds (LOAD-TEST-PLAN.md §4) ----------------------------------
// These are the objective pass/fail gates — k6 exits non-zero if any is breached.
export const options = {
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1500"], // p95 <500ms, p99 <1500ms
    gg_errors:         ["rate<0.005"],              // <0.5% errors
    gg_cache_hits:     ["rate>0.95"],               // >95% cache hit on hot reads
    http_req_failed:   ["rate<0.005"],              // transport-level failures <0.5%
  },
  scenarios: scenariosFor(PROFILE),
  // Don't let one slow run mask a systemic problem — abort a scenario if the
  // error gate is already blown hard early on.
  thresholdsAbortOnFail: false,
};

// ---- Load profiles (LOAD-TEST-PLAN.md §3) -----------------------------------
function scenariosFor(profile) {
  switch (profile) {
    // 1) Baseline / smoke — 50–100 VUs, 5 min. Clean latency floor + script sanity.
    case "smoke":
      return {
        smoke: {
          executor: "constant-vus",
          vus: 75,
          duration: "5m",
        },
      };

    // 2) Ramp (capacity) — step 100 → target, +500 every 2 min. Find the knee.
    case "ramp": {
      const stages = [{ target: 100, duration: "2m" }];
      for (let v = 600; v < TARGET_VUS; v += 500) {
        stages.push({ target: v, duration: "2m" });
      }
      stages.push({ target: TARGET_VUS, duration: "2m" });
      stages.push({ target: 0, duration: "2m" }); // ramp down
      return {
        ramp: { executor: "ramping-vus", startVUs: 0, stages, gracefulRampDown: "30s" },
      };
    }

    // 3) Soak (endurance) — hold a steady realistic load for 2–4 h.
    case "soak": {
      const hold = Math.min(TARGET_VUS, 5000) || 3000; // 3,000–5,000 realistic
      return {
        soak: {
          executor: "constant-vus",
          vus: hold,
          duration: __ENV.SOAK_DURATION || "3h",
        },
      };
    }

    // 4) Spike — jump low→high in under a minute, hold, drop. Tests scale-out lag.
    case "spike":
      return {
        spike: {
          executor: "ramping-vus",
          startVUs: 500,
          stages: [
            { target: 500, duration: "1m" },              // low baseline
            { target: Math.min(TARGET_VUS, 8000), duration: "45s" }, // sudden spike
            { target: Math.min(TARGET_VUS, 8000), duration: "3m" },  // hold at peak
            { target: 500, duration: "1m" },              // drop
            { target: 0, duration: "1m" },
          ],
          gracefulRampDown: "30s",
        },
      };

    default:
      throw new Error(`Unknown PROFILE "${profile}". Use smoke | ramp | soak | spike.`);
  }
}

// ---- Weighted journey picker (LOAD-TEST-PLAN.md §2) --------------------------
// Model a real day's traffic mix, not one endpoint hammered alone.
const JOURNEYS = [
  { name: "browse_dashboard", weight: 40, run: browseDashboard },
  { name: "complete_survey",  weight: 20, run: completeSurvey  },
  { name: "referral_action",  weight: 15, run: referralAction  },
  { name: "sign_in",          weight: 10, run: signIn          },
  { name: "payout_wallet",    weight: 10, run: payoutWallet    },
  { name: "static_assets",    weight:  5, run: staticAssets    },
];
const TOTAL_WEIGHT = JOURNEYS.reduce((s, j) => s + j.weight, 0);

function pickJourney() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const j of JOURNEYS) { if ((r -= j.weight) <= 0) return j; }
  return JOURNEYS[0];
}

function ok(res) {
  // A response is "good" if it's not a 5xx and not a transport failure.
  const good = res && res.status > 0 && res.status < 500;
  errorRate.add(!good);
  return good;
}

// ---- Journeys ---------------------------------------------------------------
// NOTE: endpoint names below follow the repo's function-naming convention. If a
// staging deployment renames a route, adjust the fn("<name>") calls to match —
// the structure (weights, checks, SLOs) is what matters.

// ~40% — highest volume. Auth check + prize-pool widget + leaderboard. The 15s
// prize-pool poll is the #1 hot-read risk; it MUST be served from cache.
function browseDashboard() {
  group("browse_dashboard", () => {
    const health = http.get(`${BASE_URL}/health`, { tags: { name: "health" } });
    check(health, { "health 2xx": (r) => r.status === 200 });
    ok(health);

    const pool = fn("prizePoolStatus", {});
    ok(pool);
    // Confirm the hot read was cache-served (backend should flag it). If the
    // header/flag is absent we conservatively count it as a MISS so the >95%
    // gate stays honest.
    const served = (pool.headers && (pool.headers["X-Cache"] || pool.headers["x-cache"])) || "";
    let cached = /hit/i.test(served);
    try { const b = pool.json(); if (b && (b.cached === true || b.source === "cache")) cached = true; } catch (_e) {}
    cacheHitRate.add(cached);

    const lb = fn("leaderboardTop", { limit: 25 });
    ok(lb);
    const lbServed = (lb.headers && (lb.headers["X-Cache"] || lb.headers["x-cache"])) || "";
    let lbCached = /hit/i.test(lbServed);
    try { const b = lb.json(); if (b && (b.cached === true || b.source === "cache")) lbCached = true; } catch (_e) {}
    cacheHitRate.add(lbCached);
  });
  sleep(Math.random() * 2 + 1); // think time
}

// ~20% — the money path. Write + credit + async LLM/verify. Touches DB writes
// AND the provider queue. Use sandbox provider keys.
function completeSurvey() {
  group("complete_survey", () => {
    const list = fn("adGridConfig", {});
    ok(list);
    const answer = fn("adGridAnswer", {
      grid_id: "loadtest",
      answer: "A",
      idempotency_key: `lt-${__VU}-${__ITER}-${Date.now()}`,
    });
    ok(answer);
  });
  sleep(Math.random() * 3 + 1);
}

// ~15% — write-heavy + leaderboard recompute. Create referral, milestone check.
function referralAction() {
  group("referral_action", () => {
    const status = fn("referralStatus", {});
    ok(status);
    const create = fn("referralCreate", {
      idempotency_key: `ref-${__VU}-${__ITER}-${Date.now()}`,
    });
    ok(create);
  });
  sleep(Math.random() * 2 + 1);
}

// ~10% — JWT issue / verify + a DB write. Spikes at campaign launches.
function signIn() {
  group("sign_in", () => {
    // Sandbox/test credentials only. Adjust to your staging auth flow.
    const res = fn("authCheck", {});
    ok(res);
  });
  sleep(Math.random() * 2 + 1);
}

// ~10% — provider-bound. Balance read, request payout → SQS. Must not block web.
function payoutWallet() {
  group("payout_wallet", () => {
    const bal = fn("walletBalance", {});
    ok(bal);
    // Read-only in the load test by default — flip LT_ENQUEUE_PAYOUT=1 to also
    // exercise the enqueue path against the sandbox queue.
    if (__ENV.LT_ENQUEUE_PAYOUT === "1") {
      const req = fn("payoutRequest", { amount_usd: 0, dry_run: true });
      ok(req);
    }
  });
  sleep(Math.random() * 2 + 1);
}

// ~5% — should be served by CloudFront/CDN, NOT the backend. Confirm it is.
function staticAssets() {
  group("static_assets", () => {
    const res = http.get(`${BASE_URL}/`, { tags: { name: "static_root" } });
    ok(res);
    // If the CDN is doing its job, this should carry a cache/age header and not
    // hit an app instance. Watch CloudFront hit rate on the dashboard too.
  });
  sleep(Math.random() * 1 + 0.5);
}

// ---- Entry point ------------------------------------------------------------
export default function () {
  const t0 = Date.now();
  pickJourney().run();
  journeyDur.add(Date.now() - t0);
}

// ---- Human-readable end-of-run summary --------------------------------------
export function handleSummary(data) {
  const m = data.metrics;
  const g = (path, def = 0) => (path === undefined || path === null ? def : path);
  const p95 = g(m.http_req_duration && m.http_req_duration.values["p(95)"]);
  const p99 = g(m.http_req_duration && m.http_req_duration.values["p(99)"]);
  const err = g(m.gg_errors && m.gg_errors.values.rate) * 100;
  const cache = g(m.gg_cache_hits && m.gg_cache_hits.values.rate) * 100;
  const reqs = g(m.http_reqs && m.http_reqs.values.count);

  const line = (label, val, pass) =>
    `  ${pass ? "✓" : "✗"} ${label.padEnd(34)} ${val}`;

  const text = [
    ``,
    `GamerGain load test — profile: ${PROFILE.toUpperCase()}  target: ${BASE_URL}`,
    `-------------------------------------------------------------`,
    line("p95 API latency  (<500ms)", `${p95.toFixed(0)} ms`, p95 < 500),
    line("p99 API latency  (<1500ms)", `${p99.toFixed(0)} ms`, p99 < 1500),
    line("error rate       (<0.5%)", `${err.toFixed(3)} %`, err < 0.5),
    line("cache hit rate   (>95%)", `${cache.toFixed(1)} %`, cache > 95),
    `  · total requests: ${reqs}`,
    ``,
    `Pair with CloudWatch (LOAD-TEST-PLAN.md §4): RDS CPU <70%, replica lag <2s,`,
    `SQS draining, web tier scaling out within ~2–3 min of the spike.`,
    ``,
  ].join("\n");

  return {
    stdout: text,
    "loadtest-summary.json": JSON.stringify(data, null, 2),
  };
}
