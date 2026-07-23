import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// INCREMENT 5 — Learning insights for the dashboard.
// Per-agent success trends + the latest platform insight + recent lessons (with veto/pin
// status) so a human can see what the agents are learning and step in.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !["admin", "developer"].includes(user.role)) {
      return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
    }
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const mems = (await base44.asServiceRole.entities.AgentLearningMemory.filter(
      { recorded_at: { $gte: since } }, "-recorded_at", 8000,
    ).catch(() => [])) as Record<string, unknown>[];

    const agents: Record<string, { runs: number; wins: number; grounded: number; cost: number }> = {};
    let platformInsight = "";
    const lessons: Record<string, unknown>[] = [];

    for (const m of mems) {
      const a = String(m.agent_name ?? "");
      if (a === "__platform__") { if (!platformInsight && m.improvement_notes) platformInsight = String(m.improvement_notes); continue; }
      if (!a) continue;
      const g = (agents[a] ??= { runs: 0, wins: 0, grounded: 0, cost: 0 });
      g.runs++; if (m.success) g.wins++; if (m.provisional === false) g.grounded++; g.cost += Number(m.cost_usd) || 0;
      if (m.improvement_notes && lessons.length < 100) {
        lessons.push({ id: m.id, agent: a, note: m.improvement_notes, success: m.success, pinned: !!m.pinned, vetoed: !!m.vetoed, at: m.recorded_at });
      }
    }

    const perAgent = Object.entries(agents).map(([agent, g]) => ({
      agent, runs: g.runs,
      success_rate: g.runs ? Math.round((g.wins / g.runs) * 100) : 0,
      grounded_share: g.runs ? Math.round((g.grounded / g.runs) * 100) : 0,
      avg_cost_usd: g.runs ? Math.round((g.cost / g.runs) * 1e4) / 1e4 : 0,
    })).sort((a, b) => a.success_rate - b.success_rate);

    return Response.json({ ok: true, platform_insight: platformInsight, per_agent: perAgent, lessons });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
