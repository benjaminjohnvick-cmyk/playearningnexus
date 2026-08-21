// survey-suite.test.ts — the pure core of the AI Survey Suite.
//   deno test backend/sdk/survey-suite.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  QUESTION_TYPES, questionType, allQuestionTypeKeys,
  vanWestendorpBlock, gaborGrangerBlock, maxDiffBlock, buildMethodBlock, METHODS,
  screenQuestion, screenSurvey, scoreSurvey, estimatedSeconds,
  shuffleOptions, addNeutralOption, LOCALES,
  buildSurveyPlaybook, surveyRecommendations,
} from "./survey-suite.ts";

Deno.test("question-type registry: 19+ types, lookups, categories", () => {
  assert(QUESTION_TYPES.length >= 19);
  assertEquals(questionType("nps")?.category, "scale");
  assertEquals(questionType("single_select")?.has_options, true);
  assertEquals(questionType("open_long")?.category, "open");
  assertEquals(questionType("nope"), undefined);
  assert(allQuestionTypeKeys().includes("matrix_single"));
});

Deno.test("advanced methods: Van Westendorp = 4 Qs; Gabor-Granger ladder; MaxDiff; dispatch", () => {
  const vw = vanWestendorpBlock("our app");
  assertEquals(vw.method, "van_westendorp");
  assertEquals(vw.questions.length, 4);
  const gg = gaborGrangerBlock("our app", [9, 12, 15]);
  assertEquals(gg.questions.length, 3);
  assert(String(gg.questions[0].stem).includes("$9"));
  const md = maxDiffBlock(["a", "b", "c", "d", "e"], 4);
  assertEquals(md.config.set_size, 4);
  assertEquals(buildMethodBlock("van_westendorp", { product: "x" })?.method, "van_westendorp");
  assertEquals(buildMethodBlock("bogus" as never, {}), null);
  assert(METHODS.length >= 5);
});

Deno.test("quality guard: leading/loaded/absolute warn; compliance blocks; clean passes", () => {
  assert(screenQuestion("Don't you agree our app is the best?").issues.some((i) => i.rule === "leading_question"));
  assert(screenQuestion("How amazing was your experience?").issues.some((i) => i.rule === "loaded_language"));
  assert(screenQuestion("Do you always use rewards apps?").issues.some((i) => i.rule === "absolute_terms"));
  // compliance is a hard block
  const c = screenQuestion("Would you join to earn $500 per day guaranteed?");
  assertEquals(c.ok, false);
  assert(c.issues.some((i) => i.severity === "block"));
  // a clean, neutral question passes
  const clean = screenQuestion("How often do you play mobile games?");
  assertEquals(clean.ok, true);
  assertEquals(clean.issues.length, 0);
});

Deno.test("screenSurvey: aggregates issues and counts blocks", () => {
  const qs = [
    { question_type: "single_select", stem: "How often do you shop online?" },
    { question_type: "open_text", stem: "Earn $1000 a day guaranteed — interested?" },
  ];
  const r = screenSurvey(qs);
  assertEquals(r.ok, false);
  assertEquals(r.blocked, 1);
});

Deno.test("survey score: good survey scores well; a compliance block caps it", () => {
  const good = scoreSurvey([
    { question_type: "single_select", stem: "How often do you play games?" },
    { question_type: "rating_stars", stem: "Rate your last session." },
    { question_type: "nps", stem: "How likely are you to recommend us?" },
    { question_type: "open_text", stem: "What would you improve?" },
  ]);
  assert(good.score >= 70);
  assert(good.type_diversity >= 3);
  const blocked = scoreSurvey([{ question_type: "open_text", stem: "Earn $500 a day guaranteed?" }]);
  assert(blocked.score <= 35);
});

Deno.test("estimatedSeconds reflects question mix", () => {
  const t = estimatedSeconds([{ question_type: "open_long" }, { question_type: "single_select" }]);
  assertEquals(t, 45 + 10);
});

Deno.test("edit ops: deterministic shuffle preserves items; add neutral is idempotent", () => {
  const opts = ["A", "B", "C", "D"];
  const s1 = shuffleOptions(opts, 42);
  const s2 = shuffleOptions(opts, 42);
  assertEquals(s1, s2);                              // same seed → same order
  assertEquals([...s1].sort().join(""), "ABCD");     // no item lost
  const withN = addNeutralOption(["Yes", "No"]);
  assert(withN.includes("Prefer not to say"));
  assertEquals(addNeutralOption(withN).length, withN.length); // idempotent
  assert(LOCALES.includes("es") && LOCALES.includes("ja"));
});

Deno.test("self-learning playbook: ranks winning attributes", () => {
  const pb = buildSurveyPlaybook([
    { attributes: { question_type: "rating_stars", length: "short" }, weight: 3, observations: 100 },
    { attributes: { question_type: "rating_stars", length: "short" }, weight: 2, observations: 90 },
    { attributes: { question_type: "matrix_multi", length: "long" }, weight: -2, observations: 80 },
  ], "2026-08-21");
  assertEquals(pb.top.question_type, "rating_stars");
  assertEquals(pb.top.length, "short");
  assert(surveyRecommendations(pb).some((r) => r.includes("rating_stars") || r.includes("short")));
  assert(surveyRecommendations(buildSurveyPlaybook([], ""))[0].toLowerCase().includes("field a survey"));
});
