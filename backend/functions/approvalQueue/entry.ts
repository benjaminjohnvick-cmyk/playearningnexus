import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { domainById } from "../../sdk/autonomy-kernel.ts";
import { approvalsEnabled, isApprover, approvableDomainIds } from "../../sdk/approvals.ts";

// approvalQueue — the mobile approvals inbox. Returns the AI-prepared outputs sitting in `awaiting_approval`
// that the CURRENT user is allowed to approve (admin → all; a scoped approver → only their domains). Designed
// for a phone: small, self-describing items with the AI's output payload inline. Any signed-in admin or
// designated approver can call it (Android/iOS app or the web PWA — same authenticated endpoint).
export default __handler(async (req) => {
  try {
    if (!approvalsEnabled()) return Response.json({ ok: true, enabled: false, items: [] });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!isApprover(user)) return Response.json({ error: "Forbidden — you are not an approver." }, { status: 403 });

    const allowed = new Set(approvableDomainIds(user));
    const rows = await db.filter("AutonomyDecision", { stage: "awaiting_approval" }, "-created_at", 200).catch(() => []);
    const items = (rows || [])
      .filter((r: any) => allowed.has(String(r.domain ?? "")))
      .map((r: any) => {
        const dom = domainById(String(r.domain ?? ""));
        return {
          decision_id: String(r.id ?? ""),
          domain: String(r.domain ?? ""),
          domain_label: dom?.label ?? String(r.domain ?? ""),
          permanent_gate: r.permanent_gate === true,
          group: dom?.group ?? "",
          mode: String(r.mode ?? ""),
          reason: String(r.reason ?? ""),
          subject_id: r.subject_id ? String(r.subject_id) : null,
          output: r.proposal ?? null,
          at: String(r.created_at ?? r.created_date ?? ""),
        };
      });
    return Response.json({ ok: true, enabled: true, count: items.length, items, can_approve_domains: [...allowed] });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
