import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { DOMAINS } from "../../sdk/autonomy-kernel.ts";

// approverSet (admin) — grant or revoke a person's mobile-approval rights, scoped. Body:
//   { email, is_approver: true|false, domains: ["content","payout","all", ...] }
// Domains may be autonomy domain ids, groups ("content","revenue","ops","money","identity","risk"), or "all".
// Stored on the User row (no new table). This is how you let a teammate approve on their own phone — and how
// you keep money/identity/legal scoped to exactly who you choose.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me || me.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) return Response.json({ error: "email is required." }, { status: 400 });
    const isApprover = body.is_approver !== false; // default grant
    const validGroups = new Set(["all", ...DOMAINS.map((d) => d.group), ...DOMAINS.map((d) => d.id)]);
    const domains = Array.isArray(body.domains) ? [...new Set(body.domains.map((d: unknown) => String(d)).filter((d: string) => validGroups.has(d)))] : [];

    const matches = await db.filter("User", { email }, "-created_date", 2).catch(() => []);
    const target = (matches || [])[0] as any;
    if (!target) return Response.json({ error: `No user found with email ${email}.` }, { status: 404 });

    await base44.asServiceRole.auth.updateUser(String(target.id), {
      is_approver: isApprover,
      approver_domains: isApprover ? (domains.length ? domains : ["all"]) : [],
      approver_updated_at: new Date().toISOString(),
      approver_updated_by: String(me.email ?? me.id),
    }).catch(async () => {
      // fallback to a direct data update if updateUser is unavailable
      await db.update("User", String(target.id), { is_approver: isApprover, approver_domains: isApprover ? (domains.length ? domains : ["all"]) : [] }).catch(() => null);
    });

    return Response.json({ ok: true, email, is_approver: isApprover, approver_domains: isApprover ? (domains.length ? domains : ["all"]) : [] });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
