// Survey-evidence pipeline helpers.
//
// A SurveySignal is a normalized, quality-scored fact derived from a survey response — the
// trustworthy input agents are allowed to act on, and the justification attached to any
// proposed action. This is the "survey data justifies" half of "AI proposes, survey data
// justifies, a human disposes." Signals are produced by the surveyIngest function; these
// helpers read them back as evidence and record which signals justified an action.
import { db } from "./db.ts";

export type SignalQuery = { userId?: string; topic?: string; limit?: number };

/** Recent, quality-passed survey signals relevant to a user / topic (for attaching as evidence). */
export async function gatherEvidence(q: SignalQuery = {}): Promise<Record<string, unknown>[]> {
  const filter: Record<string, unknown> = { quality_ok: true };
  if (q.userId) filter.user_id = q.userId;
  if (q.topic) filter.topic = q.topic;
  try {
    const rows = await db.filter("SurveySignal", filter, "-created_date", q.limit ?? 10);
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      topic: r.topic,
      value: r.value,
      quality_score: r.quality_score,
      source: r.source,
      at: r.created_date,
    }));
  } catch {
    return [];
  }
}

/** Persist the link between an approval/action and the signals that justified it. */
export async function linkEvidence(refType: string, refId: string, signals: Record<string, unknown>[]) {
  try {
    await db.create("SurveyEvidence", {
      ref_type: refType,
      ref_id: refId,
      signal_ids: signals.map((s) => s.id),
      signals,
      at: new Date().toISOString(),
    });
  } catch { /* best-effort */ }
}
