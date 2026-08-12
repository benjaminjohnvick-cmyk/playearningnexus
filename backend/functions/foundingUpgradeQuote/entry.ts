import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { rolloverState, upgradeQuote } from "../../sdk/founding-rollover.ts";

// foundingUpgradeQuote (read-only) — a QUOTE for the upgrade with the founding rollover credit applied.
// Body: { apply_usd?: number }  (defaults to all available credit)
// Returns the upgrade name, list price, credit applied, and NET price. NEVER a charge — actual payment for
// a $200,000 upgrade must go through the payment processor under its own flow; this only prices it.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);
    const todayISO = new Date().toISOString();
    const body = await req.json().catch(() => ({}));
    const applyReq = (body as Record<string, unknown>).apply_usd;

    const recRows = await db.filter("FoundingAdvertiser", { user_id: uid }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = recRows && recRows[0] ? recRows[0] : null;
    const purchasedISO = String((rec?.purchased_at ?? rec?.credit_start ?? rec?.created_date ?? todayISO));
    const appliedUsd = Number(rec?.rollover_credit_applied_usd) || 0;

    const roll = rolloverState(purchasedISO, todayISO, appliedUsd);
    const quote = upgradeQuote(roll, applyReq == null ? undefined : Number(applyReq));
    return Response.json({ rollover: roll, upgrade_quote: quote });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
