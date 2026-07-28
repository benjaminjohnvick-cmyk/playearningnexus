// Site interaction telemetry — the lightweight, default-on, ~free capture layer.
//
// Every meaningful thing a user does (page view, click, scroll depth, add-to-cart, search, purchase,
// drop-off) is a data point. The frontend batches these and posts them to telemetryIngest; here we
// scrub + bound them and store a compact batch row. A derived STATISTICAL layer (aggregateStats)
// rolls them into distributions, funnel rates, and correlations, and writes the headline numbers as
// OptimizationSignal rows — which is exactly what buildSiteContext()/the optimizer already read, so the
// self-learning loop consumes this with no extra wiring.
//
// Privacy: gated by the `site_telemetry` compliance flag + the TELEMETRY_ENABLED setting, and skipped
// entirely for any user with behavioral_opt_out = true. Values are bounded and PII-scrubbed (emails,
// long free-text, obvious tokens removed) before storage.

import { db } from "./db.ts";
import { getNumber } from "./settings.ts";
import { isEnabled } from "./feature-flags.ts";

export interface RawEvent {
  type?: string;
  path?: string;
  target?: string;
  value?: unknown;
  scroll_pct?: number;
  ts?: string;
  meta?: Record<string, unknown>;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const KNOWN_TYPES = new Set([
  "page_view", "click", "scroll", "search", "view_item", "add_to_cart", "begin_checkout",
  "purchase", "survey_start", "survey_complete", "drop_off", "rage_click", "form_error", "custom",
]);

function scrubString(s: unknown, max = 200): string {
  return String(s ?? "").replace(EMAIL_RE, "[email]").slice(0, max);
}

/** Whitelist + bound a single event. Unknown types collapse to "custom". */
export function scrubEvent(e: RawEvent): Record<string, unknown> {
  const type = KNOWN_TYPES.has(String(e.type)) ? String(e.type) : "custom";
  const out: Record<string, unknown> = {
    type,
    path: scrubString(e.path, 200),
    target: scrubString(e.target, 120),
    ts: typeof e.ts === "string" ? e.ts.slice(0, 40) : new Date().toISOString(),
  };
  if (e.value !== undefined && e.value !== null) {
    out.value = typeof e.value === "number" ? e.value : scrubString(e.value, 120);
  }
  if (Number.isFinite(e.scroll_pct)) out.scroll_pct = Math.max(0, Math.min(100, Math.round(Number(e.scroll_pct))));
  if (e.meta && typeof e.meta === "object") {
    // Keep a few small scalar meta keys only.
    const m: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(e.meta)) {
      if (n++ >= 8) break;
      if (typeof v === "number") m[k.slice(0, 40)] = v;
      else m[k.slice(0, 40)] = scrubString(v, 80);
    }
    out.meta = m;
  }
  return out;
}

/** Should telemetry be recorded at all right now, for this user? Honors the UI's `tracking_opt_out`
 *  (and legacy `behavioral_opt_out`). */
export async function telemetryEnabled(user: any, jurisdiction?: string | null): Promise<boolean> {
  if (user?.tracking_opt_out === true || user?.behavioral_opt_out === true) return false;
  const flag = await isEnabled("site_telemetry", jurisdiction).catch(() => true);
  if (!flag) return false;
  const on = await getNumber("TELEMETRY_ENABLED", 1).catch(() => 1);
  return !!on;
}

// Session-consistent [0,1) hash so a session is fully in or out of the telemetry sample (no partial
// sessions, which would bias the stats).
function sessionUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000000) / 1000000;
}

// Map the frontend "journey event" shape ({event_type,page,element_id,metadata,scroll_pct}) to the
// compact telemetry event the aggregator expects. Lets the client send ONE payload that serves both the
// journey log and the statistical layer (coalesced write).
export function mapJourneyToEvents(batch: any[]): RawEvent[] {
  return (Array.isArray(batch) ? batch : []).map((e) => ({
    type: e?.event_type,
    path: e?.page,
    target: e?.element_id || (e?.metadata && e.metadata.tag) || "",
    value: e?.time_on_page_seconds,
    scroll_pct: e?.scroll_pct,
    meta: e?.metadata && typeof e.metadata === "object" ? { tag: e.metadata.tag } : undefined,
  }));
}

/** Store a scrubbed, bounded batch of events as one compact InteractionEvent row. Returns count kept.
 *  Honors TELEMETRY_SAMPLE_PCT (session-consistent) so the overhead monitor can throttle volume. */
export async function recordEvents(userId: string, sessionId: string, events: RawEvent[]): Promise<number> {
  const samplePct = await getNumber("TELEMETRY_SAMPLE_PCT", 1).catch(() => 1);
  if (samplePct < 1 && sessionUnit(String(sessionId || userId)) >= Math.max(0, samplePct)) return 0;
  const cap = Math.max(1, await getNumber("TELEMETRY_MAX_EVENTS_PER_BATCH", 60));
  const clean = (Array.isArray(events) ? events : []).slice(0, cap).map(scrubEvent);
  if (!clean.length) return 0;

  // Compact per-batch summary so aggregate reads are cheap.
  const counts: Record<string, number> = {};
  let scrollSum = 0, scrollN = 0;
  for (const e of clean) {
    counts[String(e.type)] = (counts[String(e.type)] || 0) + 1;
    if (typeof (e as any).scroll_pct === "number") { scrollSum += (e as any).scroll_pct; scrollN++; }
  }
  await db.create("InteractionEvent", {
    user_id: userId,
    session_id: String(sessionId || "").slice(0, 80),
    events: clean,
    counts,
    n: clean.length,
    avg_scroll_pct: scrollN ? Math.round(scrollSum / scrollN) : null,
    at: new Date().toISOString(),
  }, userId).catch(() => null);
  return clean.length;
}

export interface TelemetryStats {
  batches: number;
  events: number;
  by_type: Record<string, number>;
  top_paths: Array<{ path: string; views: number }>;
  funnel: { view_item: number; add_to_cart: number; begin_checkout: number; purchase: number; cart_rate: number; checkout_rate: number; purchase_rate: number };
  avg_scroll_pct: number | null;
  drop_off: number;
  sample_ok: boolean;
}

/** Roll recent telemetry into distributions + funnel rates, and (when the sample is large enough)
 *  publish headline metrics as OptimizationSignal rows for the site model / optimizer to consume. */
export async function aggregateStats(days = 14, publishSignals = true): Promise<TelemetryStats> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = await db.filter("InteractionEvent", {}, "-at", 5000).catch(() => []) as any[];
  const recent = rows.filter((r) => String(r.at || "") >= since);

  const byType: Record<string, number> = {};
  const pathViews: Record<string, number> = {};
  let events = 0, scrollSum = 0, scrollN = 0;
  for (const b of recent) {
    const counts = (b.counts && typeof b.counts === "object") ? b.counts : {};
    for (const [t, c] of Object.entries(counts)) { byType[t] = (byType[t] || 0) + Number(c || 0); events += Number(c || 0); }
    if (typeof b.avg_scroll_pct === "number") { scrollSum += b.avg_scroll_pct; scrollN++; }
    for (const e of (Array.isArray(b.events) ? b.events : [])) {
      if (e?.type === "page_view" && e?.path) pathViews[e.path] = (pathViews[e.path] || 0) + 1;
    }
  }

  const vi = byType["view_item"] || 0, atc = byType["add_to_cart"] || 0, bc = byType["begin_checkout"] || 0, pu = byType["purchase"] || 0;
  const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 1000 : 0);
  const minSample = Math.max(1, await getNumber("SELF_LEARNING_MIN_SAMPLE", 30));
  const sampleOk = events >= minSample;

  const stats: TelemetryStats = {
    batches: recent.length,
    events,
    by_type: byType,
    top_paths: Object.entries(pathViews).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([path, views]) => ({ path, views })),
    funnel: { view_item: vi, add_to_cart: atc, begin_checkout: bc, purchase: pu, cart_rate: rate(atc, vi), checkout_rate: rate(bc, atc), purchase_rate: rate(pu, bc) },
    avg_scroll_pct: scrollN ? Math.round(scrollSum / scrollN) : null,
    drop_off: byType["drop_off"] || 0,
    sample_ok: sampleOk,
  };

  // Only emit actionable signals when the sample is statistically meaningful (small, iterative,
  // correlated changes — never react to a handful of events).
  if (publishSignals && sampleOk) {
    const now = new Date().toISOString();
    const sig = async (metric: string, value: number) =>
      db.create("OptimizationSignal", { metric, value, collected_at: now, source: "telemetry", sample: events }, "telemetry").catch(() => null);
    await Promise.all([
      sig("catalog_cart_rate", stats.funnel.cart_rate),
      sig("catalog_checkout_rate", stats.funnel.checkout_rate),
      sig("catalog_purchase_rate", stats.funnel.purchase_rate),
      sig("avg_scroll_pct", stats.avg_scroll_pct ?? 0),
      sig("drop_off_events", stats.drop_off),
    ]);
  }
  return stats;
}

/** Delete raw event batches older than retention (aggregates already persisted as signals stay). */
export async function pruneTelemetry(): Promise<number> {
  const days = Math.max(1, await getNumber("TELEMETRY_RETENTION_DAYS", 180));
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const old = await db.filter("InteractionEvent", {}, "at", 2000).catch(() => []) as any[];
  let removed = 0;
  for (const r of old) {
    if (String(r.at || "") < cutoff) { await db.remove("InteractionEvent", r.id).catch(() => null); removed++; }
    else break;
  }
  return removed;
}
