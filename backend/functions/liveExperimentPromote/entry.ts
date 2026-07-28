import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { promoteExperiment, revertExperiment } from "../../sdk/live-experiments.ts";

// liveExperimentPromote (INTERNAL/ADMIN) — manual override to promote or revert a running live
// experiment immediately (no downtime — a config flip). Use to force a decision or pull a change.
// Body: { id, action: "promote"|"revert", reason? }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "");
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const exp = await db.get("LiveExperiment", id).catch(() => null);
    if (!exp) return Response.json({ error: "Experiment not found" }, { status: 404 });
    const reason = String(body?.reason || "manual admin decision");

    if (body?.action === "revert") { await revertExperiment(exp, reason); return Response.json({ success: true, action: "reverted" }); }
    await promoteExperiment(exp, reason);
    return Response.json({ success: true, action: "promoted" });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
