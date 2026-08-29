// feedback.test.ts — the standard feedback event + its mapping to learning weight.
//   deno test backend/sdk/feedback.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeFeedback, feedbackToWeight, aggregateFeedback, domainForSurface } from "./feedback.ts";

Deno.test("domainForSurface: maps pages to the right learning domain by keyword", () => {
  assertEquals(domainForSurface("AIVideoStudio"), "video");
  assertEquals(domainForSurface("StoreCheckout"), "catalog");
  assertEquals(domainForSurface("ForYouFeed"), "recommendation");
  assertEquals(domainForSurface("SurveyRun"), "survey");
  assertEquals(domainForSurface("SupportCenter"), "support_answer");
  assertEquals(domainForSurface("Onboarding"), "onboarding");
  assertEquals(domainForSurface("SomethingUnmapped"), null);
});

Deno.test("normalizeFeedback: clamps each kind into its valid range; drops invalid", () => {
  assertEquals(normalizeFeedback({ surface: "X", kind: "rating", value: 9 })!.value, 5);
  assertEquals(normalizeFeedback({ surface: "X", kind: "rating", value: 0 })!.value, 1);
  assertEquals(normalizeFeedback({ surface: "X", kind: "thumb", value: 5 })!.value, 1);
  assertEquals(normalizeFeedback({ surface: "X", kind: "thumb", value: -3 })!.value, -1);
  assertEquals(normalizeFeedback({ surface: "X", kind: "completion", value: 2 })!.value, 1);
  assertEquals(normalizeFeedback({ surface: "X", kind: "report" })!.value, -1);
  assertEquals(normalizeFeedback({ surface: "", kind: "thumb" }), null);      // no surface
});

Deno.test("feedbackToWeight: everything maps to one signed scale (good positive, bad negative)", () => {
  assert(feedbackToWeight({ kind: "thumb", value: 1 }) > 0);
  assert(feedbackToWeight({ kind: "thumb", value: -1 }) < 0);
  assertEquals(feedbackToWeight({ kind: "rating", value: 5 }), 1);
  assertEquals(feedbackToWeight({ kind: "rating", value: 1 }), -1);
  assertEquals(feedbackToWeight({ kind: "rating", value: 3 }), 0);            // neutral
  assert(feedbackToWeight({ kind: "nps", value: 10 }) > 0);
  assert(feedbackToWeight({ kind: "nps", value: 0 }) < 0);
  assert(feedbackToWeight({ kind: "conversion", value: 1 }) > 0);
  assert(feedbackToWeight({ kind: "conversion", value: 0 }) < 0);
  assert(feedbackToWeight({ kind: "report", value: -1 }) <= -1);             // strongest negative
});

Deno.test("aggregateFeedback: nets weights, counts positives/negatives/reports", () => {
  const rows = [
    { kind: "thumb" as const, value: 1 },
    { kind: "rating" as const, value: 5 },
    { kind: "rating" as const, value: 1 },
    { kind: "report" as const, value: -1 },
  ];
  const a = aggregateFeedback(rows);
  assertEquals(a.count, 4);
  assertEquals(a.positives, 2);      // thumb up + 5 star
  assertEquals(a.negatives, 2);      // 1 star + report
  assertEquals(a.reports, 1);
  assert(a.net_weight < 0);          // the report (-2) + 1star (-1) outweigh the two positives (+1 +1)
});
