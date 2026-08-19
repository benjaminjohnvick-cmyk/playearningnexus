// advertiser-cancellation.test.ts — 30-day proportional cancellation (keep 2/3, refund 1/3).
//   deno test backend/sdk/advertiser-cancellation.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cancellationQuote } from "./advertiser-cancellation.ts";

Deno.test("Tier 1: cancel in-window keeps $8,000 and refunds $4,000 (exactly)", () => {
  const q = cancellationQuote({ paidUsd: 12000, purchasedAtISO: "2026-08-01", nowMs: Date.parse("2026-08-10T00:00:00Z") });
  assertEquals(q.within_window, true);
  assertEquals(q.refund_usd, 4000);
  assertEquals(q.kept_usd, 8000);
});

Deno.test("proportional at any tier: keep two-thirds, refund one-third", () => {
  const q = cancellationQuote({ paidUsd: 200000, purchasedAtISO: "2026-08-01", nowMs: Date.parse("2026-08-05T00:00:00Z") });
  assertEquals(q.refund_usd, 66666.67);
  assertEquals(q.kept_usd, 133333.33);
});

Deno.test("outside the 30-day window: no cancellation refund (guarantee governs)", () => {
  const q = cancellationQuote({ paidUsd: 12000, purchasedAtISO: "2026-08-01", nowMs: Date.parse("2026-09-15T00:00:00Z") });
  assertEquals(q.within_window, false);
  assertEquals(q.refund_usd, 0);
  assertEquals(q.kept_usd, 0);
});

Deno.test("exactly on day 30 is still in-window; day 31 is out", () => {
  const day30 = cancellationQuote({ paidUsd: 12000, purchasedAtISO: "2026-08-01T00:00:00Z", nowMs: Date.parse("2026-08-31T00:00:00Z") });
  assertEquals(day30.within_window, true);
  const day31 = cancellationQuote({ paidUsd: 12000, purchasedAtISO: "2026-08-01T00:00:00Z", nowMs: Date.parse("2026-09-01T00:00:00Z") });
  assertEquals(day31.within_window, false);
});
