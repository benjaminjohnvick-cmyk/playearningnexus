import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// autonomyApprove — the generic human gate for any domain's pending decision (money/legal decisions that
// never auto, plus auto_ok domains that haven't earned autonomy yet). approve (optionally 'tweaked') or
// reject. The decision is the training signal the kernel uses to graduate a domain to autonomy. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.decision_id ?? "");
    const action = String(body.action ?? "").toLowerCase();
    if (!id) return Response.json({ error: "decision_id is required." }, { status: 400 });
    if (action !== "approve" && action !== "reject") return Response.json({ error: "action must be 'approve' or 'reject'." }, { status: 400 });

    const row = await db.get("AutonomyDecision", id).catch(() => null) as Record<string, unknown> | null;
    if (!row) return Response.json({ error: "Decision not found." }, { status: 404 });
    if (String(row.stage) !== "awaiting_approval") return Response.json({ error: `Decision is not awaiting approval (stage: ${row.stage}).` }, { status: 409 });

    const now = new Date().toISOString();
    await db.update("AutonomyDecision", id, {
      stage: action === "approve" ? "approved" : "cancelled",
      decided: action === "approve" ? "approved" : "rejected",
      tweaked: action === "approve" ? body.tweaked === true : false,
      decided_by: user.id, decided_at: now, updated_at: now,
    }).catch(() => null);

    return Response.json({ ok: true, decision_id: id, domain: row.domain, decided: action === "approve" ? "approved" : "rejected" });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
