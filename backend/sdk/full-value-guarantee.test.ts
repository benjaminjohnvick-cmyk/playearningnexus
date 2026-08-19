// full-value-guarantee.test.ts — unit tests for the Full-Value Delivery Guarantee math. Run in the Deno backend:
//   deno test backend/sdk/full-value-guarantee.test.ts
// The offer is make-good only (deliver until met); the refund helper is bounded and off-by-default in the offer.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fvgStatus, fvgRefundOwed, impressionsValueUsd } from "./full-value-guarantee.ts";

Deno.test("impressions translate to a conventional dollar value at the CPM", () => {
  assertEquals(impressionsValueUsd(1_000_000, 22), 22000); // 1M × $22 CPM
  assertEquals(impressionsValueUsd(0, 22), 0);
});

Deno.test("promised/delivered value tracks in dollars; keep delivering until met", () => {
  const s = fvgStatus({ guaranteedImpressions: 6_000_000, deliveredImpressions: 3_000_000, priceUsd: 200000, cpm: 22 });
  assertEquals(s.promised_value_usd, 132000);   // 6M × $22
  assertEquals(s.delivered_value_usd, 66000);    // 3M × $22
  assertEquals(s.remaining_value_usd, 66000);
  assertEquals(s.fulfilled, false);
});

Deno.test("fulfilled when the full promised amount is delivered", () => {
  const s = fvgStatus({ guaranteedImpressions: 6_000_000, deliveredImpressions: 6_000_000, priceUsd: 200000, cpm: 22 });
  assertEquals(s.fulfilled, true);
  assertEquals(s.remaining_value_usd, 0);
  assertEquals(s.keep_delivering, false);
});

Deno.test("refund helper is bounded to undelivered value and never exceeds the price", () => {
  // undelivered 150k × $22 CPM = $3,300 (well under the $12k price)
  assertEquals(fvgRefundOwed(300_000, 150_000, 12000, 22), 3300);
  // fully delivered → 0
  assertEquals(fvgRefundOwed(300_000, 300_000, 12000, 22), 0);
  // huge undelivered value is capped at the price paid
  assertEquals(fvgRefundOwed(100_000_000, 0, 12000, 22), 12000);
});
