import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { createClientFromRequest } from "../../sdk/mod.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { aiPaused } from "../../sdk/ai-control.ts";
import { getNumber } from "../../sdk/settings.ts";
import { aggregateStats } from "../../sdk/telemetry.ts";
import { refreshSiteModel } from "../../sdk/site-model.ts";
import { runOptimizationPass } from "../../sdk/optimizer.ts";
import { evaluateExperiments } from "../../sdk/experiments.ts";
import { db } from "../../sdk/db.ts";

// selfLearningCycle (INTERNAL/ADMIN, scheduled) — the master self-improvement pass. It closes the loop
// the product asks for, reusing the engines already in the repo:
//
//   1. COLLECT + ANALYZE  → aggregateStats() rolls interaction telemetry into funnel/scroll/drop-off
//      statistics and publishes them as OptimizationSignal rows; sessionCaptureAnalyzeBatch turns the
//      sampled screenshots into UX findings/signals; KYC interest distributions are aggregated too.
//   2. GROUND             → refreshSiteModel() recompiles the site's Claude-based model from those
//      signals so every downstream AI prediction/recommendation/creation reflects the newest data.
//   3. PROPOSE → SURVEY → A/B TEST → DEPLOY → runOptimizationPass() proposes small, in-bounds changes;
//      with OPTIMIZER_REQUIRE_EXPERIMENT on (default) each proposal becomes an A/B mockup + customer
//      survey (createExperimentForProposal), and only customer-favored winners deploy. Money/compliance
//      -sensitive changes never auto-apply — they queue for human approval.
//   4. MEASURE            → evaluateExperiments() ships experiments that have collected enough favorable
//      responses; measureOutcomes (inside the pass) keeps wins and reverts losses.
//
// Every actionable step is gated on SELF_LEARNING_MIN_SAMPLE so changes stay small, iterative, and
// statistically backed rather than reactions to a handful of events.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    if (!(await isEnabled("self_learning").catch(() => true))) {
      return Response.json({ success: true, skipped: "self_learning flag off" });
    }
    // GLOBAL AI KILL SWITCH — a human hit stop; don't run the self-improvement pass.
    if (await aiPaused().catch(() => false)) {
      return Response.json({ success: true, skipped: "ai_paused" });
    }
    const base44 = createClientFromRequest(req);
    const minSample = Math.max(1, await getNumber("SELF_LEARNING_MIN_SAMPLE", 30));

    // 1. Collect + analyze telemetry into statistics + signals.
    const stats = await aggregateStats(14, true).catch(() => null);

    // 1b. Analyze a batch of sampled session screenshots (hard-capped by its own budget gate).
    const capture = await base44.asServiceRole.functions.invoke("sessionCaptureAnalyzeBatch", {}).catch(() => null);

    // 1c. Aggregate KYC interest distribution → a signal (what the member base actually wants).
    const kyc = await aggregateKycInterests(minSample).catch(() => null);

    // 2. Recompile the site model so all AI is grounded in the freshest data.
    const model = await refreshSiteModel().catch(() => "");

    // Guard: if we don't yet have a statistically meaningful sample, ground the model but DON'T propose
    // changes — small/iterative/correlated means we wait for enough data.
    const enoughData = !!stats && stats.sample_ok;

    let optimize: Record<string, unknown> | null = null;
    let evaluated: Array<Record<string, unknown>> = [];
    if (enoughData) {
      // 3. Propose → (survey + A/B via experiments) → auto-apply non-sensitive winners / queue sensitive.
      optimize = await runOptimizationPass({}).catch(() => null);
      // 4. Deploy experiments that have gathered enough favorable customer feedback.
      evaluated = await evaluateExperiments().catch(() => []);
    }

    return Response.json({
      success: true,
      analyzed: {
        telemetry: stats ? { events: stats.events, funnel: stats.funnel, drop_off: stats.drop_off, sample_ok: stats.sample_ok } : null,
        session_capture: capture?.data || capture || null,
        kyc_interests: kyc,
      },
      grounded: !!model,
      proposed: enoughData,
      optimize: optimize ? {
        auto_applied: (optimize as any).auto_applied,
        in_experiment: (optimize as any).in_experiment,
        pending_approval: (optimize as any).pending_approval,
      } : null,
      experiments_evaluated: evaluated,
      note: enoughData ? undefined : `Waiting for a larger sample (need ≥ ${minSample} events) before proposing changes.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

/** Aggregate KYC category interest across all responses and publish the top interests as a signal. */
async function aggregateKycInterests(minSample: number): Promise<Record<string, number> | null> {
  const rows = await db.filter("KYCResponse", {}, "-created_date", 5000).catch(() => []) as any[];
  if (!rows.length || rows.length < minSample) return null;
  const dist: Record<string, number> = {};
  for (const r of rows) {
    const cats = (r.answers && Array.isArray(r.answers.categories)) ? r.answers.categories : [];
    for (const c of cats) dist[String(c)] = (dist[String(c)] || 0) + 1;
  }
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c).join("|");
  await db.create("OptimizationSignal", {
    metric: "kyc_top_interests", value: rows.length, top, collected_at: new Date().toISOString(), source: "kyc", sample: rows.length,
  }, "kyc").catch(() => null);
  return dist;
}
