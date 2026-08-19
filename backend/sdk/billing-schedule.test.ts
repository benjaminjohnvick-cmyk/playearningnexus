// billing-schedule.test.ts — full-year prepay tracked in 13 four-week cycles.
//   deno test backend/sdk/billing-schedule.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cycleLadder, billingScheduleStatus, annualPrepayAmount } from "./billing-schedule.ts";

Deno.test("the 13-cycle ladder splits the annual prepay evenly and sums to it exactly (last cycle absorbs rounding)", () => {
  const rows = cycleLadder(12000, "2026-08-01");
  assertEquals(rows.length, 13);
  assertEquals(rows[rows.length - 1].cumulative_usd, 12000); // exact
  // even split ~923.08; last cycle takes the remainder
  assert(Math.abs(rows[0].recognized_usd - 12000 / 13) < 0.01);
});

Deno.test("cycles are 28 days apart from the term start", () => {
  const rows = cycleLadder(200000, "2026-01-01");
  assertEquals(rows[0].starts_on, "2026-01-01");
  assertEquals(rows[1].starts_on, "2026-01-29"); // +28 days
});

Deno.test("status reports the current cycle and recognized-to-date; full year collected up front", () => {
  const start = "2026-01-01";
  // 30 days in → into cycle 2 (one 28-day cycle fully elapsed).
  const now = Date.parse("2026-01-31T00:00:00Z");
  const s = billingScheduleStatus("tier1", 12000, start, now);
  assertEquals(s.collect_mode, "upfront");
  assertEquals(s.collected_upfront_usd, 12000);
  assertEquals(s.cycles, 13);
  assertEquals(s.current_cycle, 2);
  assertEquals(s.cycles_elapsed, 1);
  assert(s.recognized_to_date_usd > 0 && s.recognized_to_date_usd < 12000);
  assertEquals(s.term_complete, false);
});

Deno.test("after the full year all cycles are elapsed and the whole prepay is recognized", () => {
  const s = billingScheduleStatus("tier2", 200000, "2026-01-01", Date.parse("2027-06-01T00:00:00Z"));
  assertEquals(s.term_complete, true);
  assertEquals(s.recognized_to_date_usd, 200000);
});

Deno.test("annual prepay amount resolves per tier from the tier price", () => {
  assertEquals(annualPrepayAmount("tier1"), 12000);   // FOUNDING_ADVERTISER_PRICE_USD default
  assertEquals(annualPrepayAmount("tier2"), 200000);  // FOUNDING_UPGRADE_PRICE_USD default
  // tier 3 clamps a small budget up to the floor (= tier 2 price)
  assertEquals(annualPrepayAmount("tier3", { budgetUsd: 50000 }), 200000);
  assertEquals(annualPrepayAmount("tier3", { budgetUsd: 500000 }), 500000);
});
