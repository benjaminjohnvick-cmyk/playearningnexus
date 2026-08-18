// tier3-unlimited.test.ts — unit tests for the Tier 3 Unlimited uncapped-scaling quote. Run in the Deno backend:
//   deno test backend/sdk/tier3-unlimited.test.ts
// Verifies: the budget floor is enforced, deliverables/value/impressions scale linearly from the rate card,
// and the ~2× value ratio holds at every budget (advertising VALUE, never a return).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { tier3UnlimitedQuote, tier3UnlimitedMinUsd } from "./tier3-unlimited.ts";

Deno.test("budget below the floor is raised to the minimum", () => {
  const q = tier3UnlimitedQuote(50000);
  assertEquals(q.budget_usd, tier3UnlimitedMinUsd());
  assertEquals(q.budget_usd >= 200000, true);
});

Deno.test("value scales linearly and holds the ~2x ratio at the base", () => {
  const q = tier3UnlimitedQuote(200000);
  assertEquals(q.scale_factor, 1);
  assertEquals(q.multiple >= 2, true);
  assertEquals(q.value_usd >= 400000, true);
});

Deno.test("doubling the budget doubles deliverables, value, and guaranteed impressions", () => {
  const a = tier3UnlimitedQuote(200000);
  const b = tier3UnlimitedQuote(400000);
  assertEquals(b.scale_factor, 2);
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
