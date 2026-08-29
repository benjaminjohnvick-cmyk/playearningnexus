// video-engine.test.ts — the pure core of the admin AI Video Engine.
//   deno test backend/sdk/video-engine.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  VIDEO_DIMENSIONS, DEFAULT_DIMENSION_VALUES, currentSpace, spaceSize,
  sampleConcepts, conceptKey,
  screenConcept, scoreConcept,
  selectForRender,
  metricRates, videoPerformance, scoreVideoOutcome,
  buildVideoPlaybook, videoRecommendations,
  usableTrends, pickTrend, attachTrends,
} from "./video-engine.ts";

const SPACE = currentSpace();

Deno.test("space size = product of default axis value counts (hundreds of millions)", () => {
  let expected = 1;
  for (const d of VIDEO_DIMENSIONS) expected *= DEFAULT_DIMENSION_VALUES[d].length;
  assertEquals(spaceSize(SPACE), expected);
  assert(spaceSize(SPACE) > 100_000_000, `space should exceed 100M, got ${spaceSize(SPACE)}`);
});

Deno.test("sampler: deterministic given a seed, unique concepts, respects size", () => {
  const a = sampleConcepts(50, { seed: "abc", epsilon: 0.5, space: SPACE });
  const b = sampleConcepts(50, { seed: "abc", epsilon: 0.5, space: SPACE });
  assertEquals(a.map(conceptKey), b.map(conceptKey));           // reproducible
  const keys = new Set(a.map(conceptKey));
  assertEquals(keys.size, a.length);                             // all unique
  assertEquals(a.length, 50);
  for (const c of a) for (const d of VIDEO_DIMENSIONS) assert(DEFAULT_DIMENSION_VALUES[d].includes(c[d]!));
});

Deno.test("sampler: a different seed yields a different draw", () => {
  const a = sampleConcepts(30, { seed: "seed-1", epsilon: 0.4, space: SPACE });
  const b = sampleConcepts(30, { seed: "seed-2", epsilon: 0.4, space: SPACE });
  assert(a.map(conceptKey).join() !== b.map(conceptKey).join());
});

Deno.test("sampler: epsilon=0 with a full 'top' exploits the winners (biased draw)", () => {
  const top: Record<string, string> = {};
  for (const d of VIDEO_DIMENSIONS) top[d] = DEFAULT_DIMENSION_VALUES[d][0];
  // With epsilon 0 and a winner on every axis, exploit dominates — but the sampler must still dedupe, so it
  // can only return 1 unique all-winners concept. Ask for 1 and verify it's exactly the winners.
  const one = sampleConcepts(1, { seed: "x", epsilon: 0, top, space: SPACE });
  assertEquals(one.length, 1);
  for (const d of VIDEO_DIMENSIONS) assertEquals(one[0][d], top[d]);
});

Deno.test("compliance: a non-compliant script is caught and caps the predictive score at 40", () => {
  const bad = { concept: { hook: "bold-claim" }, script: "Invest now and double your money — guaranteed returns!" };
  assertEquals(screenConcept(bad).ok, false);
  assert(scoreConcept(bad) <= 40);

  const good = { concept: { hook: "question" }, script: "Ever wonder how people earn rewards playing games? Here's the idea." };
  assertEquals(screenConcept(good).ok, true);
  assert(scoreConcept(good) > 40);
});

Deno.test("scoreConcept: rewards alignment with the playbook winners", () => {
  const rows = [
    { attributes: { hook: "question", theme: "earn-online" }, weight: 5, impressions: 1000 },
    { attributes: { hook: "question", theme: "earn-online" }, weight: 4, impressions: 1000 },
    { attributes: { hook: "controversy", theme: "gaming" }, weight: -3, impressions: 1000 },
  ];
  const pb = buildVideoPlaybook(rows);
  const aligned = scoreConcept({ concept: { hook: "question", theme: "earn-online" }, script: "clean copy" }, pb);
  const misaligned = scoreConcept({ concept: { hook: "controversy", theme: "gaming" }, script: "clean copy" }, pb);
  assert(aligned > misaligned, `aligned ${aligned} should beat misaligned ${misaligned}`);
});

Deno.test("selectForRender: provider 'none' spends nothing", () => {
  const concepts = [{ concept: { hook: "question" }, score: 95, compliant: true }];
  const r = selectForRender(concepts, { budget: { daily_render_max: 100, daily_spend_cap_usd: 100, est_cost_per_render_usd: 0.25, min_render_score: 70, provider: "none" } });
  assertEquals(r.selected.length, 0);
  assertEquals(r.est_cost_usd, 0);
});

Deno.test("selectForRender: caps by count AND by dollar budget, top-scored first, min-score gated", () => {
  const budget = { daily_render_max: 10, daily_spend_cap_usd: 1.0, est_cost_per_render_usd: 0.25, min_render_score: 70, provider: "runway" };
  const concepts = [
    { concept: { hook: "a" }, score: 90, compliant: true },
    { concept: { hook: "b" }, score: 85, compliant: true },
    { concept: { hook: "c" }, score: 80, compliant: true },
    { concept: { hook: "d" }, score: 75, compliant: true },
    { concept: { hook: "e" }, score: 72, compliant: true },
    { concept: { hook: "f" }, score: 60, compliant: true },   // below min score
    { concept: { hook: "g" }, score: 99, compliant: false },  // non-compliant
  ];
  const r = selectForRender(concepts, { budget, rendered_today: 0, spent_today_usd: 0 });
  // $1.00 / $0.25 = 4 renders max by dollars (tighter than count=10). Top 4 by score, excluding <70 and non-compliant.
  assertEquals(r.selected.length, 4);
  assertEquals(r.selected.map((s) => s.score), [90, 85, 80, 75]);
  assertEquals(r.est_cost_usd, 1.0);
});

Deno.test("selectForRender: exhausted budget selects nothing", () => {
  const budget = { daily_render_max: 5, daily_spend_cap_usd: 10, est_cost_per_render_usd: 0.25, min_render_score: 70, provider: "runway" };
  const concepts = [{ concept: { hook: "a" }, score: 99, compliant: true }];
  const r = selectForRender(concepts, { budget, rendered_today: 5 });   // count room = 0
  assertEquals(r.selected.length, 0);
});

Deno.test("metricRates + videoPerformance: better metrics score higher", () => {
  const weak = { impressions: 1000, avg_watch_seconds: 2, length_seconds: 15, completions: 50, three_sec_views: 800, clicks: 5, shares: 1, saves: 1, conversions: 0 };
  const strong = { impressions: 1000, avg_watch_seconds: 12, length_seconds: 15, completions: 600, three_sec_views: 900, clicks: 60, shares: 40, saves: 30, conversions: 20 };
  assert(videoPerformance(strong) > videoPerformance(weak));
  const r = metricRates(strong);
  assert(r.watch > 0 && r.watch <= 1 && r.completion <= 1 && r.ctr <= 1);
});

Deno.test("scoreVideoOutcome: signed relative to the batch mean", () => {
  const m = { impressions: 1000, avg_watch_seconds: 10, length_seconds: 15, completions: 500, three_sec_views: 900, clicks: 40, shares: 20, saves: 10, conversions: 10 };
  const perf = videoPerformance(m);
  assert(scoreVideoOutcome(m, perf - 0.5) > 0);   // above mean → positive
  assert(scoreVideoOutcome(m, perf + 0.5) < 0);   // below mean → negative
});

Deno.test("playbook: aggregates signed outcomes and picks winners; recommendations render", () => {
  const rows = [
    { attributes: { hook: "question", cta_style: "curiosity-gap" }, weight: 6, impressions: 2000 },
    { attributes: { hook: "question", cta_style: "curiosity-gap" }, weight: 5, impressions: 2000 },
    { attributes: { hook: "stat-shock", cta_style: "direct" }, weight: -4, impressions: 2000 },
  ];
  const pb = buildVideoPlaybook(rows, "2026-08-29");
  assertEquals(pb.top["hook"], "question");
  assertEquals(pb.top["cta_style"], "curiosity-gap");
  assert(pb.sample_size === 3);
  const recs = videoRecommendations(pb);
  assert(recs.length >= 1);
  assert(recs.some((r) => r.includes("question")));
});

Deno.test("playbook: empty history yields a helpful recommendation, no winners", () => {
  const pb = buildVideoPlaybook([]);
  assertEquals(pb.sample_size, 0);
  assertEquals(Object.keys(pb.top).length, 0);
  assert(videoRecommendations(pb)[0].toLowerCase().includes("not enough"));
});

const TRENDS = [
  { topic: "Mint Mobile price change", source: "news", momentum: 90, category: "telecom", angle_hint: "news-jack" },
  { topic: "New viral dance audio", source: "tiktok", momentum: 70, angle_hint: "viral-audio" },
  { topic: "Cold low-signal topic", source: "x", momentum: 5 },   // below the momentum floor (20)
];

Deno.test("trends: momentum floor filters cold topics, hottest first", () => {
  const u = usableTrends(TRENDS);
  assertEquals(u.length, 2);                       // the momentum-5 topic is dropped
  assertEquals(u[0].topic, "Mint Mobile price change");
});

Deno.test("trends: momentum-weighted pick favors the hotter trend and is deterministic", () => {
  assertEquals(pickTrend(TRENDS, 0.01)?.topic, "Mint Mobile price change");   // low r → first/hottest
  assertEquals(pickTrend(TRENDS, 0.99)?.topic, "New viral dance audio");      // high r → the other usable one
  assertEquals(pickTrend([], 0.5), undefined);
});

Deno.test("trends: attachTrends pins a live topic and honors angle_hint; empty list passes through", () => {
  const concepts = sampleConcepts(20, { seed: "t", epsilon: 0.5, space: SPACE });
  const enriched = attachTrends(concepts, TRENDS, "seed-t");
  assertEquals(enriched.length, 20);
  for (const e of enriched) {
    assert(e.trend && e.trend.topic);                                  // every concept got a live trend
    if (e.trend!.angle_hint) assertEquals(e.concept.trend_angle, e.trend!.angle_hint);  // hint overrides axis
  }
  const passthrough = attachTrends(concepts, [], "seed-t");
  assert(passthrough.every((e) => !e.trend));                          // no trends → layer simply off
});
