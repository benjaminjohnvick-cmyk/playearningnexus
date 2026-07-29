// ai-control.ts — the global "AI is on, but a human is watching" layer.
//
// All AI functionality runs autonomously from the get-go. This module gives a human three things:
//   1. A REAL-TIME FEED of what the AI is doing (logAiAction → AIActivityLog → recentAiActivity).
//   2. A GLOBAL STOP BUTTON: the `ai_paused` flag. aiPaused() is checked by the autonomous loops
//      (optimizer pass, self-learning, live auto-apply), so flipping it ON instantly halts AI changes.
//   3. A CORRECTION path: when a human sees the AI do something wrong, they stop it, fix the value, and
//      push the correction — recordCorrection() applies it AND writes learning signals so the AI learns
//      from the human fix on the next self-learning pass.

import { db } from "./db.ts";
import { isEnabled, setFlag } from "./feature-flags.ts";

export const AI_PAUSE_FLAG = "ai_paused";
const ACTIVITY = "AIActivityLog";
const CORRECTION = "AICorrection";

/** Is the global AI kill switch engaged? (true = AI changes are halted.) */
export async function aiPaused(): Promise<boolean> {
  return await isEnabled(AI_PAUSE_FLAG as never).catch(() => false);
}

/** Engage/release the global AI kill switch. */
export async function setAiPaused(paused: boolean, by?: string): Promise<void> {
  await setFlag(AI_PAUSE_FLAG, paused, by);
}

export interface AiActionEntry {
  agent: string;                 // which AI/engine acted, e.g. "optimizer", "self_learning", "kyc_ai"
  action: string;                // short verb, e.g. "setting_change", "experiment_start", "survey_publish"
  target?: string;               // what it touched
  summary: string;               // one-line human-readable description for the feed
  detail?: Record<string, unknown>;
  status?: string;               // applied | queued | experiment | paused | corrected | reverted
  setting_key?: string;          // if it changed a setting (enables one-click correction)
  from?: unknown;
  to?: unknown;
  reversible?: boolean;
}

/** Append one AI action to the live feed. Best-effort — never throws into the caller. */
export async function logAiAction(e: AiActionEntry): Promise<{ id?: string } | null> {
  const row = {
    at: new Date().toISOString(),
    status: e.status || "applied",
    reversible: e.reversible !== false,
    ...e,
  };
  return await db.create(ACTIVITY, row).catch(() => null) as { id?: string } | null;
}

/** Most-recent AI actions, newest first, for the oversight feed. */
export async function recentAiActivity(limit = 60): Promise<Record<string, unknown>[]> {
  return await db.filter(ACTIVITY, {}, "-created_date", Math.min(200, Math.max(1, limit))).catch(() => []) as Record<string, unknown>[];
}

/**
 * Record a human correction to something the AI did, and feed it back into learning. Writes an
 * AICorrection row (the audit of the fix), an OptimizationSignal (so the optimizer/self-learning
 * grounding weighs the human's preferred value), and an AgentLearningMemory note (the durable lesson).
 * Returns the saved correction row. The actual value change (e.g. setSetting) is done by the caller,
 * which knows whether the target is a safe, non-compliance setting.
 */
export async function recordCorrection(
  c: { activity_id?: string; agent?: string; target?: string; setting_key?: string; from?: unknown; to?: unknown; note?: string },
  by?: string,
): Promise<Record<string, unknown> | null> {
  const at = new Date().toISOString();
  const key = c.setting_key || c.target || "unknown";
  const saved = await db.create(CORRECTION, { ...c, by: by ?? null, at, created_at: at }, by).catch(() => null);
  // Feedback signal the self-learning grounding picks up (human corrections carry strong weight).
  await db.create("OptimizationSignal", {
    kind: "human_correction", key, note: String(c.note || "").slice(0, 500),
    from: c.from ?? null, to: c.to ?? null, weight: 5, created_at: at,
  }).catch(() => null);
  // Durable lesson for the agent memory.
  await db.create("AgentLearningMemory", {
    type: "human_correction", target: key,
    lesson: `A human corrected the AI on "${key}"${c.note ? ": " + String(c.note).slice(0, 400) : "."}`,
    from: c.from ?? null, to: c.to ?? null, created_at: at,
  }).catch(() => null);
  await logAiAction({
    agent: "human", action: "correction", target: key, setting_key: c.setting_key,
    from: c.from, to: c.to, status: "corrected",
    summary: `Human corrected ${key}${c.note ? " — " + String(c.note).slice(0, 120) : ""}`,
    detail: { note: c.note, activity_id: c.activity_id },
  }).catch(() => null);
  return saved as Record<string, unknown> | null;
}
