import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { autopilotEnabled, autopilotRenderLimit, needsApproval, tweakSelection } from "../../sdk/video-autopilot.ts";

// aiVideoAutopilotApprove — the HUMAN GATE. Given a run parked at "awaiting_render_approval", the owner:
//   • approves       → render the selected winners (optionally a tweaked subset via concept_ids)
//   • rejects        → cancel the run (nothing renders)
// The decision (and whether it was a clean approve or a tweak) is recorded — that's the signal the system
// learns from to EARN autonomy over time. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!autopilotEnabled()) return Response.json({ error: "Video Autopilot is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const runId = String(body.run_id ?? "");
    const action = String(body.action ?? "").toLowerCase();
    if (!runId) return Response.json({ error: "run_id is required." }, { status: 400 });
    if (action !== "approve" && action !== "reject") return Response.json({ error: "action must be 'approve' or 'reject'." }, { status: 400 });

    const run = await db.get("VideoPipelineRun", runId).catch(() => null) as Record<string, unknown> | null;
    if (!run) return Response.json({ error: "Run not found." }, { status: 404 });
    if (!needsApproval(String(run.stage))) return Response.json({ error: `Run is not awaiting approval (stage: ${run.stage}).` }, { status: 409 });

    const now = new Date().toISOString();
    const candidates = (run.candidates as Record<string, unknown>[]) || [];
    const candidateIds = candidates.map((c) => String(c.id));

    if (action === "reject") {
      await db.update("VideoPipelineRun", runId, { stage: "cancelled", decided: "rejected", tweaked: false, decided_by: user.id, decided_at: now, updated_at: now }).catch(() => null);
      return Response.json({ ok: true, run_id: runId, decided: "rejected" });
    }

    // approve — optional tweak: a subset of candidate ids the owner kept.
    const approvedIds = Array.isArray(body.concept_ids) ? body.concept_ids.map(String) : null;
    const finalIds = tweakSelection(candidateIds, approvedIds);
    const tweaked = !!approvedIds && finalIds.length !== candidateIds.length;
    if (!finalIds.length) return Response.json({ error: "No concepts selected to render." }, { status: 400 });

    const render = await base44.functions.invoke("aiVideoEngineRenderWinners", { concept_ids: finalIds, limit: Number(body.limit) || autopilotRenderLimit() }).catch((e: unknown) => ({ error: String(e) })) as Record<string, unknown>;
    if (render?.error) return Response.json({ error: `Render failed: ${render.error}` }, { status: 500 });

    await db.update("VideoPipelineRun", runId, {
      stage: "rendered", decided: "approved", tweaked, auto_approved: false,
      approved_count: finalIds.length, decided_by: user.id, decided_at: now, updated_at: now,
      render_result: { rendered: render?.rendered ?? render?.would_render ?? 0, provider: render?.provider ?? null },
    }).catch(() => null);

    return Response.json({
      ok: true, run_id: runId, decided: "approved", tweaked,
      rendered: render?.rendered ?? render?.would_render ?? 0, provider: render?.provider ?? null,
      note: tweaked ? "Approved a tweaked subset — that's a training signal too." : "Approved as-is — clean approvals build toward auto-pilot.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
