// founding-advertiser.test.ts — two-phase pricing + category exclusivity.
//   deno test backend/sdk/founding-advertiser.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  foundingPriceUsd, tier1PriceUpliftPct, tier1PostFoundingPriceUsd,
  foundingDisclosureCopy, foundingCategoryTaken, foundingSlots,
} from "./founding-advertiser.ts";

Deno.test("founding cap defaults to the 200,000 aspirational ceiling", () => {
  assertEquals(foundingSlots(), 200000);
});

Deno.test("post-founding Tier 1 price is +30% over the founding price", () => {
  assertEquals(tier1PriceUpliftPct(), 0.30);
  // founding $13,000 (13-period) × 1.30 = $16,900
  assertEquals(tier1PostFoundingPriceUsd(), Math.round(foundingPriceUsd() * 1.30 * 100) / 100);
  assertEquals(tier1PostFoundingPriceUsd(), 16900);
});

Deno.test("the delivery disclosure is present and is capacity-paced, no-ROI", () => {
  const d = foundingDisclosureCopy();
  assertEquals(d.includes("CAPACITY-PACED"), true);
  assertEquals(d.includes("NOT a guarantee of revenue"), true);
});

Deno.test("category exclusivity: a live founder's category is taken; others are free", async () => {
  const rows = [
    { category: "Fitness", category_key: "fitness", tier1: true, status: "active" },
    { category: "Coffee", category_key: "coffee", tier1: true, status: "cancelled" }, // cancelled → frees it
  ];
  // Fake dbi honors the exact category_key filter the scale-safe query relies on.
  const dbi = {
    filter: (_n: string, q: Record<string, unknown>) =>
      Promise.resolve(rows.filter((r) => r.category_key === q.category_key)),
  };
  assertEquals(await foundingCategoryTaken(dbi, "Fitness"), true);
  assertEquals(await foundingCategoryTaken(dbi, "fitness"), true);   // case-insensitive (normalized key)
  assertEquals(await foundingCategoryTaken(dbi, "Coffee"), false);   // cancelled seat doesn't hold it
  assertEquals(await foundingCategoryTaken(dbi, "Gaming"), false);   // unclaimed
  assertEquals(await foundingCategoryTaken(dbi, ""), false);         // empty
});
