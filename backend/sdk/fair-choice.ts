// fair-choice.ts — present a set of options (current-event topics / ads) for the user to CHOOSE from, in a
// way that provably does NOT favor one option over another, so the resulting choice data is unbiased and can
// be collected automatically (the pick is the signal — no extra click, no survey question).
//
// Three fairness guarantees, all pure + testable here:
//   1. RANDOM POSITION  — the display order is shuffled per serve, so no slot ("first option") is favored.
//   2. EQUAL FOOTING    — the selector draws options uniformly at random (no ranking, no momentum ordering),
//                         so nothing is promoted by placement or prominence.
//   3. EXPOSURE-NORMALIZED SCORING — results are pick-rate (picks ÷ times-shown), so an option that happens
//                         to be shown more often can never win on exposure alone.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Draw a fair, position-randomized choice set of `size` options from `items`, uniformly at random (no
 *  ranking/prominence). Deterministic given `seed` (use a per-user+time seed). Returns fewer than `size` only
 *  if the pool is smaller. Pure. */
export function fairChoiceSet(items: string[], size: number, seed: string | number): string[] {
  const pool = Array.from(new Set((items || []).filter(Boolean)));
  const n = Math.max(2, Math.min(Math.floor(size) || 2, pool.length));
  const rnd = mulberry32(typeof seed === "number" ? seed : hashSeed(String(seed)));
  return shuffle(pool, rnd).slice(0, n);   // uniform draw + random order = no positional or ranking bias
}

/** Re-shuffle an already-chosen set purely for DISPLAY, so position is randomized independently. Pure. */
export function displayOrder(items: string[], seed: string | number): string[] {
  const rnd = mulberry32(typeof seed === "number" ? seed : hashSeed(String(seed)));
  return shuffle(items, rnd);
}

export interface ChoiceEvent { topic: string; kind: "impression" | "pick"; }
export interface ChoiceTally { topic: string; impressions: number; picks: number; pick_rate: number; }

/** Tally impressions + picks into an EXPOSURE-NORMALIZED ranking. pick_rate = picks ÷ impressions, so more
 *  exposure never inflates a topic. Topics with no impressions are excluded (can't be judged fairly). Pure. */
export function tallyChoices(events: ChoiceEvent[]): ChoiceTally[] {
  const acc: Record<string, { impressions: number; picks: number }> = {};
  for (const e of events || []) {
    if (!e?.topic) continue;
    const a = (acc[e.topic] ??= { impressions: 0, picks: 0 });
    if (e.kind === "impression") a.impressions++;
    else if (e.kind === "pick") a.picks++;
  }
  return Object.entries(acc)
    .filter(([, s]) => s.impressions > 0)
    .map(([topic, s]) => ({ topic, impressions: s.impressions, picks: s.picks, pick_rate: Math.round((s.picks / s.impressions) * 10000) / 10000 }))
    .sort((a, b) => b.pick_rate - a.pick_rate || b.impressions - a.impressions);
}

/** Fairness diagnostic: how balanced exposure actually was across topics (max ÷ min impressions). A value
 *  near 1 means every option got a roughly equal shot; the normalized pick_rate corrects any residual skew. */
export function exposureBalance(tally: ChoiceTally[]): { min: number; max: number; skew: number } {
  if (!tally.length) return { min: 0, max: 0, skew: 1 };
  const imps = tally.map((t) => t.impressions);
  const min = Math.min(...imps), max = Math.max(...imps);
  return { min, max, skew: min > 0 ? Math.round((max / min) * 100) / 100 : max };
}
