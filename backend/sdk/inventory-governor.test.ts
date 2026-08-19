// inventory-governor.test.ts — the committed-inventory accounting that stops the delivery guarantee from
// overselling. Run in the Deno backend:  deno test backend/sdk/inventory-governor.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { committedFromPlans, fillRate } from "./inventory-governor.ts";

const STD = 5_000_000; // a standard Tier 2 guaranteed-per-seat volume for these tests

Deno.test("standard Tier 2 seats are counted at the standard per-seat volume", () => {
  const rows = [{ status: "active" }, { guaranteed_impressions_per_year: 0 }, { guaranteed_impressions_per_year: STD }];
  const b = committedFromPlans(rows, STD);
  assertEquals(b.active_tier2, 3);
  assertEquals(b.active_tier3, 0);
  assertEquals(b.committed_tier2, 3 * STD);
  assertEquals(b.committed_tier3, 0);
});

Deno.test("a Tier 3 Unlimited plan is counted at its real scaled volume, not the flat allotment", () => {
  // One standard Tier 2 seat + one Tier 3 plan guaranteeing 10× a standard seat.
  const rows = [{ guaranteed_impressions_per_year: STD }, { guaranteed_impressions_per_year: 10 * STD }];
  const b = committedFromPlans(rows, STD);
  assertEquals(b.active_tier2, 1);
  assertEquals(b.active_tier3, 1);
  assertEquals(b.committed_tier2, STD);
  assertEquals(b.committed_tier3, 10 * STD);
  // The Tier 3 plan alone contributes 10× a standard seat — the old flat-allotment math would have counted it as
  // 1× and silently oversold ~9 seats' worth of inventory.
  assertEquals(b.committed_tier2 + b.committed_tier3, 11 * STD);
});

Deno.test("empty / missing rows are safe", () => {
  const b = committedFromPlans([], STD);
  assertEquals(b, { committed_tier2: 0, committed_tier3: 0, active_tier2: 0, active_tier3: 0 });
});

Deno.test("fillRate flags a seat that is materially behind pace", () => {
  // Half the year elapsed, but only 10% of the year's promise delivered → behind.
  const fr = fillRate(1_000_000, 100_000, 0.5);
  assertEquals(fr.promised_to_date, 500_000);
  assertEquals(fr.under_pacing, true);
});
