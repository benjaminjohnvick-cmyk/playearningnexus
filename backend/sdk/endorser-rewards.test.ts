// endorser-rewards.test.ts — the pure paid-endorser performance-reward core.
//   deno test backend/sdk/endorser-rewards.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { endorserRewardFor, capReward, remaining } from "./endorser-rewards.ts";

Deno.test("reward: a share of measured conversion value when disclosed + legit", () => {
  const r = endorserRewardFor({ conversion_value_usd: 100, disclosed: true }, 0.2, 1);
  assertEquals(r.ok, true);
  assertEquals(r.reward, 20);
});

Deno.test("reward: DISCLOSURE is required — undisclosed post earns nothing", () => {
  const r = endorserRewardFor({ conversion_value_usd: 100, disclosed: false }, 0.2, 1);
  assertEquals(r.ok, false);
  assertEquals(r.reward, 0);
  assert(r.reason.includes("disclosed"));
});

Deno.test("reward: self-conversion, below-minimum, and already-rewarded all pay 0", () => {
  assertEquals(endorserRewardFor({ conversion_value_usd: 100, disclosed: true, self_conversion: true }, 0.2, 1).reward, 0);
  assertEquals(endorserRewardFor({ conversion_value_usd: 0.5, disclosed: true }, 0.2, 1).reward, 0);
  assertEquals(endorserRewardFor({ conversion_value_usd: 100, disclosed: true, already_rewarded: true }, 0.2, 1).reward, 0);
});

Deno.test("caps: reward is clamped to the smaller of daily/period headroom", () => {
  // gross 20, daily room 8, period room 500 → paid 8 (daily-capped)
  const a = capReward(20, 8, 500);
  assertEquals(a.paid, 8);
  assertEquals(a.capped, true);
  assert(a.reason.includes("daily"));
  // gross 20, plenty of room → full 20
  const b = capReward(20, 100, 500);
  assertEquals(b.paid, 20);
  assertEquals(b.capped, false);
  // period-capped
  const c = capReward(20, 100, 5);
  assertEquals(c.paid, 5);
  assert(c.reason.includes("period"));
});

Deno.test("remaining: headroom under a cap; 0 = no cap = unlimited", () => {
  assertEquals(remaining(25, 10), 15);
  assertEquals(remaining(25, 30), 0);      // over
  assertEquals(remaining(0, 999), Number.POSITIVE_INFINITY);
});
