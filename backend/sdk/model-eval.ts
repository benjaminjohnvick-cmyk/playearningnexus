// model-eval.ts — measures YOUR model's accuracy AGAINST THE INCUMBENT AI, step by step, as data accumulates.
//
// Method (leak-free, honest): take the collected labeled examples (each label is what the incumbent AI + human
// actually decided). Sort by time. TRAIN the predictor on the older split; TEST it on the newer split by
// predicting each newer example and comparing to the label the incumbent actually produced. Accuracy = share of
// newer decisions your model would have gotten right. That is precisely "does my model match the pre-existing
// AI?" — and it rises as more data comes in. The model is READY only when accuracy >= target AND there are
// enough test samples. Each run records a `custom_model_accuracy_pct` signal so the number trends over time.
import { db } from "./db.ts";
import { setSetting } from "./settings.ts";
import { buildTrainingExamples } from "./model-training.ts";
import { trainIndex, predictInternal, modelAccuracyTargetPct, modelMinEvalSamples, modelBackend, modelAutoPromoteEnabled, modelReadyStreakRequired } from "./custom-model.ts";
import { sendPushToUser } from "./approvals.ts";

const ACTOR = "system@getgoodsgratis.local";
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface EvalResult {
  accuracy_pct: number;        // agreement with the incumbent AI on the held-out (newer) decisions
  test_samples: number;
  train_samples: number;
  by_domain: Record<string, { accuracy_pct: number; n: number }>;
  target_pct: number;
  min_samples: number;
  ready: boolean;              // TRUE only when the model matches the incumbent at target accuracy
  backend: string;
  note: string;
}

export async function runShadowEval(): Promise<EvalResult> {
  const target = modelAccuracyTargetPct();
  const minSamples = modelMinEvalSamples();

  // Only decision labels are a clean "the AI decided X" signal to match against.
  const all = (await buildTrainingExamples(20000)).filter((e) => e.type === "decision_label" && e.label && e.domain);
  all.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const splitAt = Math.floor(all.length * 0.7);
  const train = all.slice(0, splitAt);
  const test = all.slice(splitAt);
  const index = trainIndex(train);

  let correct = 0, scored = 0;
  const dom: Record<string, { correct: number; n: number }> = {};
  for (const e of test) {
    const p = predictInternal(index, e);
    if (!p.label) continue; // model abstains (not enough data yet) — not scored against it
    scored++;
    const d = String(e.domain);
    dom[d] = dom[d] || { correct: 0, n: 0 };
    dom[d].n++;
    if (p.label === e.label) { correct++; dom[d].correct++; }
  }

  const accuracy = scored ? round1((correct / scored) * 100) : 0;
  const byDomain: Record<string, { accuracy_pct: number; n: number }> = {};
  for (const [k, v] of Object.entries(dom)) byDomain[k] = { accuracy_pct: v.n ? round1((v.correct / v.n) * 100) : 0, n: v.n };

  const ready = scored >= minSamples && accuracy >= target;

  return {
    accuracy_pct: accuracy,
    test_samples: scored,
    train_samples: index.size,
    by_domain: byDomain,
    target_pct: target,
    min_samples: minSamples,
    ready,
    backend: modelBackend(),
    note: ready
      ? `READY — your model matches the incumbent AI at ${accuracy}% (>= ${target}% target) over ${scored} held-out decisions. You can consider flipping MODEL_BACKEND to "custom" (money/identity/legal stay human-gated).`
      : `NOT READY — accuracy ${accuracy}% vs incumbent on ${scored}/${minSamples} needed samples (target ${target}%). It rises as more labeled decisions accumulate.`,
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

// The automatic switchover: when the model has MATCHED the incumbent at target accuracy for enough CONSECUTIVE
// evals (a sustained result, not a one-off), either auto-flip the active backend to "custom" (if auto-promote is
// on) or notify the admins that it's ready to promote. This is "switch over when the data says it's the
// appropriate time." Money/identity/legal decisions stay human-gated no matter which backend is active.
export async function maybeAutoPromote(r: EvalResult): Promise<PromotionResult> {
  const required = modelReadyStreakRequired();
  if (modelBackend() === "custom") return { eligible: false, promoted: false, streak: required, required, note: "Already running the custom backend." };
  const target = modelAccuracyTargetPct();
  const rows = await db.filter("OptimizationSignal", { metric: "custom_model_accuracy_pct" }, "-created_date", 40).catch(() => []);
  let streak = 0;
  for (const row of rows || []) { if ((Number((row as any).value) || 0) >= target) streak++; else break; }
  const eligible = r.ready && streak >= required;
  if (!eligible) return { eligible: false, promoted: false, streak, required, note: `Ready streak ${streak}/${required} at >= ${target}%.` };

  if (modelAutoPromoteEnabled()) {
    await setSetting("MODEL_BACKEND", "custom", "system@custom-model-auto-promote").catch(() => null);
    await db.create("OptimizationSignal", { metric: "custom_model_promoted", value: 1, collected_at: new Date().toISOString() }, ACTOR).catch(() => null);
    await notifyAdmins("Custom model promoted automatically", `Your model matched the incumbent AI at >= ${target}% for ${streak} consecutive evaluations — the active backend auto-switched to "custom". Money / identity / legal decisions remain human-gated.`);
    return { eligible: true, promoted: true, streak, required, note: 'Auto-promoted: backend switched to "custom".' };
  }
  await notifyAdmins("Custom model is ready to promote", `Your model matched the incumbent AI at >= ${target}% for ${streak} consecutive evaluations. Flip it in with the "Promote" action (or turn on MODEL_AUTO_PROMOTE_ENABLED to switch automatically next time).`);
  return { eligible: true, promoted: false, streak, required, note: "Eligible — auto-promote is off, so it's waiting for your go-ahead." };
}

// Persist the accuracy number so the dashboard can trend it, run the auto-promotion check, and return the eval.
export async function runAndRecordEval(): Promise<EvalResult & { promotion: PromotionResult }> {
  const r = await runShadowEval();
  await db.create("OptimizationSignal", {
    metric: "custom_model_accuracy_pct", value: r.accuracy_pct, window_days: 0,
    collected_at: new Date().toISOString(),
  }, ACTOR).catch(() => null);
  const promotion = await maybeAutoPromote(r).catch(() => ({ eligible: false, promoted: false, streak: 0, required: modelReadyStreakRequired(), note: "promotion check skipped" }));
  return { ...r, promotion };
}

export async function accuracyTrend(limit = 60): Promise<Array<{ at: string; value: number }>> {
  const rows = await db.filter("OptimizationSignal", { metric: "custom_model_accuracy_pct" }, "-created_date", limit).catch(() => []);
  return (rows || []).map((r: any) => ({ at: String(r.collected_at ?? r.created_date ?? ""), value: Number(r.value) || 0 })).reverse();
}
