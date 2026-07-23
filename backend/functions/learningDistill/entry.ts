import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// INCREMENT 2 — Shared cross-agent learning.
//
// Reads the raw learning data every agent produces (AgentLearningMemory), the cost/usage
// meter (AgentPerformanceLog), and the survey-driven signals (SurveySignal), then DISTILLS:
//   • per-agent lessons  — a concise improvement note the agent reads next run (recallLessons)
//   • global platform insights (agent_name="__platform__") — read by ALL agents
// This is how one process's/agent's data improves every other AI function.
//
// Deterministic by design (reliable + cheap): it aggregates real outcomes rather than asking
// an LLM to guess. Run on a schedule (see scheduler/schedules.json).
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const PLATFORM = "__platform__";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const since = new Date(Date.now() - LOOKBACK_MS).toISOString();

    // Pull recent runtime-recorded outcomes (skip prior distilled/platform rows).
    const mems = (await base44.asServiceRole.entities.AgentLearningMemory.filter(
      { recorded_at: { $gte: since } }, "-recorded_at", 5000,
    ).catch(() => [])) as Record<string, unknown>[];

    // Group by agent.
    const byAgent: Record<string, { n: number; wins: number; cost: number; fails: string[] }> = {};
    for (const m of mems) {
      const a = String(m.agent_name ?? "");
      if (!a || a === PLATFORM || m.distilled) continue;
      const g = (byAgent[a] ??= { n: 0, wins: 0, cost: 0, fails: [] });
      g.n++;
      if (m.success) g.wins++;
      g.cost += Number(m.cost_usd) || 0;
      if (m.success === false && m.action_taken) g.fails.push(String(m.action_taken).slice(0, 80));
    }

    // Write one distilled lesson per agent.
    let perAgent = 0;
    const summary: { agent: string; success_rate: number; n: number }[] = [];
    for (const [agent, g] of Object.entries(byAgent)) {
      if (g.n < 3) continue; // not enough signal yet
      const rate = Math.round((g.wins / g.n) * 100);
      const topFail = mostCommon(g.fails);
      const note = `Recent success ${rate}% over ${g.n} runs (avg $${(g.cost / g.n).toFixed(4)}/run).` +
        (rate < 60 ? ` Improve reliability.` : ` Maintain approach.`) +
        (topFail ? ` Most common failure to fix: "${topFail}".` : ``);
      await base44.asServiceRole.entities.AgentLearningMemory.create({
        agent_name: agent, action_taken: "distilled_lesson", success: rate >= 60,
        improvement_notes: note, distilled: true, recorded_at: new Date().toISOString(), source: "learningDistill",
      }).catch(() => {});
      perAgent++;
      summary.push({ agent, success_rate: rate, n: g.n });
    }

    // Global platform insights (read by every agent via recallLessons).
    summary.sort((a, b) => a.success_rate - b.success_rate);
    const needsAttention = summary.slice(0, 3).map((s) => `${s.agent} (${s.success_rate}%)`);
    const topPerformers = summary.slice(-3).reverse().map((s) => `${s.agent} (${s.success_rate}%)`);

    // Survey-signal themes so agent decisions track what users are actually telling us.
    const signals = (await base44.asServiceRole.entities.SurveySignal.filter(
      { quality_ok: true, created_date: { $gte: since } }, "-created_date", 2000,
    ).catch(() => [])) as Record<string, unknown>[];
    const topTopics = mostCommonList(signals.map((s) => String(s.topic ?? "")).filter(Boolean), 5);

    const platformNote =
      `Platform (7d): ${summary.reduce((n, s) => n + s.n, 0)} agent runs across ${summary.length} agents. ` +
      (topPerformers.length ? `Top performers: ${topPerformers.join(", ")}. ` : ``) +
      (needsAttention.length ? `Needs attention: ${needsAttention.join(", ")}. ` : ``) +
      (topTopics.length ? `What users care about most (survey signals): ${topTopics.join(", ")}.` : ``);

    await base44.asServiceRole.entities.AgentLearningMemory.create({
      agent_name: PLATFORM, action_taken: "platform_insight", success: true,
      improvement_notes: platformNote, distilled: true, recorded_at: new Date().toISOString(), source: "learningDistill",
    }).catch(() => {});

    return Response.json({ ok: true, agents_distilled: perAgent, platform_insight: platformNote, top_topics: topTopics });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

function mostCommon(arr: string[]): string | null {
  if (!arr.length) return null;
  const c: Record<string, number> = {};
  for (const x of arr) c[x] = (c[x] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}
function mostCommonList(arr: string[], n: number): string[] {
  const c: Record<string, number> = {};
  for (const x of arr) c[x] = (c[x] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}
