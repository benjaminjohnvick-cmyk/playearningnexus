// delivery-guarantee.test.ts — unit tests for the pure delivery make-good math. Run in the Deno backend:
//   deno test backend/sdk/delivery-guarantee.test.ts
// These cover the invariants that keep the make-good safe: it's bounded by the guaranteed volume, only owed at
// term end, and behaves sanely at the edges (over-delivery, zero guarantee, mid-term pacing).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { makeGoodStatus, fractionElapsed, termEnded } from "./delivery-guarantee.ts";

Deno.test("term-end shortfall owes exactly the shortfall as a make-good", () => {
  const s = makeGoodStatus({ tier: "tier1", guaranteedUnits: 1000, deliveredUnits: 400, fractionElapsed: 1, termEnded: true });
  assertEquals(s.make_good_units, 600);
  assertEquals(s.status, "make_good_owed");
});

Deno.test("met guarantee is fulfilled with no make-good", () => {
  const s = makeGoodStatus({ tier: "tier1", guaranteedUnits: 1000, deliveredUnits: 1000, fractionElapsed: 1, termEnded: true });
  assertEquals(s.make_good_units, 0);
  assertEquals(s.fulfilled, true);
  assertEquals(s.status, "fulfilled");
});

Deno.test("over-delivery never produces a negative or nonzero make-good", () => {
  const s = makeGoodStatus({ tier: "tier2", guaranteedUnits: 1000, deliveredUnits: 1500, fractionElapsed: 1, termEnded: true });
  assertEquals(s.make_good_units, 0);
  assertEquals(s.fulfilled, true);
});

Deno.test("BOUNDED: make-good can never exceed the guaranteed volume sold", () => {
  const s = makeGoodStatus({ tier: "tier1", guaranteedUnits: 1000, deliveredUnits: 0, fractionElapsed: 1, termEnded: true });
  assertEquals(s.make_good_units, 1000); // capped at guaranteed, not more
});

Deno.test("mid-term shortfall is 'behind' but owes nothing before term end", () => {
  const s = makeGoodStatus({ tier: "tier1", guaranteedUnits: 1000, deliveredUnits: 100, fractionElapsed: 0.5, termEnded: false });
  assertEquals(s.status, "behind");
  assertEquals(s.make_good_units, 0);
  assertEquals(s.under_pacing, true);
});

Deno.test("mid-term on-pace delivery reads as on_pace", () => {
  const s = makeGoodStatus({ tier: "tier1", guaranteedUnits: 1000, deliveredUnits: 500, fractionElapsed: 0.5, termEnded: false });
  assertEquals(s.status, "on_pace");
  assertEquals(s.under_pacing, false);
});

Deno.test("zero guarantee is fulfilled (no divide-by-zero)", () => {
  const s = makeGoodStatus({ tier: "tier1", guaranteedUnits: 0, deliveredUnits: 0, fractionElapsed: 1, termEnded: true });
  assertEquals(s.fulfilled, true);
  assertEquals(s.make_good_units, 0);
});

Deno.test("fractionElapsed clamps to [0,1] and handles a bad start date", () => {
  const now = Date.parse("2026-07-01T00:00:00Z");
  assertEquals(fractionElapsed("", now, 12), 0);           // no start → 0
  const halfway = Date.parse("2026-01-01T00:00:00Z");       // ~6 months before now, 12-mo term
  const f = fractionElapsed(new Date(halfway).toISOString(), now, 12);
  assertEquals(f > 0 && f <= 1, true);
});

Deno.test("termEnded is false before term+grace and true after", () => {
  const start = "2025-01-01T00:00:00Z";
  const beforeEnd = Date.parse("2025-06-01T00:00:00Z"); // 5 months in, 12-mo term
  const afterEnd = Date.parse("2026-03-01T00:00:00Z");  // >12 months + grace
  assertEquals(termEnded(start, beforeEnd, 12, 0), false);
  assertEquals(termEnded(start, afterEnd, 12, 0), true);
});
