// scale-governor.ts — the automatic SCALE controller. The mirror image of costFloorProfile: the cost floor
// pushes every lever to its cheapest setting; the scale governor watches live load and, when a metric crosses
// an "up" threshold, flips the relevant lever to its SCALED setting — then flips it back when load subsides
// (hysteresis, so it never flaps). It switches CONFIG the rest of the platform already reads (render provider,
// caches, read-replica routing, render/worker concurrency, AI capacity tier), so "scale up across the whole
// site" happens by moving settings, while the serverless providers (GPU render, DB replica, cache) do the
// actual elastic provisioning underneath. Gated behind AUTO_SCALE_ENABLED; the run job is preview-only while off.
//
// Design: each lever declares a BASE value, a SCALED value, the METRIC that drives it, and up/down thresholds.
// The decision is pure and deterministic so it is fully unit-testable and auditable.

import { snapBool, snapNumber, snapString } from "./settings.ts";

export const autoScaleEnabled = () => snapBool("AUTO_SCALE_ENABLED", false);

export interface ScaleMetrics {
  active_users: number;      // concurrent / recently-active users
  requests_per_min: number;  // API request rate
  queue_depth: number;       // background job backlog
  render_per_day: number;    // video renders queued/day
  db_read_qps: number;       // DB read queries/sec
}
export type ScaleMetricKey = keyof ScaleMetrics;

export interface ScaleLever {
  key: string;               // the setting to flip
  base: string;              // cheap / low-scale value
  scaled: string;            // scaled value
  metric: ScaleMetricKey;    // the metric that drives this lever
  up: number;                // flip to `scaled` when metric >= up
  down: number;              // flip back to `base` when metric <= down (down < up = hysteresis)
  label: string;
}

/** Default scale levers. Thresholds are conservative defaults; each is overridable via settings (see
 *  scaleLeversFromSettings). "scaled" values point at the elastic/serverless options. */
export const DEFAULT_SCALE_LEVERS: ScaleLever[] = [
  { key: "VIDEO_ENGINE_RENDER_PROVIDER", base: "none", scaled: "serverless_gpu", metric: "render_per_day", up: 50, down: 10, label: "Video render → auto-scaling serverless GPU" },
  { key: "CACHE_ENABLED", base: "0", scaled: "1", metric: "requests_per_min", up: 600, down: 200, label: "Shared cache on under load" },
  { key: "DB_USE_REPLICA", base: "0", scaled: "1", metric: "db_read_qps", up: 200, down: 50, label: "Route reads to the DB replica" },
  { key: "RENDER_CONCURRENCY", base: "1", scaled: "8", metric: "render_per_day", up: 50, down: 10, label: "Raise render parallelism" },
  { key: "QUEUE_WORKERS", base: "2", scaled: "16", metric: "queue_depth", up: 500, down: 100, label: "Scale background workers" },
  { key: "AI_SCALE_TIER", base: "floor", scaled: "scaled", metric: "requests_per_min", up: 600, down: 200, label: "AI capacity tier → scaled" },
];

/** Read per-lever thresholds/values from settings if present, else use the default. Impure (reads settings). */
export function scaleLeversFromSettings(): ScaleLever[] {
  // NOTE: snapNumber returns 0 for UNREGISTERED numeric keys, so treat 0 as "not overridden → use the default"
  // (a threshold of 0 would mean "always scaled", which is never the intent). snapString falls back correctly.
  return DEFAULT_SCALE_LEVERS.map((l) => {
    const up = snapNumber(`SCALE_${l.key}_UP`, l.up);
    const down = snapNumber(`SCALE_${l.key}_DOWN`, l.down);
    return {
      ...l,
      scaled: snapString(`SCALE_${l.key}_SCALED`, l.scaled) || l.scaled,
      up: up > 0 ? up : l.up,
      down: down > 0 ? down : l.down,
    };
  });
}

export interface ScaleChange { key: string; from: string; to: string; direction: "up" | "down"; reason: string; }
export interface ScaleDecision { changes: ScaleChange[]; scaled_count: number; at_scale: boolean; }

/** Decide which levers to flip given live metrics and their CURRENT values. Pure + deterministic.
 *  - metric >= up  and not already scaled → flip to scaled ("up")
 *  - metric <= down and not already base   → flip to base   ("down")
 *  - in between → leave as-is (hysteresis band prevents flapping). */
export function decideScale(levers: ScaleLever[], metrics: ScaleMetrics, current: Record<string, string>): ScaleDecision {
  const changes: ScaleChange[] = [];
  let scaledNow = 0;
  for (const l of levers) {
    const cur = String(current[l.key] ?? l.base);
    const m = Math.max(0, Number(metrics[l.metric]) || 0);
    const isScaled = cur === l.scaled;
    if (m >= l.up && !isScaled) {
      changes.push({ key: l.key, from: cur, to: l.scaled, direction: "up", reason: `${l.metric}=${m} ≥ ${l.up} — ${l.label}` });
      scaledNow++;
    } else if (m <= l.down && cur !== l.base) {
      changes.push({ key: l.key, from: cur, to: l.base, direction: "down", reason: `${l.metric}=${m} ≤ ${l.down} — back to base` });
    } else if (isScaled) {
      scaledNow++;
    }
  }
  return { changes, scaled_count: scaledNow, at_scale: scaledNow > 0 };
}

// ── Resilient-mode state machine (pure) ─────────────────────────────────────────────────────────────────
// Decides the on-device-fallback state from live load, with hysteresis so it escalates fast but de-escalates
// only after load has clearly dropped (no flapping users in/out of on-device mode).
export type ResilientState = "normal" | "degraded" | "overloaded";
const RM_LEVEL: Record<ResilientState, number> = { normal: 0, degraded: 1, overloaded: 2 };
const RM_STATE: ResilientState[] = ["normal", "degraded", "overloaded"];

export interface ResilientThresholds { degradeUp: number; overloadUp: number; degradeDown: number; overloadDown: number; }

/** Next resilient state from load (req/min) + current state. Escalate the moment an up-threshold is crossed;
 *  de-escalate only once load falls below the down-threshold for the current level. Pure + deterministic. */
export function resilientAutoDecide(loadRpm: number, current: ResilientState, t: ResilientThresholds): ResilientState {
  const load = Math.max(0, Number(loadRpm) || 0);
  const cur = RM_LEVEL[current] ?? 0;
  const rawLevel = load >= t.overloadUp ? 2 : load >= t.degradeUp ? 1 : 0;
  if (rawLevel > cur) return RM_STATE[rawLevel];                       // escalate immediately
  if (rawLevel < cur) {                                               // de-escalate only past the down-threshold
    if (cur === 2) return load <= t.overloadDown ? (load >= t.degradeUp ? "degraded" : "normal") : "overloaded";
    if (cur === 1) return load <= t.degradeDown ? "normal" : "degraded";
  }
  return current;
}
