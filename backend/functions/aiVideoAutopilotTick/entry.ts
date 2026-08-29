import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { renderBudget } from "../../sdk/video-engine.ts";
import {
  autopilotEnabled, autopilotMinVotes, autopilotMaxCollectHours, autopilotRenderLimit,
  autopilotAutonomy, trustMinRuns, trustMinAgreement, trustMinPlaybook,
  pollReady, ageHours, computeAgreement, autonomyDecision,
} from "../../sdk/video-autopilot.ts";

// aiVideoAutopilotTick — advance in-flight runs. For each "collecting" run whose poll is ready (enough votes,
// or waited long enough), it: learns from the poll, SELECTS the render winners within budget, then either
// (a) auto-approves + renders when the system has EARNED autonomy, or (b) parks at the human approval gate.
// Runs on a schedule and can be triggered manually. Admin / seed-admin service only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!autopilotEnabled()) return Response.json({ error: "Video Autopilot is disabled." }, { status: 403 });

    const nowISO = new Date().toISOString();
    const nowMs = Date.now();
    const budget = renderBudget();
    const renderLimit = autopilotRenderLimit();

    // Trust signals from the decision history (for graduated autonomy).
    const past = await db.filter("VideoPipelineRun", {}, "-created_at", 500).catch(() => []) as Record<string, unknown>[];
    const agreement = computeAgreement(past.map((r) => ({ decided: String(r.decided ?? ""), tweaked: r.tweaked === true, auto_approved: r.auto_approved === true })));
    const playbookSample = await db.count("OptimizationSignal", { kind: "video_outcome" }).catch(() => 0);
    const autonomy = autopilotAutonomy();
    const thr = { minRuns: trustMinRuns(), minAgreement: trustMinAgreement(), minPlaybook: trustMinPlaybook() };

    const collecting = await db.filter("VideoPipelineRun", { stage: "collecting" }, "-created_at", 50).catch(() => []) as Record<string, unknown>[];
    const advanced: Record<string, unknown>[] = [];

    for (const run of collecting) {
      const pollId = String(run.poll_id ?? "");
      const results = pollId ? await base44.functions.invoke("aiConceptPollResults", { poll_id: pollId }).catch(() => null) as Record<string, unknown> | null : null;
      const votes = Number(results?.votes) || 0;
      const age = ageHours(String(run.started_at ?? run.created_at ?? nowISO), nowMs);
      const ready = pollReady({ votes, minVotes: autopilotMinVotes(), ageHours: age, maxHours: autopilotMaxCollectHours() });
      if (!ready.ready) continue;

      // Learn from the poll (force, since we may be proceeding on a thin sample after the max wait).
      if (pollId) await base44.functions.invoke("aiConceptPollLearn", { poll_id: pollId, force: true }).catch(() => null);

      // Candidate winners: poll-ranked leaderboard, else top predictive concepts if there were no votes.
      let ranked = (results?.leaderboard as Record<string, unknown>[]) || [];
      if (!ranked.length) {
        ranked = await db.filter("VideoConcept", { phase: "concept", compliant: true }, "-predictive_score", renderLimit * 2).catch(() => []) as Record<string, unknown>[];
      }
      const eligible = ranked.filter((c) => (Number(c.predictive_score) || 0) >= budget.min_render_score);

      // Budget room (count + $). provider "none" spends nothing but still selects for approval.
      const renderedToday = await db.count("VideoConcept", { day: nowISO.slice(0, 10), phase: "rendered" }).catch(() => 0);
      const perCost = budget.est_cost_per_render_usd > 0 ? budget.est_cost_per_render_usd : 0.0001;
      const countRoom = budget.provider === "none" ? renderLimit
        : Math.max(0, Math.min(renderLimit, budget.daily_render_max - renderedToday, Math.floor((budget.daily_spend_cap_usd - renderedToday * budget.est_cost_per_render_usd) / perCost)));
      const chosen = eligible.slice(0, Math.max(0, countRoom));
      const candidates = chosen.map((c) => ({
        id: String(c.id), attributes: c.attributes || {}, trend: (c.trend as Record<string, unknown>)?.topic ?? c.trend ?? null,
        predictive_score: Number(c.predictive_score) || 0, poll_score: Number(c.score) || 0,
      }));
      const estCost = budget.provider === "none" ? 0 : Math.round(candidates.length * budget.est_cost_per_render_usd * 100) / 100;

      const decision = autonomyDecision(autonomy, { approvedRuns: agreement.approvedRuns, agreementRate: agreement.agreementRate, playbookSample }, thr);

      if (decision.auto_approve && candidates.length) {
        // EARNED (or full) autonomy → render now, no human gate. Budget caps already applied above.
        const render = await base44.functions.invoke("aiVideoEngineRenderWinners", { concept_ids: candidates.map((c) => c.id), limit: renderLimit }).catch((e: unknown) => ({ error: String(e) })) as Record<string, unknown>;
        await db.update("VideoPipelineRun", String(run.id), {
          stage: "rendered", votes, candidates, est_cost_usd: estCost,
          auto_approved: true, decided: "approved", tweaked: false, autonomy, autonomy_reason: decision.reason,
          render_result: { rendered: render?.rendered ?? render?.would_render ?? 0, provider: budget.provider },
          decided_at: nowISO, updated_at: nowISO,
        }).catch(() => null);
        advanced.push({ run_id: run.id, outcome: "auto_rendered", candidates: candidates.length, reason: decision.reason });
      } else {
        // Park at the human approval gate.
        await db.update("VideoPipelineRun", String(run.id), {
          stage: "awaiting_render_approval", votes, candidates, est_cost_usd: estCost,
          autonomy, autonomy_reason: decision.reason, selected_at: nowISO, updated_at: nowISO,
        }).catch(() => null);
        advanced.push({ run_id: run.id, outcome: "awaiting_approval", candidates: candidates.length, reason: ready.reason });
      }
    }

    return Response.json({
      ok: true, checked: collecting.length, advanced: advanced.length, runs: advanced,
      autonomy, trust: { ...agreement, playbook_sample: playbookSample, thresholds: thr },
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
