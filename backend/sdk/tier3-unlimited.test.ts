// tier3-unlimited.test.ts — unit tests for the Tier 3 Unlimited uncapped-scaling quote. Run in the Deno backend:
//   deno test backend/sdk/tier3-unlimited.test.ts
// Verifies: the budget floor is enforced, deliverables/value/impressions scale linearly from the rate card,
// and the ~2× value ratio holds at every budget (advertising VALUE, never a return).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { tier3UnlimitedQuote, tier3UnlimitedMinUsd, tier3UnlimitedDeliveryOutlook } from "./tier3-unlimited.ts";

Deno.test("budget below the floor is raised to the minimum", () => {
  const q = tier3UnlimitedQuote(50000);
  assertEquals(q.budget_usd, tier3UnlimitedMinUsd());
  assertEquals(q.budget_usd >= 200000, true);
});

Deno.test("value holds the ~2x ratio at the floor", () => {
  const min = tier3UnlimitedMinUsd();
  const q = tier3UnlimitedQuote(min);
  assertEquals(q.budget_usd, min);
  assertEquals(q.multiple >= 2, true);              // ~2× of what they pay
  assertEquals(q.value_usd >= min * 1.9, true);
});

Deno.test("doubling the budget doubles deliverables, value, and guaranteed impressions", () => {
  // Both budgets above the floor so neither is clamped.
  const a = tier3UnlimitedQuote(300000);
  const b = tier3UnlimitedQuote(600000);
  assertEquals(Math.round(b.value_usd), Math.round(a.value_usd * 2));
  assertEquals(b.guaranteed_impressions_per_year, a.guaranteed_impressions_per_year * 2);
  // The value ratio is preserved as it scales (it's a value stack, not a return).
  assertEquals(a.multiple, b.multiple);
});

Deno.test("delivery is always capacity-paced and prepaid (never credit)", () => {
  const q = tier3UnlimitedQuote(1000000);
  assertEquals(q.delivery_mode, "capacity_paced");
  assertEquals(q.prepay, true);
});

Deno.test("delivery outlook: volume within capacity is not over-time", () => {
  const o = tier3UnlimitedDeliveryOutlook(6_000_000, 40_000_000);
  assertEquals(o.exceeds_current_inventory, false);
  assertEquals(o.est_min_years_to_match, 1);
});

Deno.test("delivery outlook: volume beyond capacity is matched over multiple years", () => {
  const o = tier3UnlimitedDeliveryOutlook(120_000_000, 40_000_000);
  assertEquals(o.exceeds_current_inventory, true);
  assertEquals(o.est_min_years_to_match, 3); // 120M / 40M/yr
  assertEquals(o.guaranteed_total, 120_000_000);
});

Deno.test("delivery outlook: unknown capacity (0) does not claim an over-time shortfall", () => {
  const o = tier3UnlimitedDeliveryOutlook(120_000_000, 0);
  assertEquals(o.exceeds_current_inventory, false);
  assertEquals(o.est_min_years_to_match, 0);
});
