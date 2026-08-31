import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decideScale, DEFAULT_SCALE_LEVERS, type ScaleMetrics } from "./scale-governor.ts";

const lowMetrics: ScaleMetrics = { active_users: 5, requests_per_min: 20, queue_depth: 5, render_per_day: 2, db_read_qps: 10 };
const highMetrics: ScaleMetrics = { active_users: 5000, requests_per_min: 2000, queue_depth: 2000, render_per_day: 500, db_read_qps: 800 };
const baseCurrent = Object.fromEntries(DEFAULT_SCALE_LEVERS.map((l) => [l.key, l.base]));

Deno.test("scale up: every lever flips to its scaled value under high load", () => {
  const d = decideScale(DEFAULT_SCALE_LEVERS, highMetrics, baseCurrent);
  assert(d.at_scale);
  // render provider goes to serverless_gpu
  const render = d.changes.find((c) => c.key === "VIDEO_ENGINE_RENDER_PROVIDER");
  assertEquals(render?.to, "serverless_gpu");
  assertEquals(render?.direction, "up");
  // all six levers flip up
  assertEquals(d.changes.length, DEFAULT_SCALE_LEVERS.length);
  assert(d.changes.every((c) => c.direction === "up"));
});

Deno.test("stay put: low load with base current = no changes", () => {
  const d = decideScale(DEFAULT_SCALE_LEVERS, lowMetrics, baseCurrent);
  assertEquals(d.changes.length, 0);
  assertEquals(d.at_scale, false);
});

Deno.test("scale down: low load with scaled current flips back to base", () => {
  const scaledCurrent = Object.fromEntries(DEFAULT_SCALE_LEVERS.map((l) => [l.key, l.scaled]));
  const d = decideScale(DEFAULT_SCALE_LEVERS, lowMetrics, scaledCurrent);
  assert(d.changes.every((c) => c.direction === "down"));
  assertEquals(d.changes.find((c) => c.key === "VIDEO_ENGINE_RENDER_PROVIDER")?.to, "none");
});

Deno.test("hysteresis: metric between down and up leaves the lever as-is (no flap)", () => {
  // render_per_day up=50 down=10; pick 30 → in the band. Current scaled stays scaled; current base stays base.
  const mid: ScaleMetrics = { ...lowMetrics, render_per_day: 30 };
  const fromBase = decideScale(DEFAULT_SCALE_LEVERS, mid, baseCurrent);
  assertEquals(fromBase.changes.find((c) => c.key === "VIDEO_ENGINE_RENDER_PROVIDER"), undefined);
  const scaledCurrent = { ...baseCurrent, VIDEO_ENGINE_RENDER_PROVIDER: "serverless_gpu" };
  const fromScaled = decideScale(DEFAULT_SCALE_LEVERS, mid, scaledCurrent);
  assertEquals(fromScaled.changes.find((c) => c.key === "VIDEO_ENGINE_RENDER_PROVIDER"), undefined);
});

import { resilientAutoDecide, type ResilientState } from "./scale-governor.ts";
const RT = { degradeUp: 800, overloadUp: 1500, degradeDown: 500, overloadDown: 1000 };

Deno.test("resilientAutoDecide: escalates immediately on load", () => {
  assertEquals(resilientAutoDecide(200, "normal", RT), "normal");
  assertEquals(resilientAutoDecide(900, "normal", RT), "degraded");
  assertEquals(resilientAutoDecide(1600, "normal", RT), "overloaded");
});

Deno.test("resilientAutoDecide: de-escalates only past the down-threshold (hysteresis)", () => {
  // overloaded, load drops to 1200 (< overloadUp but > overloadDown) → stays overloaded (no flap)
  assertEquals(resilientAutoDecide(1200, "overloaded", RT), "overloaded");
  // drops to 900 (<= overloadDown, still >= degradeUp) → degraded
  assertEquals(resilientAutoDecide(900, "overloaded", RT), "degraded");
  // degraded, load 600 (> degradeDown) → stays degraded
  assertEquals(resilientAutoDecide(600, "degraded", RT), "degraded");
  // degraded, load 400 (<= degradeDown) → normal
  assertEquals(resilientAutoDecide(400, "degraded", RT), "normal");
});
