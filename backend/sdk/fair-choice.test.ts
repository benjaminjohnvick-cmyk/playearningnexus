// fair-choice.test.ts — unbiased forced-choice over options (topics/ads).
//   deno test backend/sdk/fair-choice.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fairChoiceSet, displayOrder, tallyChoices, exposureBalance } from "./fair-choice.ts";

const POOL = ["a", "b", "c", "d", "e", "f"];

Deno.test("fairChoiceSet: deterministic, unique, sized, drawn from the pool", () => {
  const s1 = fairChoiceSet(POOL, 4, "u1");
  const s2 = fairChoiceSet(POOL, 4, "u1");
  assertEquals(s1, s2);                                  // reproducible per seed
  assertEquals(s1.length, 4);
  assertEquals(new Set(s1).size, 4);                     // no repeats
  for (const x of s1) assert(POOL.includes(x));
  assert(fairChoiceSet(POOL, 4, "u1").join() !== fairChoiceSet(POOL, 4, "u2").join());  // different users differ
});

Deno.test("fairChoiceSet: over many serves, exposure is roughly uniform (no option favored)", () => {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 600; i++) for (const x of fairChoiceSet(POOL, 3, `serve-${i}`)) counts[x] = (counts[x] || 0) + 1;
  const vals = POOL.map((x) => counts[x] || 0);
  const min = Math.min(...vals), max = Math.max(...vals);
  assert(max / min < 1.3, `exposure should be roughly uniform, got min ${min} max ${max}`);
});

Deno.test("displayOrder: randomizes position (kills primacy bias)", () => {
  const set = ["a", "b", "c", "d"];
  let anyReordered = false;
  for (let i = 0; i < 20; i++) { if (displayOrder(set, `d${i}`).join() !== set.join()) { anyReordered = true; break; } }
  assert(anyReordered);
  assertEquals(new Set(displayOrder(set, "x")).size, 4);   // same members
});

Deno.test("tallyChoices: pick_rate is exposure-normalized so more exposure never wins on its own", () => {
  const events = [
    // 'a' shown 10x, picked 5x → 0.5.  'b' shown 2x, picked 2x → 1.0 (fewer impressions but higher rate).
    ...Array.from({ length: 10 }, () => ({ topic: "a", kind: "impression" as const })),
    ...Array.from({ length: 5 }, () => ({ topic: "a", kind: "pick" as const })),
    ...Array.from({ length: 2 }, () => ({ topic: "b", kind: "impression" as const })),
    ...Array.from({ length: 2 }, () => ({ topic: "b", kind: "pick" as const })),
    { topic: "c", kind: "pick" as const },   // no impressions → excluded (can't judge fairly)
  ];
  const t = tallyChoices(events);
  assertEquals(t[0].topic, "b");             // higher pick-rate wins despite far less exposure
  assertEquals(t[0].pick_rate, 1);
  assertEquals(t.find((x) => x.topic === "a")!.pick_rate, 0.5);
  assertEquals(t.find((x) => x.topic === "c"), undefined);
});

Deno.test("exposureBalance: reports how equal the exposure was", () => {
  const t = tallyChoices([
    { topic: "a", kind: "impression" }, { topic: "a", kind: "impression" },
    { topic: "b", kind: "impression" }, { topic: "b", kind: "impression" },
  ]);
  assertEquals(exposureBalance(t).skew, 1);   // perfectly balanced
});
