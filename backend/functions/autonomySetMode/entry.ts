import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { domainById, isPermanentGate } from "../../sdk/autonomy-kernel.ts";

// autonomySetMode — set a domain's autonomy mode (manual | earned | full) from the Command Center. A
// permanent-gate domain (money / identity / legal / risk) cannot be changed — it stays human-gated by design.
// Raising a domain to "full" is an owner decision; "billing_change" and anything with public/legal exposure
// should have counsel sign-off first. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const domainId = String(body.domain_id ?? "");
    const mode = String(body.mode ?? "").trim().toLowerCase();
    if (!domainById(domainId)) return Response.json({ error: "Unknown domain." }, { status: 400 });
    if (isPermanentGate(domainId)) return Response.json({ error: "This domain is a permanent human/counsel gate (money, identity, legal or risk) and cannot be automated." }, { status: 403 });
    if (mode !== "manual" && mode !== "earned" && mode !== "full") return Response.json({ error: "mode must be 'manual', 'earned', or 'full'." }, { status: 400 });

    const now = new Date().toISOString();
    await db.create("AutonomyDomain", { domain_id: domainId, mode, set_by: user.id, created_at: now }).catch(() => null);
    return Response.json({ ok: true, domain_id: domainId, mode });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
