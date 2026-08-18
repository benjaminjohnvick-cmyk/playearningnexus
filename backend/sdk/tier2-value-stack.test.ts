// tier2-value-stack.test.ts — unit tests for the Tier 2 "$200k → $400k" value stack. Run in the Deno backend:
//   deno test backend/sdk/tier2-value-stack.test.ts
// Verifies the same invariants as Tier 1: at defaults the A–D rate card already clears the 2× target with no
// synthetic bonus; the target derives from price × multiple; and the value-match bonus (0 at defaults) folds
// into the Tier 2 delivery-guarantee volume.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { tier2ValueStack, tier2ValueMatchBonusImpressions } from "./tier2-value-stack.ts";
import { guaranteedUnits } from "./delivery-guarantee.ts";

Deno.test("default Tier 2 rate card meets the 2x target from real lines (no synthetic bonus)", () => {
  const s = tier2ValueStack();
  assertEquals(s.total_value_usd >= s.target_value_usd, true);
  assertEquals(s.meets_target, true);
  assertEquals(s.value_match_bonus_impressions, 0);
  assertEquals(s.multiple_actual >= 2, true);
});

Deno.test("target derives from price × multiple (default $200k × 2 = $400k)", () => {
  const s = tier2ValueStack();
  assertEquals(s.target_value_usd, s.price_usd * s.multiple_target);
});

Deno.test("rate card list value is carried through and is positive", () => {
  const s = tier2ValueStack();
  assertEquals(s.included_value_usd > 0, true);
  assertEquals(s.included_value_usd, s.rate_card.list_value_usd);
});

Deno.test("value-match bonus folds into the Tier 2 delivery-guarantee volume", () => {
  const bonus = tier2ValueMatchBonusImpressions();
  const guaranteed = guaranteedUnits("tier2");
  assertEquals(guaranteed >= bonus, true);
  assertEquals(guaranteed > 0, true);
});
