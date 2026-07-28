import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { getNumber, setSetting } from "../../sdk/settings.ts";
import { aiDailySpendUsd } from "../../sdk/integrations.ts";

// learningOverheadMonitor (INTERNAL/ADMIN, scheduled) — the safeguard that keeps the measurement/
// self-learning system from ever becoming the cost. It watches its OWN footprint (telemetry volume,
// metric-event volume, snapshot volume, and AI spend) and auto-throttles within bounds:
//   • Volume over OVERHEAD_MAX_EVENTS_PER_DAY  → lower TELEMETRY_SAMPLE_PCT + SESSION_CAPTURE_SAMPLE_PCT
//     (and raise them back gradually when volume subsides).
//   • AI spend ≥ OVERHEAD_AI_SPEND_PAUSE_PCT × AI_DAILY_SPEND_CAP_USD → pause live experiments for the
//     day (stops the optimizer/self-learning LLM calls) so user-facing AI is never crowded out.
// Everything it changes is a bounded setting flip, audited, and reversible.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const now = new Date();
    const todayStart = now.toISOString().slice(0, 10) + "T00:00:00.000Z";

    const countToday = async (entity: string) => {
      const rows = await db.filter(entity, {}, "-at", 5000).catch(() => []) as any[];
      return rows.filter((r) => String(r.at || "") >= todayStart).length;
    };
    const [events, metrics, snaps] = await Promise.all([
      countToday("InteractionEvent"), countToday("LiveMetricEvent"), countToday("UXHeatmapSnapshot"),
    ]);

    const maxEvents = await getNumber("OVERHEAD_MAX_EVENTS_PER_DAY", 0).catch(() => 0);
    const telSample = await getNumber("TELEMETRY_SAMPLE_PCT", 1).catch(() => 1);
    const capSample = await getNumber("SESSION_CAPTURE_SAMPLE_PCT", 0.02).catch(() => 0.02);
    const actions: string[] = [];

    // --- Volume governor ---
    if (maxEvents > 0) {
      if (events > maxEvents && telSample > 0.05) {
        const next = Math.max(0.05, Math.round(telSample * 0.5 * 100) / 100);
        await setSetting("TELEMETRY_SAMPLE_PCT", next, "overhead-monitor").catch(() => null);
        await setSetting("SESSION_CAPTURE_SAMPLE_PCT", Math.max(0.005, Math.round(capSample * 0.5 * 1000) / 1000), "overhead-monitor").catch(() => null);
        actions.push(`volume ${events} > ${maxEvents}: lowered telemetry sample to ${next}`);
      } else if (events < maxEvents * 0.5 && telSample < 1) {
        const next = Math.min(1, Math.round((telSample + 0.1) * 100) / 100);
        await setSetting("TELEMETRY_SAMPLE_PCT", next, "overhead-monitor").catch(() => null);
        actions.push(`volume low: raised telemetry sample to ${next}`);
      }
    }

    // --- AI-spend governor ---
    const aiCap = await getNumber("AI_DAILY_SPEND_CAP_USD", 0).catch(() => 0);
    const pauseFrac = await getNumber("OVERHEAD_AI_SPEND_PAUSE_PCT", 0.9).catch(() => 0.9);
    const spend = aiDailySpendUsd();
    if (aiCap > 0 && pauseFrac > 0 && pauseFrac < 1 && spend >= aiCap * pauseFrac) {
      await setSetting("LIVE_EXPERIMENTS_PAUSED", 1, "overhead-monitor").catch(() => null);
      actions.push(`AI spend $${spend} ≥ ${Math.round(pauseFrac * 100)}% of cap $${aiCap}: paused live experiments`);
    }

    const report = { events, metrics, snaps, ai_spend_usd: spend, ai_cap_usd: aiCap, actions, at: now.toISOString() };
    await db.create("OverheadReport", report, "overhead-monitor").catch(() => null);
    if (actions.length) await db.create("AdminAuditLog", { actor_email: "overhead-monitor", action_type: "overhead_throttle", target: "self-learning", details: report, timestamp: now.toISOString() }, "overhead-monitor").catch(() => null);

    return Response.json({ success: true, ...report });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
