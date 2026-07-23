// Agent learning loop — connects the runtime to the EXISTING AgentLearningMemory store.
//
// The learning store and the function that writes it (aiAgentLearningSystem, used by 14
// functions) already existed, but the agent runtime never used them: agents didn't recall
// what they'd learned before acting, and didn't record outcomes after. This module is the
// missing read/write wiring. Reuses the AgentLearningMemory entity — no new table.
//
// Scope note: this is PROMPT-LEVEL learning (agents steer by their own past outcomes and by
// shared platform insights), not model retraining. Success is PROVISIONAL here (Increment 4
// grounds it against real outcomes).
import { db } from "../sdk/db.ts";

const LOOKBACK_DAYS = 30;
const PLATFORM = "__platform__"; // shared insights written by learningDistill (Increment 2)

type Mem = Record<string, unknown>;

/** Concise "what you've learned" text to inject into an agent's system prompt. Empty if none. */
export async function recallLessons(agentName: string): Promise<string> {
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
    const raw = await db.filter(
      "AgentLearningMemory",
      { agent_name: agentName, recorded_at: { $gte: since } },
      "-recorded_at",
      80,
    ) as Mem[];

    // SAFETY: vetoed lessons are excluded; pinned lessons are always surfaced first.
    const mems = raw.filter((m) => !m.vetoed);
    const pinned = mems.filter((m) => m.pinned && m.improvement_notes).map((m) => m.improvement_notes) as string[];

    const parts: string[] = [];

    if (mems.length) {
      const wins = mems.filter((m) => m.success).length;
      const rate = Math.round((wins / mems.length) * 100);
      const otherNotes = mems.filter((m) => !m.pinned).map((m) => m.improvement_notes).filter(Boolean) as string[];
      const notes = [...pinned, ...otherNotes].slice(0, 5);
      const failures = mems.filter((m) => m.success === false).map((m) => m.action_taken).filter(Boolean).slice(0, 3) as string[];
      parts.push(`WHAT YOU'VE LEARNED (last ${LOOKBACK_DAYS}d, ${rate}% success over ${mems.length} actions):`);
      if (notes.length) parts.push(`- Improvements to apply: ${notes.join("; ")}`);
      if (failures.length) parts.push(`- Approaches that previously FAILED (avoid or adjust): ${failures.join("; ")}`);
    }

    // Platform-wide insights shared across ALL agents (so one process's data improves the rest).
    try {
      const gi = await db.filter("AgentLearningMemory", { agent_name: PLATFORM }, "-recorded_at", 3) as Mem[];
      const g = gi.map((m) => m.improvement_notes).filter(Boolean) as string[];
      if (g.length) parts.push(`- Platform-wide insights: ${g.join("; ")}`);
    } catch { /* optional */ }

    return parts.length ? `\n\n${parts.join("\n")}` : "";
  } catch {
    return ""; // recall is best-effort; never block an agent because the memory query failed
  }
}

/** Record a run's outcome so the agent (and, via distill, the platform) learns from it. */
export async function recordOutcome(agentName: string, o: {
  summary: string;
  success: boolean;
  provisional?: boolean;
  cost_usd?: number;
  blocked?: boolean;
  tools_used?: string[];
}): Promise<void> {
  try {
    await db.create("AgentLearningMemory", {
      agent_name: agentName,
      action_taken: (o.summary || "").slice(0, 500),
      outcome: o.success ? 1 : 0,
      success: o.success,
      feedback_score: o.success ? 1 : 0,
      provisional: o.provisional ?? true, // Increment 4 confirms/overturns against real results
      cost_usd: o.cost_usd ?? 0,
      blocked: o.blocked ?? false,
      tools_used: o.tools_used ?? [],
      improvement_notes: "",
      recorded_at: new Date().toISOString(),
      source: "runtime",
    });
  } catch { /* learning is best-effort; never break the agent on a log failure */ }
}
