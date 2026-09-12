// model-training.ts — turns the data the platform already collects into a MODEL-READY dataset, with the stated
// end goal in mind: one day train a custom model that runs the site off its own data. It does NOT train a model
// (that's an external step with a training provider — LLMs here can't be fine-tuned in-process); it builds the
// raw material and measures how ready it is.
//
// The richest first-party training signal we already have is (state → action → label/reward):
//   • Autonomy decisions: the AI proposed an ACTION in a DOMAIN (context), and a human APPROVED or REJECTED it
//     (a clean supervised label) — the exact "should the AI have done this?" signal.
//   • Optimization outcomes: a setting change and its measured win/loss/lift (a reward signal).
//   • Agent performance: per-feature success/accuracy/satisfaction (labeled quality).
//   • Feedback events: signed weights per domain (implicit reward).
//
// PII posture: examples are built from OPERATIONAL records (AI-proposed actions + human labels + measured
// outcomes), not user profiles. We strip user/subject identifiers and keep only structured, non-PII fields, so
// the export is first-party and minimized. The EXPORT of example content is gated + counsel-noted; the readiness
// COUNTS (no content) are always safe to show.
import { db } from "./db.ts";
import { DOMAINS } from "./autonomy-kernel.ts";
import { snapBool, snapNumber } from "./settings.ts";

export const modelTrainingEnabled = () => snapBool("MODEL_TRAINING_ENABLED", true);
export const modelTrainingExportEnabled = () => snapBool("MODEL_TRAINING_EXPORT_ENABLED", false); // counsel-gated

export interface TrainingExample {
  type: "decision_label" | "optimization_reward" | "feature_quality" | "feedback";
  domain?: string;
  feature?: string;
  context: Record<string, unknown>;   // state (non-PII)
  action?: unknown;                    // what the AI proposed/did
  label?: string;                      // human approve/reject (supervised)
  reward?: number;                     // measured outcome (RL-style)
  at: string;
}

const trunc = (s: unknown, n = 400) => { const t = String(s ?? ""); return t.length > n ? t.slice(0, n) : t; };

// Build a bounded set of model-ready examples. Identifiers are dropped; free text is truncated.
export async function buildTrainingExamples(limit = 2000): Promise<TrainingExample[]> {
  const out: TrainingExample[] = [];
  const per = Math.max(100, Math.floor(limit / 3));

  // 1) Decision labels — human approve/reject on an AI-proposed action (supervised).
  const decisions = await db.filter("AutonomyDecision", {}, "-created_at", per).catch(() => []);
  for (const d of decisions || []) {
    const decided = String((d as any).decided ?? "");
    if (decided !== "approved" && decided !== "rejected") continue; // only labeled examples
    out.push({
      type: "decision_label",
      domain: String((d as any).domain ?? ""),
      context: { mode: String((d as any).mode ?? ""), permanent_gate: (d as any).permanent_gate === true, reason: trunc((d as any).reason) },
      action: (d as any).proposal ?? null,
      label: decided,
      at: String((d as any).created_at ?? (d as any).created_date ?? ""),
    });
  }

  // 2) Optimization rewards — a setting change and its measured lift (RL-style reward).
  const outcomes = await db.filter("OptimizationOutcome", {}, "-created_date", per).catch(() => []);
  for (const o of outcomes || []) {
    out.push({
      type: "optimization_reward",
      context: { setting: String((o as any).setting_key ?? (o as any).key ?? ""), metric: String((o as any).primary_metric ?? (o as any).objective ?? "") },
      action: { from: (o as any).from_value ?? null, to: (o as any).to_value ?? null },
      reward: Number((o as any).lift_pct ?? (o as any).lift ?? 0) || 0,
      label: String((o as any).verdict ?? ""),
      at: String((o as any).created_date ?? (o as any).measured_at ?? ""),
    });
  }

  // 3) Feature quality — per-feature success/accuracy/satisfaction.
  const perf = await db.filter("AgentPerformanceLog", {}, "-logged_at", per).catch(() => []);
  for (const p of perf || []) {
    out.push({
      type: "feature_quality",
      feature: String((p as any).feature_name ?? ""),
      context: { input: trunc((p as any).input_summary, 200) },
      reward: Number((p as any).accuracy_score ?? 0) || 0,
      label: (p as any).is_successful === true ? "success" : "fail",
      at: String((p as any).logged_at ?? (p as any).created_date ?? ""),
    });
  }

  return out.slice(0, limit);
}

// Serialize to JSONL (one example per line) — the standard shape a training pipeline ingests.
export function toJsonl(examples: TrainingExample[]): string {
  return examples.map((e) => JSON.stringify(e)).join("\n");
}

export interface ModelReadiness {
  total_examples: number;
  labeled_examples: number;         // examples carrying a human/measured label
  by_type: Record<string, number>;
  by_domain: Record<string, number>;
  domains_with_data: number;
  domains_total: number;
  readiness_pct: number;            // headline: how ready the dataset is to train a first custom model
  target_examples: number;          // the "enough to start" bar (tunable)
  note: string;
}

// How ready is the collected data to train a first custom model? Blends VOLUME (against a target) and BREADTH
// (how many domains have labeled data), so it rises as both grow. Counts only — no example content — so it's
// always safe to display.
export async function modelReadiness(): Promise<ModelReadiness> {
  const target = Math.max(100, snapNumber("MODEL_TRAINING_TARGET_EXAMPLES", 5000));
  const examples = await buildTrainingExamples(20000);
  const byType: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  let labeled = 0;
  for (const e of examples) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    if (e.domain) byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
    if (e.label || typeof e.reward === "number") labeled++;
  }
  const domainsTotal = DOMAINS.length;
  const domainsWithData = Object.keys(byDomain).length;
  const volumePct = Math.min(100, (labeled / target) * 100);
  const breadthPct = domainsTotal ? (domainsWithData / domainsTotal) * 100 : 0;
  const readiness = Math.round(((volumePct * 0.7) + (breadthPct * 0.3)) * 10) / 10;
  return {
    total_examples: examples.length,
    labeled_examples: labeled,
    by_type: byType,
    by_domain: byDomain,
    domains_with_data: domainsWithData,
    domains_total: domainsTotal,
    readiness_pct: readiness,
    target_examples: target,
    note: `Readiness blends volume (${labeled}/${target} labeled examples) and breadth (${domainsWithData}/${domainsTotal} domains). Training a custom model from this export is an external step with a training provider — this measures when there's enough clean data to start.`,
  };
}
