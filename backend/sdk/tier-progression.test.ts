// tier-progression.test.ts — the pure core of the advertiser tier-progression engine.
//   deno test backend/sdk/tier-progression.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  nextTier, normalizeTier, yearsAccounting, evaluateResults, renewalEligible,
  advanceEligible, progressionDecision, renewalPatch, advancePatch,
} from "./tier-progression.ts";

// Pin one clock so `TODAY - iso(n)` is exactly n whole years (plus a 2-day buffer so floor() is stable).
const NOW = Date.now();
const TODAY = new Date(NOW).toISOString();
const iso = (yearsAgo: number) => new Date(NOW - (yearsAgo * 365.25 + 2) * 24 * 3600 * 1000).toISOString();

Deno.test("ladder: next tier + normalization", () => {
  assertEquals(nextTier("tier1"), "tier2");
  assertEquals(nextTier("tier2"), "tier3");
  assertEquals(nextTier("tier3"), null);
  assertEquals(normalizeTier("weird"), "tier1");
});

Deno.test("years accounting: caps (T1+2 ≤ 2, T3 ≤ 3, total ≤ 5)", () => {
  // 1 year into tier1, no prior banked
  const a = yearsAccounting({ current_tier: "tier1", tier_started_at: iso(1) }, TODAY);
  assertEquals(a.years_at_current, 1);
  assertEquals(a.tier12_years_used, 1);
  assertEquals(a.tier12_years_left, 1);   // 2 - 1
  assertEquals(a.total_years_left, 4);    // 5 - 1
  // at tier3 with 1 banked tier12 year + 2 years into tier3
  const b = yearsAccounting({ current_tier: "tier3", tier_started_at: iso(2), tier12_years: 2, tier3_years: 0 }, TODAY);
  assertEquals(b.tier3_years_used, 2);
  assertEquals(b.tier3_years_left, 1);    // 3 - 2
  assertEquals(b.total_years_used, 4);    // 2 (t12) + 2 (t3)
  assertEquals(b.total_years_left, 1);    // 5 - 4
});

Deno.test("evaluateResults: 'going well' needs substantiated + ROAS ≥ baseline + delivery on track", () => {
  assertEquals(evaluateResults({ roas: 2.5, delivered_pct: 0.95, substantiated: true }).going_well, true);
  assertEquals(evaluateResults({ roas: 0.5, delivered_pct: 0.95, substantiated: true }).going_well, false); // low ROAS
  assertEquals(evaluateResults({ roas: 2.5, delivered_pct: 0.4, substantiated: true }).going_well, false);  // behind delivery
  assertEquals(evaluateResults({ roas: 2.5, delivered_pct: 0.95, substantiated: false }).going_well, false); // not substantiated
});

Deno.test("renewalEligible: needs headroom under the applicable cap", () => {
  const acc1 = yearsAccounting({ current_tier: "tier1", tier_started_at: iso(0) }, TODAY);
  assertEquals(renewalEligible({ current_tier: "tier1" }, acc1), true);
  // tier1+2 cap exhausted
  const accFull = yearsAccounting({ current_tier: "tier2", tier_started_at: iso(1), tier12_years: 1 }, TODAY);
  assertEquals(renewalEligible({ current_tier: "tier2" }, accFull), false); // 1 prior + 1 now = 2 = cap
});

Deno.test("advanceEligible: opted in + measured ROAS ≥ threshold + headroom", () => {
  const acc = yearsAccounting({ current_tier: "tier1", tier_started_at: iso(1) }, TODAY);
  const good = evaluateResults({ roas: 3.0, delivered_pct: 0.95, substantiated: true });
  // explicit opt-out → not eligible even with great results
  assertEquals(advanceEligible({ current_tier: "tier1", auto_advance_opt_in: false }, good, acc).eligible, false);
  // unset field follows the platform default (default opt-in is ON) → eligible
  assertEquals(advanceEligible({ current_tier: "tier1" }, good, acc).eligible, true);
  // opted in + ROAS above threshold → eligible to tier2
  const r = advanceEligible({ current_tier: "tier1", auto_advance_opt_in: true, auto_advance_roas: 2.0 }, good, acc);
  assertEquals(r.eligible, true);
  assertEquals(r.to, "tier2");
  // opted in but ROAS below their threshold → not eligible
  const low = evaluateResults({ roas: 1.2, delivered_pct: 0.95, substantiated: true });
  assertEquals(advanceEligible({ current_tier: "tier1", auto_advance_opt_in: true, auto_advance_roas: 2.0 }, low, acc).eligible, false);
});

Deno.test("progressionDecision: recommends advance > renew > complete at a term boundary", () => {
  const rec = { current_tier: "tier1", tier_started_at: iso(1), auto_advance_opt_in: true, auto_advance_roas: 2.0 };
  const dec = progressionDecision(rec, { roas: 3.0, delivered_pct: 0.95, substantiated: true }, TODAY, true);
  assertEquals(dec.recommended, "advance");
  // same advertiser, not opted in → renew
  const dec2 = progressionDecision({ ...rec, auto_advance_opt_in: false }, { roas: 3.0, delivered_pct: 0.95, substantiated: true }, TODAY, true);
  assertEquals(dec2.recommended, "renew");
  // caps exhausted → complete
  const dec3 = progressionDecision({ current_tier: "tier3", tier_started_at: iso(3), tier12_years: 2 }, { roas: 3, delivered_pct: 0.95, substantiated: true }, TODAY, true);
  assertEquals(dec3.recommended, "complete");
  // not at a boundary → hold
  assertEquals(progressionDecision(rec, { roas: 3, substantiated: true }, TODAY, false).recommended, "hold");
});

Deno.test("patches: renewal banks a year; advance moves tier + banks years", () => {
  const rp = renewalPatch({ current_tier: "tier1", tier12_years: 0 }, TODAY);
  assertEquals(rp.tier12_years, 1);
  const ap = advancePatch({ current_tier: "tier1", tier_started_at: iso(1) }, TODAY);
  assert(ap);
  assertEquals(ap!.to, "tier2");
  assertEquals(ap!.patch.current_tier, "tier2");
  assertEquals(advancePatch({ current_tier: "tier3" }, TODAY), null); // no next tier
});
