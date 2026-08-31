import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { advanceEnabled, advanceRecoupPct } from "../../sdk/advance.ts";

// advanceStatus — read-only: the signed-in member's current advance (amount, outstanding, recouped, forgiven)
// and their recoupment track record. Moves nothing.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const u = user as Record<string, unknown>;

    const active = await db.filter("Advance", { member_id: String(u.id), status: "outstanding" }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
    const a = active?.[0] || null;

    return Response.json({
      ok: true, enabled: advanceEnabled(),
      outstanding_usd: Math.max(0, Number(u.advance_outstanding_usd) || 0),
      recoup_pct: advanceRecoupPct(),
      advances_repaid: Math.max(0, Number(u.advances_repaid) || 0),
      active_advance: a ? { id: a.id, amount_usd: a.amount_usd, outstanding_usd: a.outstanding_usd, recouped_usd: a.recouped_usd, granted_at: a.granted_at } : null,
      note: "Free, non-recourse — recouped only from future rewards; any shortfall is forgiven. Never a debt.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
