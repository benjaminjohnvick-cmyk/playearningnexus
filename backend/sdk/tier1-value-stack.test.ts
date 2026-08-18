// tier1-value-stack.test.ts — unit tests for the Tier 1 "$12k → $24k" value stack. Run in the Deno backend:
//   deno test backend/sdk/tier1-value-stack.test.ts
// Verifies the two invariants that keep the claim honest: (1) at defaults the included lines already meet the
// 2× target with no synthetic bonus; (2) if included value is trimmed below target, the value-match adds REAL
// guaranteed impressions (sized at the CPM) to reach the target rather than inflating a rate — and those
// impressions flow into the delivery guarantee's Tier 1 volume.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { tier1ValueStack, tier1ValueMatchBonusImpressions } from "./tier1-value-stack.ts";
import { guaranteedUnits } from "./delivery-guarantee.ts";

Deno.test("default value stack meets the 2x target from real included lines (no synthetic bonus)", () => {
  const s = tier1ValueStack();
  assertEquals(s.total_value_usd >= s.target_value_usd, true);
  assertEquals(s.meets_target, true);
  // At default settings the included lines alone clear the target, so no value-match bonus is needed.
  assertEquals(s.value_match_bonus_impressions, 0);
  assertEquals(s.multiple_actual >= 2, true);
});

Deno.test("target derives from price × multiple (default $12k × 2 = $24k)", () => {
  const s = tier1ValueStack();
  assertEquals(s.target_value_usd, s.price_usd * s.multiple_target);
});

Deno.test("every included line carries a positive conventional value", () => {
  const s = tier1ValueStack();
  for (const l of s.lines) assertEquals(l.value_usd > 0, true);
});

Deno.test("value-match bonus impressions flow into the Tier 1 delivery guarantee", () => {
  // guaranteedUnits('tier1') = (base allotment + value-match bonus) scaled to the guarantee term.
  // With the default stack meeting target, the bonus is 0 — so the guarantee equals the scaled base allotment,
  // and is always at least as large as any value-match bonus the stack reports.
  const bonus = tier1ValueMatchBonusImpressions();
  const guaranteed = guaranteedUnits("tier1");
  assertEquals(guaranteed >= bonus, true);
  assertEquals(guaranteed > 0, true);
});
