import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeDesiredInstances } from "./infra-scale.ts";

const opts = { perInstance: 600, min: 1, max: 8, maxStep: 2 };

Deno.test("scale up: more load needs more instances, clamped by step + max", () => {
  // load 1800 / 600 = 3 needed; from 1, step 2 → go to 3 (within step).
  assertEquals(computeDesiredInstances(1800, 1, opts).desired, 3);
  // Huge load caps at max (8), but only steps by 2 per tick from 1 → 3.
  assertEquals(computeDesiredInstances(100000, 1, opts).desired, 3);
  // From 6, huge load → step to 8 (max).
  assertEquals(computeDesiredInstances(100000, 6, opts).desired, 8);
});

Deno.test("scale down: low load reduces instances, floored at min, stepped", () => {
  // load 0 from 8 → need 1 (min), step down by 2 → 6.
  assertEquals(computeDesiredInstances(0, 8, opts).desired, 6);
  // load 0 from 2 → min 1.
  assertEquals(computeDesiredInstances(0, 2, opts).desired, 1);
});

Deno.test("hold: load matches current capacity → no change", () => {
  assertEquals(computeDesiredInstances(1200, 2, opts).desired, 2); // 1200/600 = 2 = current
});

Deno.test("never below min or above max", () => {
  assertEquals(computeDesiredInstances(0, 0, { ...opts, min: 2 }).desired, 2);
  assertEquals(computeDesiredInstances(999999, 100, { ...opts, max: 5, maxStep: 999 }).desired, 5);
});
