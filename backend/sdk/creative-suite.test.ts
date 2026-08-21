// creative-suite.test.ts — the pure core of the AI Creative Suite.
//   deno test backend/sdk/creative-suite.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AD_FORMATS, adFormat, allFormatKeys,
  creativeSuiteTierCaps, effectiveAutonomy, formatAllowed, normalizeTier,
  screenCreativeCopy, screenCreative,
  buildCreativePlaybook, playbookRecommendations, scoreCreative, isFatigued,
  generationsRemaining,
} from "./creative-suite.ts";

Deno.test("format registry: every format is well-formed and lookups work", () => {
  assert(AD_FORMATS.length >= 12);
  for (const f of AD_FORMATS) { assert(f.key && f.label && f.medium && Array.isArray(f.surfaces)); }
  assertEquals(adFormat("interstitial")?.medium, "image");
  assertEquals(adFormat("search_headline")?.medium, "text");
  assertEquals(adFormat("nope"), undefined);
  assert(allFormatKeys().includes("video_script_short"));
});

Deno.test("tier caps: monotonic ladder (t3 ≥ t2 ≥ t1)", () => {
  const t1 = creativeSuiteTierCaps("tier1");
  const t2 = creativeSuiteTierCaps("tier2");
  const t3 = creativeSuiteTierCaps("tier3");
  assert(t2.max_variants_per_brief >= t1.max_variants_per_brief);
  assert(t3.max_variants_per_brief >= t2.max_variants_per_brief);
  assertEquals(t1.multivariate, false);
  assertEquals(t2.multivariate, true);
  assertEquals(t3.multivariate, true);
  // tier3 monthly + experiments are unlimited (0 sentinel)
  assertEquals(t3.monthly_generations, 0);
  assertEquals(t3.autonomy_ceiling, "auto");
  assertEquals(t1.autonomy_ceiling, "assist");
});

Deno.test("effectiveAutonomy: global cap (assist) holds back tier3 'auto' by default", () => {
  assertEquals(effectiveAutonomy("tier3", "auto"), "assist");   // clamped by global cap
  assertEquals(effectiveAutonomy("tier1", "auto"), "assist");   // clamped by tier ceiling + global
  assertEquals(effectiveAutonomy("tier2", "suggest"), "suggest");
});

Deno.test("format gating + tier normalization", () => {
  assert(formatAllowed("tier1", "interstitial"));
  assertEquals(normalizeTier("tier3"), "tier3");
  assertEquals(normalizeTier("weird"), "tier1");
  assertEquals(normalizeTier(undefined), "tier1");
});

Deno.test("compliance guard: blocks banned claims, passes clean copy", () => {
  assertEquals(screenCreativeCopy("Guaranteed 3x return on your money!").ok, false);
  assertEquals(screenCreativeCopy("Risk-free profits, get rich fast").ok, false);
  assertEquals(screenCreativeCopy("Double your money, guaranteed").ok, false);
  assertEquals(screenCreativeCopy("Earn $500 per day guaranteed").ok, false);
  // clean, benefit-led ad copy passes
  const clean = screenCreativeCopy("Play, earn store credit, and shop your favorites — join free today.");
  assertEquals(clean.ok, true);
  assertEquals(clean.violations.length, 0);
  // "invest" is a warn, not a hard block
  const warn = screenCreativeCopy("Invest your time and earn rewards");
  assertEquals(warn.ok, true);
  assert(warn.violations.some((v) => v.severity === "warn"));
});

Deno.test("screenCreative: scans every text field of a creative", () => {
  const bad = screenCreative({ headline: "Win big", body: "Guaranteed profit, zero risk", cta: "Join" });
  assertEquals(bad.ok, false);
  const good = screenCreative({ headline: "Turn play into rewards", body: "Free to join.", cta: "Start now" });
  assertEquals(good.ok, true);
});

Deno.test("self-learning playbook: ranks winners above losers and picks the top", () => {
  const rows = [
    { attributes: { hook: "question", tone: "playful" }, weight: 3, impressions: 100 },
    { attributes: { hook: "question", tone: "playful" }, weight: 2, impressions: 80 },
    { attributes: { hook: "discount", tone: "urgent" }, weight: -1, impressions: 90 },
    { attributes: { hook: "discount", tone: "urgent" }, weight: -2, impressions: 110 },
  ];
  const pb = buildCreativePlaybook(rows, "2026-08-21");
  assertEquals(pb.sample_size, 4);
  assertEquals(pb.top.hook, "question");
  assertEquals(pb.top.tone, "playful");
  const hookDim = pb.dimensions.find((d) => d.dimension === "hook")!;
  assertEquals(hookDim.ranked[0].value, "question");
  assert(hookDim.ranked[0].score > hookDim.ranked[hookDim.ranked.length - 1].score);
  const recs = playbookRecommendations(pb);
  assert(recs.some((r) => r.includes("question")));
});

Deno.test("playbook: empty history yields a 'run an A/B test' recommendation", () => {
  const pb = buildCreativePlaybook([], "2026-08-21");
  assertEquals(pb.sample_size, 0);
  assertEquals(pb.top.hook, undefined);
  assert(playbookRecommendations(pb)[0].toLowerCase().includes("a/b test"));
});

Deno.test("predictive score: compliant beats non-compliant; playbook alignment lifts", () => {
  const pb = buildCreativePlaybook([
    { attributes: { hook: "question" }, weight: 4, impressions: 100 },
    { attributes: { hook: "discount" }, weight: -3, impressions: 100 },
  ], "2026-08-21");
  const aligned = scoreCreative({ headline: "Ready to turn play into rewards?", cta: "Join free", format: "social_post", attributes: { hook: "question" }, compliant: true }, pb);
  const misaligned = scoreCreative({ headline: "Ready to turn play into rewards?", cta: "Join free", format: "social_post", attributes: { hook: "discount" }, compliant: true }, pb);
  assert(aligned > misaligned);
  const nonCompliant = scoreCreative({ headline: "Guaranteed 3x", cta: "Buy", format: "social_post", attributes: { hook: "question" }, compliant: false }, pb);
  assert(nonCompliant <= 40);
  assert(aligned > nonCompliant);
});

Deno.test("fatigue detection: CTR drop and old age both trigger; healthy doesn't", () => {
  assertEquals(isFatigued({ impressions: 10000, ctr_recent: 0.5, ctr_baseline: 1.0, age_days: 5 }).fatigued, true);
  assertEquals(isFatigued({ impressions: 10000, ctr_recent: 0.95, ctr_baseline: 1.0, age_days: 5 }).fatigued, false);
  assertEquals(isFatigued({ impressions: 100, ctr_recent: 0.1, ctr_baseline: 1.0, age_days: 5 }).fatigued, false); // too few impressions
  assertEquals(isFatigued({ impressions: 10000, ctr_recent: 1.0, ctr_baseline: 1.0, age_days: 90 }).fatigued, true); // old
});

Deno.test("quota: unlimited tier vs bounded tier", () => {
  assertEquals(generationsRemaining("tier3", 9999), Number.POSITIVE_INFINITY); // t3 unlimited
  const t1 = creativeSuiteTierCaps("tier1").monthly_generations;
  assertEquals(generationsRemaining("tier1", t1), 0);
  assertEquals(generationsRemaining("tier1", 0), t1);
});
