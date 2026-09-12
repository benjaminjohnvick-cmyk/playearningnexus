// custom-model.ts — the harness for YOUR own model, fed continuously by every AI process's data.
//
// HONEST ARCHITECTURE (so the roadmap is real, not a promise):
//  • The incumbent AI (Claude) is the TEACHER and the ACCURACY BENCHMARK. Its decisions + the human
//    approve/reject labels are the training signal the pipeline already assembles (model-training.ts).
//  • YOUR model is a pluggable backend behind one interface, `predict(domain, context)`:
//      - "claude_shadow" (default): the incumbent produces the real answer; your model produces a CANDIDATE
//        from the data collected so far, and we measure how often the candidate matches the incumbent.
//      - "custom": once your model's accuracy MATCHES the incumbent (target %, enough samples), you can flip
//        the backend so your model serves — still behind the same human gates for money/identity/legal.
//  • The current predictor is a DATA-DRIVEN learner over the collected (context → label) examples
//    (domain-conditioned frequency/similarity vote). It genuinely improves as data grows. When you later train
//    an independent neural model from the gated export, you replace ONLY predictInternal() below — the
//    ingestion, shadow-eval, accuracy-vs-incumbent gate, and everything around it stay exactly as-is.
//
// NOTE (legal/ToS): whether the incumbent's outputs may be used to train a competing/replacement model is an
// Anthropic-usage-terms + privacy question — see MODEL-TRAINING-DATA-COUNSEL-NOTE.md and
// CUSTOM-AI-MODEL-DESIGN-AND-ROADMAP.md. This file evaluates a candidate against the incumbent; the export/train
// step stays gated + counsel-noted.
import { snapString, snapNumber, snapBool } from "./settings.ts";
import type { TrainingExample } from "./model-training.ts";

export const modelBackend = () => snapString("MODEL_BACKEND", "claude_shadow");
export const modelShadowEnabled = () => snapBool("MODEL_SHADOW_ENABLED", true);
export const modelAccuracyTargetPct = () => Math.min(100, Math.max(1, snapNumber("MODEL_ACCURACY_TARGET_PCT", 95)));
export const modelMinEvalSamples = () => Math.max(1, Math.round(snapNumber("MODEL_MIN_EVAL_SAMPLES", 200)));
export const modelAutoPromoteEnabled = () => snapBool("MODEL_AUTO_PROMOTE_ENABLED", false);
export const modelReadyStreakRequired = () => Math.max(1, Math.round(snapNumber("MODEL_READY_STREAK_REQUIRED", 3)));
// The "plug in your own model" seam: point this at YOUR trained model's HTTP endpoint (any provider / your own
// server). When the backend is "custom" and this is set, serve() calls it; until then serve() uses the built-in
// data learner. Swapping models is a config change — no code edit.
export const modelCustomEndpoint = () => snapString("MODEL_CUSTOM_ENDPOINT", "");

export interface Prediction { label: string; confidence: number; basis: number; }

// A coarse context bucket so the predictor conditions on more than just the domain (keeps accuracy honest —
// it can't win by predicting one global majority). Derived only from non-PII structured fields.
export function contextBucket(e: Pick<TrainingExample, "domain" | "context">): string {
  const c = (e.context || {}) as Record<string, unknown>;
  const gate = c.permanent_gate === true ? "gate" : "auto";
  const mode = String(c.mode ?? "");
  return `${e.domain ?? "?"}|${gate}|${mode}`;
}

export interface ModelIndex { byBucket: Map<string, Map<string, number>>; byDomain: Map<string, Map<string, number>>; size: number; }

/** "Train" the predictor: tally label frequencies per (bucket) and per (domain) over the given examples. */
export function trainIndex(examples: TrainingExample[]): ModelIndex {
  const byBucket = new Map<string, Map<string, number>>();
  const byDomain = new Map<string, Map<string, number>>();
  let size = 0;
  for (const e of examples) {
    if (!e.label) continue;
    size++;
    const b = contextBucket(e);
    const dm = String(e.domain ?? "?");
    const bt = byBucket.get(b) ?? byBucket.set(b, new Map()).get(b)!;
    bt.set(e.label, (bt.get(e.label) || 0) + 1);
    const dt = byDomain.get(dm) ?? byDomain.set(dm, new Map()).get(dm)!;
    dt.set(e.label, (dt.get(e.label) || 0) + 1);
  }
  return { byBucket, byDomain, size };
}

const topLabel = (m?: Map<string, number>): { label: string; conf: number; basis: number } | null => {
  if (!m || m.size === 0) return null;
  let best = "", bestN = 0, total = 0;
  for (const [k, v] of m) { total += v; if (v > bestN) { bestN = v; best = k; } }
  return { label: best, conf: total ? bestN / total : 0, basis: total };
};

/** Predict the label the incumbent would most likely produce for this (domain, context), learned from data.
 *  Prefers the specific context bucket; falls back to the domain; else abstains. */
export function predictInternal(index: ModelIndex, e: Pick<TrainingExample, "domain" | "context">): Prediction {
  const b = topLabel(index.byBucket.get(contextBucket(e)));
  if (b && b.basis >= 3) return { label: b.label, confidence: b.conf, basis: b.basis };
  const d = topLabel(index.byDomain.get(String(e.domain ?? "?")));
  if (d) return { label: d.label, confidence: d.conf, basis: d.basis };
  return { label: "", confidence: 0, basis: 0 };
}

// serve() — the single prediction entry point the rest of the platform would call once your model is promoted.
// This is "the pre-existing structure" you plug into: it routes by the active backend.
//   • backend "custom" + a custom endpoint set → POST the context to YOUR model and use its answer.
//   • backend "custom", no endpoint → use the built-in data learner (so 'custom' still works before you host a net).
//   • backend "claude_shadow" → returns the data-learner CANDIDATE (the incumbent still serves the real answer
//     elsewhere; this candidate is what shadow-eval scores against the incumbent).
// Money/identity/legal decisions stay behind the human gate regardless of which backend answers.
export async function serve(index: ModelIndex, e: Pick<TrainingExample, "domain" | "context">): Promise<Prediction & { source: string }> {
  const backend = modelBackend();
  if (backend === "custom") {
    const endpoint = modelCustomEndpoint();
    if (endpoint) {
      try {
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: e.domain, context: e.context }) });
        if (res.ok) {
          const j = await res.json().catch(() => ({}));
          if (j && typeof j.label === "string") return { label: j.label, confidence: Number(j.confidence) || 0, basis: Number(j.basis) || 0, source: "custom_endpoint" };
        }
      } catch { /* fall through to the built-in learner */ }
    }
    return { ...predictInternal(index, e), source: "custom_builtin" };
  }
  return { ...predictInternal(index, e), source: "shadow_candidate" };
}
