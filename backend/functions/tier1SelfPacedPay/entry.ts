import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { tier1SelfPacedConfig, activeSelfPacedPlan, selfPacedStatus, assessSelfPacedPayment } from "../../sdk/tier1-selfpaced.ts";

// tier1SelfPacedPay (auth) — record a voluntary, buyer-chosen payment toward the Tier 1 Self-Paced package.
// The buyer picks the amount; benefits accrue in proportion to what they've now paid. NOTHING is owed.
// This does NOT move money — the actual charge for the chosen amount runs through the normal checkout
// processor; this only records the payment and returns the updated delivered service.
//   Body: { amount_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await tier1SelfPacedConfig(jurisdiction);
    if (!cfg.enabled) return Response.json({ error: "Self-paced Tier 1 is not available." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const check = assessSelfPacedPayment(Number(body.amount_usd), cfg);
    if (!check.ok) return Response.json({ error: check.reason }, { status: 400 });

    const uid = String(user.id);
    const existing = await activeSelfPacedPlan(uid);
    const nowIso = new Date().toISOString();
    const prevPaid = Math.max(0, Number(existing?.paid_to_date_usd) || 0);
    const prevCount = Math.max(0, Number(existing?.payments_made) || 0);
    const fields = {
      user_id: uid,
      status: "active",
      paid_to_date_usd: Math.round((prevPaid + check.amount_usd) * 100) / 100,
      payments_made: prevCount + 1,
      last_payment_usd: check.amount_usd,
      last_payment_at: nowIso,
      started_at: (existing?.started_at as string) || nowIso,
    };

    let planId: string | null = null;
    if (existing?.id) { await db.update("Tier1SelfPacedPlan", String(existing.id), fields, uid); planId = String(existing.id); }
    else { const row = await db.create("Tier1SelfPacedPlan", fields, uid); planId = (row as Record<string, unknown>)?.id as string ?? null; }

    const status = selfPacedStatus({ ...existing, ...fields }, cfg);
    return Response.json({
      success: true,
      plan_id: planId,
      charged_usd: check.amount_usd,          // amount to collect at checkout (processor handles the actual charge)
      status,
      note: `Recorded $${check.amount_usd.toLocaleString()}. You've now paid $${status.paid_to_date_usd.toLocaleString()} and owe nothing — pay more whenever you like, or stop with no balance.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
