import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { approvalsEnabled, canApproveDomain, isApprover } from "../../sdk/approvals.ts";

// approvalDecide — a human approves or rejects one AI-prepared output from a phone (or the web app). Authorizes
// the caller for THAT item's domain (admin → any; scoped approver → only their domains, so a teammate can clear
// content without touching payouts), records WHO approved (audit), and writes the decision — which is also the
// training signal the autonomy kernel uses to graduate a domain. Mirrors autonomyApprove but opens it to
// delegated approvers with per-domain scope. Money/identity/legal stay gated to whoever you explicitly grant.
export default __handler(async (req) => {
  try {
    if (!approvalsEnabled()) return Response.json({ error: "Approvals are disabled." }, { status: 403 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!isApprover(user)) return Response.json({ error: "Forbidden — you are not an approver." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.decision_id ?? "");
    const action = String(body.action ?? "").toLowerCase();
    if (!id) return Response.json({ error: "decision_id is required." }, { status: 400 });
    if (action !== "approve" && action !== "reject") return Response.json({ error: "action must be 'approve' or 'reject'." }, { status: 400 });

    const target = await db.get("AutonomyDecision", id).catch(() => null);
    if (!target) return Response.json({ error: "Decision not found." }, { status: 404 });
    if (String((target as any).stage) !== "awaiting_approval") return Response.json({ error: `Already ${(target as any).stage}.` }, { status: 409 });

    const domain = String((target as any).domain ?? "");
    if (!canApproveDomain(user, domain)) return Response.json({ error: `Forbidden — your approver scope does not cover "${domain}".` }, { status: 403 });

    await db.update("AutonomyDecision", id, {
      stage: action === "approve" ? "approved" : "cancelled",
      decided: action === "approve" ? "approved" : "rejected",
      tweaked: action === "approve" ? body.tweaked === true : false,
      approved_by: String(user.id), approved_by_email: String(user.email ?? ""),
      decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({ ok: true, decision_id: id, domain, decided: action === "approve" ? "approved" : "rejected", by: user.email });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
