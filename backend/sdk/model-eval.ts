// model-eval.ts — measures whether YOUR model's OUTPUT ACCURACY EXCEEDS the existing AI's, step by step, as
// data accumulates. The site should switch to your model exactly when your model gives MORE ACCURATE outputs
// than the pre-existing AI — that is what this computes.
//
// Ground truth = the human's approve/reject on each decision (the final "was this the right call?").
// Method (leak-free): take the labeled decisions, sort by time, TRAIN the predictor on the older split, TEST on
// the newer split. On that same test set we score both sides against the human ground truth:
//   • INCUMBENT accuracy = how often the existing AI's own proposal was approved (its output was right).
//   • YOUR MODEL accuracy = how often your model's predicted verdict matches the human's actual verdict.
// "EXCEEDS" = your model's accuracy beats the incumbent's by the margin (both on the same ground truth), over
// enough held-out samples. The model is READY — and the site auto-switches — only when it EXCEEDS. Each run
// records custom_model_accuracy_pct, incumbent_accuracy_pct, and custom_model_exceeds so it all trends.
import { db } from "./db.ts";
import { setSetting } from "./settings.ts";
import { buildTrainingExamples } from "./model-training.ts";
import {
  trainIndex, predictInternal, modelExceedMarginPct, modelAccuracyFloorPct, modelMinEvalSamples, modelBackend,
  modelAutoPromoteEnabled, modelReadyStreakRequired, modelAutoRollbackEnabled, modelPerFunctionMinSamples,
} from "./custom-model.ts";
import { sendPushToUser } from "./approvals.ts";

const ACTOR = "system@getgoodsgratis.local";
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface EvalResult {
  custom_accuracy_pct: number;    // YOUR model's output accuracy vs the human ground truth (as a whole)
  incumbent_accuracy_pct: number; // the EXISTING AI's output accuracy vs the same ground truth (as a whole)
  accuracy_pct: number;           // alias of custom_accuracy_pct (dashboard/back-compat)
  exceeds: boolean;               // TRUE only when EVERY function exceeds individually AND the whole exceeds
  overall_exceeds: boolean;       // the as-a-whole comparison
  all_functions_exceed: boolean;  // every confirmed function beats the existing AI
  margin_pct: number;
  floor_pct: number;              // optional absolute floor (0 = off)
  test_samples: number;
  train_samples: number;
  per_function_min: number;
  by_domain: Record<string, { custom_pct: number; incumbent_pct: number; n: number; exceeds: boolean; confirmed: boolean }>;
  functions_passing: string[];    // confirmed and beating the existing AI
  functions_failing: string[];    // confirmed but NOT beating it yet
  functions_insufficient: string[]; // have data but not enough samples to confirm — these block the switch
  min_samples: number;
  ready: boolean;                 // ready == exceeds
  backend: string;
  note: string;
}

export async function runShadowEval(): Promise<EvalResult> {
  const minSamples = modelMinEvalSamples();
  const margin = modelExceedMarginPct();
  const floor = modelAccuracyFloorPct();

  // Decision labels with a clear human verdict are the ground truth.
  const all = (await buildTrainingExamples(20000)).filter((e) => e.type === "decision_label" && (e.label === "approved" || e.label === "rejected") && e.domain);
  all.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const splitAt = Math.floor(all.length * 0.7);
  const train = all.slice(0, splitAt);
  const test = all.slice(splitAt);
  const index = trainIndex(train);

  let incCorrect = 0, incN = 0, custCorrect = 0, custN = 0;
  const dom: Record<string, { incCorrect: number; incN: number; custCorrect: number; custN: number }> = {};
  for (const e of test) {
    const d = String(e.domain);
    dom[d] = dom[d] || { incCorrect: 0, incN: 0, custCorrect: 0, custN: 0 };
    // Incumbent output accuracy: its proposal was "right" when the human approved it.
    incN++; dom[d].incN++;
    if (e.label === "approved") { incCorrect++; dom[d].incCorrect++; }
    // Your model's output accuracy: does it predict the correct verdict?
    const p = predictInternal(index, e);
    if (p.label) { custN++; dom[d].custN++; if (p.label === e.label) { custCorrect++; dom[d].custCorrect++; } }
  }

  const perFnMin = modelPerFunctionMinSamples();
  const incAcc = incN ? round1((incCorrect / incN) * 100) : 0;
  const custAcc = custN ? round1((custCorrect / custN) * 100) : 0;

  // Per-FUNCTION (per-domain) accuracy comparison. A function is only "confirmed" once it has enough samples;
  // confirmed functions must each beat the existing AI by the margin.
  const byDomain: Record<string, { custom_pct: number; incumbent_pct: number; n: number; exceeds: boolean; confirmed: boolean }> = {};
  const passing: string[] = [], failing: string[] = [], insufficient: string[] = [];
  for (const [k, v] of Object.entries(dom)) {
    const cp = v.custN ? round1((v.custCorrect / v.custN) * 100) : 0;
    const ip = v.incN ? round1((v.incCorrect / v.incN) * 100) : 0;
    const confirmed = v.custN >= perFnMin;
    const beats = cp >= ip + margin && (floor <= 0 || cp >= floor);
    byDomain[k] = { custom_pct: cp, incumbent_pct: ip, n: v.custN, exceeds: beats, confirmed };
    if (!confirmed) insufficient.push(k);
    else if (beats) passing.push(k);
    else failing.push(k);
  }

  // As a WHOLE.
  const overallExceeds = custN >= minSamples && custAcc >= incAcc + margin && (floor <= 0 || custAcc >= floor);
  // EVERY function individually: all confirmed functions beat it, none are failing, and none are still
  // unconfirmed (a function with data but too few samples blocks the switch until it's proven).
  const allFunctionsExceed = passing.length > 0 && failing.length === 0 && insufficient.length === 0;
  const exceeds = overallExceeds && allFunctionsExceed;

  const blockers = [
    ...(overallExceeds ? [] : [`overall ${custAcc}% not yet ahead of ${incAcc}%`]),
    ...(failing.length ? [`${failing.length} function(s) still behind: ${failing.slice(0, 6).join(", ")}`] : []),
    ...(insufficient.length ? [`${insufficient.length} function(s) need more data: ${insufficient.slice(0, 6).join(", ")}`] : []),
  ];

  return {
    custom_accuracy_pct: custAcc,
    incumbent_accuracy_pct: incAcc,
    accuracy_pct: custAcc,
    exceeds,
    overall_exceeds: overallExceeds,
    all_functions_exceed: allFunctionsExceed,
    margin_pct: margin,
    floor_pct: floor,
    test_samples: custN,
    train_samples: index.size,
    per_function_min: perFnMin,
    by_domain: byDomain,
    functions_passing: passing,
    functions_failing: failing,
    functions_insufficient: insufficient,
    min_samples: minSamples,
    ready: exceeds,
    backend: modelBackend(),
    note: exceeds
      ? `EXCEEDS — your model beats the existing AI on ALL ${passing.length} function(s) individually AND as a whole (${custAcc}% vs ${incAcc}%). The site is cleared to switch. Money/identity/legal stay human-gated.`
      : `NOT YET — switch requires every function to beat the existing AI individually AND overall. Blocking: ${blockers.join("; ") || "insufficient data"}.`,
  };
}

async function notifyAdmins(title: string, body: string): Promise<void> {
  const admins = await db.filter("User", { role: "admin" }, "-created_date", 200).catch(() => []);
  for (const a of admins || []) {
    const uid = String((a as any).id);
    await db.create("Notification", { user_id: uid, type: "model_promotion", title, message: body, is_read: false, link: "DataDrivenCoverage" }, ACTOR).catch(() => null);
    await sendPushToUser(uid, title, body, { kind: "model_promotion" }).catch(() => null);
  }
}

export interface PromotionResult { eligible: boolean; promoted: boolean; streak: number; required: number; note: string; }

// The automatic switchover: when your model has EXCEEDED the existing AI for enough CONSECUTIVE evaluations
// (sustained, not a one-off), either auto-flip the backend to "custom" (auto-promote on, the default) or notify
// you to promote it. Money/identity/legal stay human-gated no matter which backend is active.
export async function maybeAutoPromote(r: EvalResult): Promise<PromotionResult> {
  const required = modelReadyStreakRequired();
  if (modelBackend() === "custom") return { eligible: false, promoted: false, streak: required, required, note: "Already running the custom backend." };
  const rows = await db.filter("OptimizationSignal", { metric: "custom_model_exceeds" }, "-created_date", 40).catch(() => []);
  let streak = 0;
  for (const row of rows || []) { if ((Number((row as any).value) || 0) >= 1) streak++; else break; }
  const eligible = r.exceeds && streak >= required;
  if (!eligible) return { eligible: false, promoted: false, streak, required, note: `Exceed-streak ${streak}/${required} (your model must out-accuracy the existing AI for ${required} evals in a row).` };

  if (modelAutoPromoteEnabled()) {
    await setSetting("MODEL_BACKEND", "custom", "system@custom-model-auto-promote").catch(() => null);
    await db.create("OptimizationSignal", { metric: "custom_model_promoted", value: 1, collected_at: new Date().toISOString() }, ACTOR).catch(() => null);
    await notifyAdmins("Custom model promoted automatically", `Your model out-performed the existing AI (${r.custom_accuracy_pct}% vs ${r.incumbent_accuracy_pct}%) for ${streak} consecutive evaluations — the active backend auto-switched to "custom". Money / identity / legal decisions remain human-gated, and it auto-reverts if it ever regresses.`);
    return { eligible: true, promoted: true, streak, required, note: 'Auto-promoted: backend switched to "custom".' };
  }
  await notifyAdmins("Custom model is ready to promote", `Your model out-performed the existing AI (${r.custom_accuracy_pct}% vs ${r.incumbent_accuracy_pct}%) for ${streak} consecutive evaluations. Tap Promote (or turn on MODEL_AUTO_PROMOTE_ENABLED to switch automatically).`);
  return { eligible: true, promoted: false, streak, required, note: "Eligible — auto-promote is off, so it's waiting for your go-ahead." };
}

// Safety revert: if your model is live but no longer exceeds the existing AI (it regressed), roll the backend
// back to shadow and notify — so the switch is only kept while your model is genuinely more accurate.
export async function maybeAutoRollback(r: EvalResult): Promise<{ rolled_back: boolean; note: string }> {
  if (modelBackend() !== "custom") return { rolled_back: false, note: "Not on custom backend." };
  if (!modelAutoRollbackEnabled()) return { rolled_back: false, note: "Auto-rollback disabled." };
  if (r.test_samples < r.min_samples) return { rolled_back: false, note: "Not enough samples to judge a regression." };
  if (r.exceeds) return { rolled_back: false, note: "Still exceeding the existing AI." };
  await setSetting("MODEL_BACKEND", "claude_shadow", "system@custom-model-auto-rollback").catch(() => null);
  await db.create("OptimizationSignal", { metric: "custom_model_rolled_back", value: 1, collected_at: new Date().toISOString() }, ACTOR).catch(() => null);
  await notifyAdmins("Custom model auto-reverted", `Your custom model no longer out-accuracies the existing AI (${r.custom_accuracy_pct}% vs ${r.incumbent_accuracy_pct}% on ${r.test_samples} samples) — the backend was automatically rolled back to shadow so decisions stay at least as accurate. It re-promotes when it pulls ahead again.`);
  return { rolled_back: true, note: `Rolled back to shadow (your ${r.custom_accuracy_pct}% not ahead of ${r.incumbent_accuracy_pct}%).` };
}

// Persist the numbers so the dashboard can trend them, run the auto-promotion / auto-rollback checks, return all.
export async function runAndRecordEval(): Promise<EvalResult & { promotion: PromotionResult; rollback: { rolled_back: boolean; note: string } }> {
  const r = await runShadowEval();
  const at = new Date().toISOString();
  await db.create("OptimizationSignal", { metric: "custom_model_accuracy_pct", value: r.custom_accuracy_pct, window_days: 0, collected_at: at }, ACTOR).catch(() => null);
  await db.create("OptimizationSignal", { metric: "incumbent_accuracy_pct", value: r.incumbent_accuracy_pct, window_days: 0, collected_at: at }, ACTOR).catch(() => null);
  await db.create("OptimizationSignal", { metric: "custom_model_exceeds", value: r.exceeds ? 1 : 0, window_days: 0, collected_at: at }, ACTOR).catch(() => null);
  const promotion = await maybeAutoPromote(r).catch(() => ({ eligible: false, promoted: false, streak: 0, required: modelReadyStreakRequired(), note: "promotion check skipped" }));
  const rollback = await maybeAutoRollback(r).catch(() => ({ rolled_back: false, note: "rollback check skipped" }));
  return { ...r, promotion, rollback };
}

export async function accuracyTrend(limit = 60): Promise<{ custom: Array<{ at: string; value: number }>; incumbent: Array<{ at: string; value: number }> }> {
  const map = (rows: any[]) => (rows || []).map((r) => ({ at: String(r.collected_at ?? r.created_date ?? ""), value: Number(r.value) || 0 })).reverse();
  const c = await db.filter("OptimizationSignal", { metric: "custom_model_accuracy_pct" }, "-created_date", limit).catch(() => []);
  const i = await db.filter("OptimizationSignal", { metric: "incumbent_accuracy_pct" }, "-created_date", limit).catch(() => []);
  return { custom: map(c), incumbent: map(i) };
}
