import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  autopilotEnabled, autopilotAutonomy, autopilotBatchSize, autopilotMinVotes, autopilotMaxCollectHours, autopilotRenderLimit,
  trustMinRuns, trustMinAgreement, trustMinPlaybook, computeAgreement, autonomyDecision, needsApproval,
} from "../../sdk/video-autopilot.ts";

// aiVideoAutopilotStatus — the autopilot dashboard: recent runs, the run(s) waiting for approval (with their
// candidate winners for the UI), and the TRUST meter showing how close the system is to earning full
// autonomy (so the human gate eventually comes off on its own). Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const [runs, playbookSample] = await Promise.all([
      db.filter("VideoPipelineRun", {}, "-created_at", 40).catch(() => []) as Promise<Record<string, unknown>[]>,
      db.count("OptimizationSignal", { kind: "video_outcome" }).catch(() => 0),
    ]);

    const agreement = computeAgreement((runs || []).map((r) => ({ decided: String(r.decided ?? ""), tweaked: r.tweaked === true, auto_approved: r.auto_approved === true })));
    const autonomy = autopilotAutonomy();
    const thr = { minRuns: trustMinRuns(), minAgreement: trustMinAgreement(), minPlaybook: trustMinPlaybook() };
    const decision = autonomyDecision(autonomy, { approvedRuns: agreement.approvedRuns, agreementRate: agreement.agreementRate, playbookSample }, thr);

    const awaiting = (runs || []).filter((r) => needsApproval(String(r.stage))).map((r) => ({
      run_id: r.id, poll_id: r.poll_id, votes: r.votes, est_cost_usd: r.est_cost_usd,
      autonomy_reason: r.autonomy_reason, candidates: r.candidates || [], selected_at: r.selected_at,
    }));

    const recent = (runs || []).slice(0, 15).map((r) => ({
      run_id: r.id, stage: r.stage, decided: r.decided ?? null, auto_approved: r.auto_approved === true,
      tweaked: r.tweaked === true, votes: r.votes ?? 0, candidates: Array.isArray(r.candidates) ? (r.candidates as unknown[]).length : 0,
      est_cost_usd: r.est_cost_usd ?? 0, started_at: r.started_at, decided_at: r.decided_at ?? null,
    }));

    return Response.json({
      enabled: autopilotEnabled(),
      autonomy,
      settings: { batch_size: autopilotBatchSize(), min_votes: autopilotMinVotes(), max_collect_hours: autopilotMaxCollectHours(), render_limit: autopilotRenderLimit() },
      trust: {
        approved_runs: agreement.approvedRuns, clean_approvals: agreement.cleanApprovals,
        human_decisions: agreement.humanDecisions, agreement_rate: Math.round(agreement.agreementRate * 100) / 100,
        playbook_sample: playbookSample, thresholds: thr,
        earned: decision.earned, auto_approving: decision.auto_approve, status: decision.reason, progress: decision.progress,
      },
      awaiting_approval: awaiting,
      recent_runs: recent,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
