import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { globalReviewWindow, promoteExperimentGlobally, rejectEligibleExperiment } from "../../sdk/experiments.ts";
import { logAiAction } from "../../sdk/ai-control.ts";
import { db } from "../../sdk/db.ts";

// aiGlobalDecide (ADMIN) — during the daily peak-time review window, promote an individually-approved
// change SITE-WIDE, or reject it. Only works while the window is open (the human check is once/24h).
//   Body: { experiment_id, action: "apply" | "reject" }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const { experiment_id, action } = await req.json().catch(() => ({}));
    if (!experiment_id || !["apply", "reject"].includes(action)) return Response.json({ error: 'experiment_id and action ("apply"|"reject") required' }, { status: 400 });

    const window = await globalReviewWindow();
    if (!window.open) {
      return Response.json({ error: `The global review window is closed. It opens daily at ${window.peak_hour_utc}:00 UTC for ${window.window_hours}h (next: ${window.next_open_iso}).`, window_open: false }, { status: 403 });
    }

    if (action === "reject") {
      const ok = await rejectEligibleExperiment(String(experiment_id));
      if (!ok) return Response.json({ error: "Eligible change not found." }, { status: 404 });
      await logAiAction({ agent: "human", action: "global_reject", target: String(experiment_id), status: "reverted", summary: `Human rejected a change from going global` }).catch(() => null);
      return Response.json({ ok: true, applied: false });
    }

    const ok = await promoteExperimentGlobally(String(experiment_id));
    if (!ok) return Response.json({ error: "Eligible change not found." }, { status: 404 });
    await db.create("AdminAuditLog", { actor_email: user.email, actor_id: user.id, action_type: "ai_global_promote", target: String(experiment_id), timestamp: new Date().toISOString() }, user.id).catch(() => null);
    await logAiAction({ agent: "human", action: "global_promote", target: String(experiment_id), status: "applied", summary: `Human promoted an individually-approved change to GLOBAL` }).catch(() => null);
    return Response.json({ ok: true, applied: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
