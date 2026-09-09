import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizeKind, engagementRates, engagementInsight, buildAffinity, scoreAdForUser, rankAdsForUser,
  type EngagementTotals,
} from "./ad-engagement.ts";

Deno.test("normalizeKind maps aliases and rejects junk", () => {
  assertEquals(normalizeKind("interested"), "interested");
  assertEquals(normalizeKind("Favorite"), "interested");
  assertEquals(normalizeKind("BUY"), "buy_now");
  assertEquals(normalizeKind("buy_now"), "buy_now");
  assertEquals(normalizeKind("nope"), null);
});

Deno.test("engagementRates computes interest/buy-now/conversion percentages", () => {
  const t: EngagementTotals = { impressions: 1000, interested: 50, buy_now: 10, purchases: 5 };
  const r = engagementRates(t);
  assertEquals(r.interest_rate_pct, 5);         // 50/1000
  assertEquals(r.buy_now_rate_pct, 1);          // 10/1000
  assertEquals(r.interest_to_purchase_pct, 10); // 5/50
});

Deno.test("engagementRates is safe on zero denominators", () => {
  const r = engagementRates({ impressions: 0, interested: 0, buy_now: 0 });
  assertEquals(r.interest_rate_pct, 0);
  assertEquals(r.interest_to_purchase_pct, 0);
});

Deno.test("insight flags the high-interest / low-buy friction case", () => {
  const t: EngagementTotals = { impressions: 1000, interested: 40, buy_now: 2, purchases: 0 };
  const msg = engagementInsight(t, engagementRates(t));
  assert(msg.toLowerCase().includes("friction") || msg.toLowerCase().includes("price"));
});

Deno.test("buildAffinity weights buy_now above interested", () => {
  const aff = buildAffinity([
    { kind: "interested", category: "tech" },
    { kind: "buy_now", category: "tech" },
    { kind: "interested", category: "home" },
  ]);
  assert(aff.categories["tech"] > aff.categories["home"]); // 1 + 3 vs 1
  assert(aff.buyIntent > 0);
});

Deno.test("scoreAdForUser cold-starts to proven performance with no history", () => {
  const aff = buildAffinity([]);
  const { score, reasons } = scoreAdForUser({ ad_id: "a1", category: "tech", buy_now_rate_pct: 2, interest_rate_pct: 5 }, aff);
  assert(score > 0);
  assert(reasons.join(" ").length >= 0);
});

Deno.test("rankAdsForUser puts the on-affinity ad first", () => {
  const aff = buildAffinity([{ kind: "buy_now", category: "tech" }, { kind: "interested", category: "tech" }]);
  const ranked = rankAdsForUser([
    { ad_id: "home", category: "home", interest_rate_pct: 1, buy_now_rate_pct: 0.2 },
    { ad_id: "tech", category: "tech", interest_rate_pct: 1, buy_now_rate_pct: 0.2 },
  ], aff);
  assertEquals(ranked[0].ad_id, "tech");
});
