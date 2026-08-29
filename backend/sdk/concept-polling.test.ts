// concept-polling.test.ts — the pure core of the Concept Polling loop.
//   deno test backend/sdk/concept-polling.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildMatchups, normalizeVote, tallyBestWorst, rankConcepts, totalVotes, pollLearningRows,
} from "./concept-polling.ts";

const IDS = Array.from({ length: 8 }, (_, i) => `c${i + 1}`);

Deno.test("buildMatchups: head-to-head (size 2) is deterministic, balanced, no repeats-in-set", () => {
  const a = buildMatchups(IDS, { setSize: 2, targetAppearances: 4, seed: "s" });
  const b = buildMatchups(IDS, { setSize: 2, targetAppearances: 4, seed: "s" });
  assertEquals(a, b);                                   // reproducible
  // 8 ids / 2 per set = 4 sets per pass × 4 passes = 16 sets
  assertEquals(a.length, 16);
  for (const s of a) { assertEquals(s.length, 2); assertEquals(new Set(s).size, 2); }
  // balanced: every id appears the same number of times (4 passes → 4 each)
  const counts: Record<string, number> = {};
  for (const s of a) for (const id of s) counts[id] = (counts[id] || 0) + 1;
  for (const id of IDS) assertEquals(counts[id], 4);
});

Deno.test("buildMatchups: MaxDiff set size 4 works; too-small pool yields nothing", () => {
  const sets = buildMatchups(IDS, { setSize: 4, targetAppearances: 2, seed: "s" });
  assertEquals(sets.length, 2 * Math.floor(8 / 4));     // 2 passes × 2 sets = 4
  for (const s of sets) assertEquals(s.length, 4);
  assertEquals(buildMatchups(["only-one"], { setSize: 2 }), []);
});

Deno.test("normalizeVote: head-to-head infers the loser as worst; invalid votes dropped", () => {
  assertEquals(normalizeVote({ set: ["a", "b"], best: "a" }), { set: ["a", "b"], best: "a", worst: "b" });
  assertEquals(normalizeVote({ set: ["a", "b", "c"], best: "a", worst: "c" }), { set: ["a", "b", "c"], best: "a", worst: "c" });
  assertEquals(normalizeVote({ set: ["a", "b"], best: "z" }), null);   // best not in set
  assertEquals(normalizeVote({ set: ["a"], best: "a" }), null);        // set too small
});

Deno.test("tallyBestWorst: score = (best − worst)/appearances in [-1,1]", () => {
  const votes = [
    { set: ["a", "b"], best: "a" },   // a best, b worst
    { set: ["a", "b"], best: "a" },
    { set: ["a", "c"], best: "a" },   // a best, c worst
    { set: ["b", "c"], best: "b" },   // b best, c worst
  ];
  const tally = tallyBestWorst(votes);
  const byId = Object.fromEntries(tally.map((t) => [t.id, t]));
  assertEquals(byId["a"].appearances, 3);
  assertEquals(byId["a"].best, 3);
  assertEquals(byId["a"].worst, 0);
  assertEquals(byId["a"].score, 1);                    // best every time
  assertEquals(byId["c"].score, -1);                   // worst every time (0 best, 2 worst, 2 appearances)
  assert(byId["b"].score > -1 && byId["b"].score < 1);
});

Deno.test("rankConcepts + totalVotes", () => {
  const votes = [
    { set: ["a", "b"], best: "a" }, { set: ["a", "b"], best: "a" },
    { set: ["a", "b"], best: "b" }, { set: ["c", "a"], best: "a" },
  ];
  const ranked = rankConcepts(tallyBestWorst(votes));
  assertEquals(ranked[0].id, "a");                     // a wins most
  assertEquals(totalVotes(tallyBestWorst(votes), 2), 4);
});

Deno.test("pollLearningRows: winners get positive weight, losers negative, centered on mean", () => {
  const votes = [
    { set: ["a", "b"], best: "a" }, { set: ["a", "b"], best: "a" },
    { set: ["a", "c"], best: "a" }, { set: ["b", "c"], best: "b" },
  ];
  const tally = tallyBestWorst(votes);
  const concepts = [
    { id: "a", attributes: { hook: "question", theme: "earn-online" } },
    { id: "b", attributes: { hook: "stat-shock", theme: "gaming" } },
    { id: "c", attributes: { hook: "controversy", theme: "deals" } },
  ];
  const rows = pollLearningRows(tally, concepts, { scale: 5 });
  const byId = Object.fromEntries(rows.map((r) => [r.concept_id, r]));
  assert(byId["a"].weight > 0, `winner a should be positive, got ${byId["a"].weight}`);
  assert(byId["c"].weight < 0, `loser c should be negative, got ${byId["c"].weight}`);
  assertEquals(byId["a"].impressions, tally.find((t) => t.id === "a")!.appearances);
  // a concept with no attributes is skipped
  const rows2 = pollLearningRows(tally, [{ id: "a", attributes: {} }], { scale: 5 });
  assertEquals(rows2.length, 0);
});
