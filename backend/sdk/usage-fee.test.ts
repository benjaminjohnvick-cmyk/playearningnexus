import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeUsageFee, surveysToOffset } from "./usage-fee.ts";

Deno.test("usage fee: charges the fee from available earnings", () => {
  const r = computeUsageFee({ feeUsd: 0.8, earnedAvailableUsd: 4, paidToDateUsd: 0, capUsd: 182 });
  assertEquals(r.fee, 0.8);
  assertEquals(r.cap_remaining, 181.2);
});

Deno.test("usage fee: NEVER a debt — no earnings means no fee", () => {
  const r = computeUsageFee({ feeUsd: 0.8, earnedAvailableUsd: 0, paidToDateUsd: 0, capUsd: 182 });
  assertEquals(r.fee, 0);
  assert(r.reason.includes("never a debt"));
  // Partial earnings → fee is clamped to what's available, never more.
  const p = computeUsageFee({ feeUsd: 0.8, earnedAvailableUsd: 0.3, paidToDateUsd: 0, capUsd: 182 });
  assertEquals(p.fee, 0.3);
});

Deno.test("usage fee: stops at the cap", () => {
  const atCap = computeUsageFee({ feeUsd: 0.8, earnedAvailableUsd: 4, paidToDateUsd: 182, capUsd: 182 });
  assertEquals(atCap.fee, 0);
  assert(atCap.reason.includes("cap"));
  // Near the cap → only the remaining headroom is charged.
  const near = computeUsageFee({ feeUsd: 0.8, earnedAvailableUsd: 4, paidToDateUsd: 181.7, capUsd: 182 });
  assertEquals(near.fee, 0.3);
  assertEquals(near.cap_remaining, 0);
});

Deno.test("surveysToOffset: one extra survey offsets the fee at parity", () => {
  assertEquals(surveysToOffset(0.8, 0.8), 1);
  assertEquals(surveysToOffset(0.8, 0.4), 2);
  assertEquals(surveysToOffset(0, 0.8), 0);
});
