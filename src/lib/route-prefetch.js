// route-prefetch.js — make in-app navigation feel instant by fetching the next page's code BEFORE the click.
//
// React lazy() pages download their JS chunk on first visit, which adds a visible wait the first time you open
// a page. This warms that chunk ahead of time: when a link is about to be used (the pointer hovers/focuses it,
// or it scrolls into view), we kick off the same dynamic import() the router would — so by the time the user
// actually clicks, the code is already in memory and the page commits in a few milliseconds (under the ~100ms
// "instant" perception wall). It never fetches data, only code; it's idempotent (import() caches); and it backs
// off on save-data / very slow connections so it never competes with what the user is looking at now.
//
// The aggressiveness is AI-tuned via PERF_PREFETCH_STRATEGY (fetched in perfConfig), so the load-time optimizer
// can dial it up when navigations are slow and down when bandwidth is tight:
//   "off"     — no prefetch.
//   "hover"   — warm a link's chunk when the pointer hovers / it gains focus (cheapest).
//   "visible" — also warm links as they scroll into the viewport (default).
//   "eager"   — additionally warm the highest-traffic routes right after first paint.

const loaders = new Map();   // routeKey -> () => import(...)  (registered by App)
const warmed = new Set();
let strategy = "visible";
let io = null;

const saveData = () => { try { return navigator.connection?.saveData === true || /2g/.test(navigator.connection?.effectiveType || ""); } catch { return false; } };

/** App registers each lazy route's importer here, keyed by its route path segment (lowercased). */
export function registerRouteLoader(routeKey, loader) {
  if (routeKey && typeof loader === "function") loaders.set(String(routeKey).toLowerCase(), loader);
}

function warm(routeKey) {
  const k = String(routeKey || "").toLowerCase();
  if (!k || warmed.has(k) || saveData()) return;
  const loader = loaders.get(k);
  if (!loader) return;
  warmed.add(k);
  // Fetch during idle time so it never delays anything the user is doing right now.
  const run = () => { try { loader().catch(() => warmed.delete(k)); } catch { warmed.delete(k); } };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 200);
}

function routeKeyFromHref(href) {
  try { const u = new URL(href, location.origin); if (u.origin !== location.origin) return null; return u.pathname.replace(/^\//, "").split("/")[0] || null; }
  catch { return null; }
}

function onHover(ev) {
  const a = ev.target?.closest?.("a[href]");
  if (a) { const k = routeKeyFromHref(a.getAttribute("href")); if (k) warm(k); }
}

function observeVisible() {
  try {
    if (io) io.disconnect();
    io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { const k = routeKeyFromHref(e.target.getAttribute("href")); if (k) warm(k); }
    }, { rootMargin: "200px" });
    document.querySelectorAll('a[href^="/"]').forEach((a) => io.observe(a));
    // Re-scan as the SPA swaps pages in.
    if (!observeVisible._mo) {
      observeVisible._mo = new MutationObserver(() => { try { document.querySelectorAll('a[href^="/"]').forEach((a) => io.observe(a)); } catch {} });
      observeVisible._mo.observe(document.body, { childList: true, subtree: true });
    }
  } catch {}
}

export function applyPrefetchStrategy(next, eagerRoutes) {
  strategy = ["off", "hover", "visible", "eager"].includes(next) ? next : "visible";
  try {
    document.removeEventListener("pointerover", onHover, true);
    document.removeEventListener("focusin", onHover, true);
    if (io) io.disconnect();
  } catch {}
  if (strategy === "off") return;
  document.addEventListener("pointerover", onHover, true);
  document.addEventListener("focusin", onHover, true);
  if (strategy === "visible" || strategy === "eager") observeVisible();
  if (strategy === "eager" && Array.isArray(eagerRoutes)) {
    const run = () => eagerRoutes.forEach(warm);
    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 800);
  }
}

/** Init from the AI-tuned config (best-effort; defaults to "visible" for everyone). */
export async function initRoutePrefetch(eagerRoutes) {
  try {
    let strat = "visible";
    try {
      const res = await fetch("/functions/perfConfig", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (res.ok) { const cfg = await res.json().catch(() => ({})); if (cfg.prefetch_enabled === false) strat = "off"; else if (cfg.prefetch_strategy) strat = cfg.prefetch_strategy; }
    } catch {}
    applyPrefetchStrategy(strat, eagerRoutes);
  } catch {}
}
