// perf-vitals.js — dependency-free capture of real load-speed metrics from every visitor, beaconed to the
// backend so the AI load-time optimizer can watch them and keep the site under the "instant" perception budget.
//
// WHY NO LIBRARY: the whole point is that speed telemetry must never itself slow the page or pull a third-party
// script. This uses only native browser APIs (PerformanceObserver, Navigation Timing) — zero dependencies, a few
// hundred bytes, and it never blocks render. It degrades silently on browsers that lack an API.
//
// WHAT IT MEASURES (all in milliseconds unless noted), against the human-perception budget:
//   • ttfb   — time to first byte (network + server).
//   • fcp    — first contentful paint (something is on screen).
//   • lcp    — largest contentful paint (the main content is on screen) — the headline "did it load" number.
//   • inp    — interaction to next paint (does tapping feel instant) — the interaction number; <100ms = instant.
//   • cls    — cumulative layout shift (unitless; visual stability).
//   • route  — in-app navigation time (click → the new page is committed) — <100ms = instant.
//   • load_kind — "cold" (fresh network load), "warm" (served from the service-worker cache), or "route" (SPA nav).
//
// It samples per PERF_SAMPLE_RATE (fetched from perfConfig; default = everyone) and flushes with sendBeacon on
// page hide so nothing is lost and nothing blocks unload. No PII: only the route NAME and the timings.

const ENDPOINT = "/functions/perfVitalsIngest";

const state = {
  enabled: true,
  sampleRate: 1,
  sampled: true,
  buffer: [],
  navStart: 0,
  sentNav: false,
};

const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
const round = (n) => Math.round(Number(n) || 0);

// Was this load served warm from the service-worker cache (repeat visit) vs a cold network load?
function loadKind() {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    // A service-worker-served navigation reports a non-zero workerStart and a tiny transfer size.
    if (nav && (nav.transferSize === 0 || nav.workerStart > 0)) return "warm";
    return "cold";
  } catch { return "cold"; }
}

function push(metric, value, extra) {
  if (!state.enabled || !state.sampled) return;
  const routeName = (() => { try { return location.pathname.replace(/^\//, "").split("/")[0] || "home"; } catch { return "home"; } })();
  state.buffer.push({ metric, value: round(value), route: routeName, load_kind: extra?.load_kind || undefined, at: Date.now() });
  if (state.buffer.length >= 20) flush();
}

function flush() {
  if (!state.buffer.length) return;
  const batch = state.buffer.splice(0, state.buffer.length);
  const body = JSON.stringify({ samples: batch, ua_mobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || ""), conn: navigator.connection?.effectiveType || undefined });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* never throw from telemetry */ }
}

// ---- Core Web Vitals via native observers -------------------------------------------------------
function observeVitals() {
  const kind = loadKind();

  // Navigation timing → TTFB, and a cold/warm full page-load number once loaded.
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) {
      push("ttfb", nav.responseStart, { load_kind: kind });
      // total time to fully interactive-ish: domContentLoadedEventEnd is a stable, cheap proxy.
      addEventListener("load", () => {
        try {
          const n = performance.getEntriesByType("navigation")[0];
          if (n) push("page_load", n.domContentLoadedEventEnd, { load_kind: kind });
        } catch {}
      }, { once: true });
    }
  } catch {}

  // FCP
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.name === "first-contentful-paint") push("fcp", e.startTime, { load_kind: kind });
    }).observe({ type: "paint", buffered: true });
  } catch {}

  // LCP — keep the largest; report the final value on hide.
  try {
    let lcp = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    const report = () => { if (lcp > 0) { push("lcp", lcp, { load_kind: kind }); lcp = -1; } };
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") report(); }, { once: true });
    addEventListener("pagehide", report, { once: true });
  } catch {}

  // CLS — accumulate layout shifts that weren't from recent input; report x1000 as an integer.
  try {
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    const report = () => push("cls_x1000", cls * 1000, { load_kind: kind });
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") report(); }, { once: true });
  } catch {}

  // INP — worst interaction latency (event → next paint). Approximated from Event Timing durations.
  try {
    let worst = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const d = e.duration || 0;
        if (d > worst) worst = d;
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 40 });
    const report = () => { if (worst > 0) push("inp", worst); };
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") report(); }, { once: true });
    addEventListener("pagehide", report, { once: true });
  } catch {}
}

// ---- SPA route-change timing --------------------------------------------------------------------
// A capture-phase click on any internal link stamps navStart; NavigationTracker calls endRouteChange() once the
// new route is committed. Delta = perceived navigation time. Sub-100ms = the user can't tell it navigated.
function wireRouteTiming() {
  try {
    document.addEventListener("click", (ev) => {
      const a = ev.target?.closest?.("a[href]");
      if (a && a.origin === location.origin && !a.target) { state.navStart = now(); state.sentNav = false; }
    }, true);
  } catch {}
}

export function endRouteChange() {
  try {
    if (state.navStart && !state.sentNav) {
      const dt = now() - state.navStart;
      state.sentNav = true;
      if (dt >= 0 && dt < 60000) push("route", dt, { load_kind: "route" });
      state.navStart = 0;
    }
  } catch {}
}

// ---- Public init --------------------------------------------------------------------------------
export async function initPerfVitals() {
  try {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
    // Pull the AI-tuned sampling/enabled flags (best-effort; defaults keep it on for everyone).
    try {
      const res = await fetch("/functions/perfConfig", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (res.ok) {
        const cfg = await res.json().catch(() => ({}));
        state.enabled = cfg.monitoring_enabled !== false;
        state.sampleRate = Number(cfg.sample_rate);
        if (!(state.sampleRate > 0) || state.sampleRate > 1) state.sampleRate = 1;
      }
    } catch { /* defaults: on, sample everyone */ }

    state.sampled = Math.random() < state.sampleRate;
    if (!state.enabled || !state.sampled) return;

    observeVitals();
    wireRouteTiming();
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    addEventListener("pagehide", flush);
  } catch { /* telemetry must never break the app */ }
}
