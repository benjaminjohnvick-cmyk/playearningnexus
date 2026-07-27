// The site's evolving, Claude-based "model".
//
// Fine-tuning Claude isn't available, so the custom site model is Claude PLUS a continuously-updated
// knowledge context: what the optimizer has learned (best values per setting), the latest metric
// snapshot, recent experiment outcomes, and headline aggregates. buildSiteContext() compiles this
// into a compact string that any AI call injects as grounding, so every AI decision reflects the
// site's own accumulated data — and improves automatically as that data grows (refreshed on a TTL
// and by refreshSiteModel()). This is the practical "model that auto-updates and improves."

import { db } from "./db.ts";

let _ctx: { text: string; at: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

export function invalidateSiteModel() { _ctx = null; }

/** Compile the current site-knowledge context (cached ~10m). Safe/best-effort — never throws. */
export async function buildSiteContext(): Promise<string> {
  if (_ctx && Date.now() - _ctx.at < TTL_MS) return _ctx.text;
  try {
    const [signals, learning, outcomes] = await Promise.all([
      db.filter("OptimizationSignal", {}, "-collected_at", 40).catch(() => []),
      db.filter("AILearningState", {}, "-updated_at", 40).catch(() => []),
      db.filter("OptimizationOutcome", {}, "-applied_at", 20).catch(() => []),
    ]);
    const latest: Record<string, unknown> = {};
    for (const s of signals as any[]) if (!(s.metric in latest)) latest[s.metric] = s.value;
    const best = (learning as any[]).map((l) => `${l.key}=${l.best_value}`).slice(0, 25).join(", ");
    const wins = (outcomes as any[]).filter((o) => o.verdict === "win").map((o) => `${o.key}(+${o.lift_pct}%)`).slice(0, 10).join(", ");

    const text =
      `GAMERGAIN SITE MODEL (auto-compiled).\n` +
      `Live metrics: ${JSON.stringify(latest)}.\n` +
      `Learned best setting values: ${best || "(none yet)"}.\n` +
      `Recent winning changes: ${wins || "(none yet)"}.\n` +
      `Use this as ground truth about how this specific site performs when making recommendations.`;
    _ctx = { text, at: Date.now() };
    return text;
  } catch {
    return "GAMERGAIN SITE MODEL (unavailable — proceed with general best practices).";
  }
}

/** Persist a snapshot of the compiled model (so it's inspectable/versioned). */
export async function refreshSiteModel(): Promise<string> {
  invalidateSiteModel();
  const text = await buildSiteContext();
  await db.create("AILearningState", { key: "__site_model__", best_value: 0, note: "site model snapshot", context: text, updated_at: new Date().toISOString() }, "site-model").catch(() => null);
  return text;
}
