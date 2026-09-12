import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// approverList (admin) — who currently has mobile-approval rights and for which domains/groups. Backs the
// "manage approvers" section of the Approvals page.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me || me.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const [admins, approvers] = await Promise.all([
      db.filter("User", { role: "admin" }, "-created_date", 200).catch(() => []),
      db.filter("User", { is_approver: true }, "-created_date", 500).catch(() => []),
    ]);
    const adminList = (admins || []).map((u: any) => ({ email: String(u.email ?? ""), scope: ["all"], role: "admin" }));
    const approverListRows = (approvers || []).map((u: any) => ({
      email: String(u.email ?? ""),
      scope: Array.isArray(u.approver_domains) && u.approver_domains.length ? u.approver_domains.map(String) : ["all"],
      role: "approver",
      updated_by: String(u.approver_updated_by ?? ""),
    }));
    return Response.json({ ok: true, admins: adminList, approvers: approverListRows });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
