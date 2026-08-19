// site-cash-apply.test.ts — auto-apply Site Cash (points) to a purchase, bounded by total + spend cap.
//   deno test backend/sdk/site-cash-apply.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { siteCashApplyPlan, resolveSiteCashAutoApply, siteCashAutoApplyEnabled } from "./site-cash-apply.ts";

Deno.test("per-user preference overrides the site default; unset falls back to the default", () => {
  // Explicit user preference wins either way.
  assertEquals(resolveSiteCashAutoApply({ auto_apply_site_cash: true }), true);
  assertEquals(resolveSiteCashAutoApply({ auto_apply_site_cash: false }), false);
  assertEquals(resolveSiteCashAutoApply({ auto_apply_site_cash: "off" }), false);
  // No preference set → the site default (on by default).
  assertEquals(resolveSiteCashAutoApply({}), siteCashAutoApplyEnabled());
  assertEquals(resolveSiteCashAutoApply(null), siteCashAutoApplyEnabled());
});

// Defaults: 1 point = $0.01; non-premium spend cap = 12% of balance, premium = 24%.

Deno.test("small purchase is fully covered by Site Cash (bounded by the total, no card remainder)", () => {
  // $50 purchase, 100,000 pts ($1,000) held. 12% cap = $120, so the $50 total is the binding limit.
  const p = siteCashApplyPlan({ faceUsd: 50, userPoints: 100000, isPremium: false });
  assertEquals(p.points_usd, 50);
  assertEquals(p.card_after_usd, 0);
  assertEquals(p.capped_by, "total");
});

Deno.test("large purchase is capped by the per-transaction spend cap (12% non-premium)", () => {
  // $1,000 purchase, 100,000 pts ($1,000) held. 12% cap = 12,000 pts = $120.
  const p = siteCashApplyPlan({ faceUsd: 1000, userPoints: 100000, isPremium: false });
  assertEquals(p.points_applied, 12000);
  assertEquals(p.points_usd, 120);
  assertEquals(p.card_after_usd, 880);
  assertEquals(p.capped_by, "cap");
});

Deno.test("premium buyers get the higher 24% cap", () => {
  const p = siteCashApplyPlan({ faceUsd: 1000, userPoints: 100000, isPremium: true });
  assertEquals(p.points_usd, 240);
  assertEquals(p.card_after_usd, 760);
});

Deno.test("no balance → nothing applied", () => {
  const p = siteCashApplyPlan({ faceUsd: 100, userPoints: 0, isPremium: false });
  assertEquals(p.apply, false);
  assertEquals(p.points_usd, 0);
  assertEquals(p.card_after_usd, 100);
});
