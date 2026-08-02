import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { primeSettings } from "../../sdk/settings.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { pointValueUsd } from "../../sdk/revenue.ts";
import { unearnedPortionUsd } from "../../sdk/earn-back.ts";

// earnBackAbandon (authenticated) — the member abandons an item mid-plan. The unearned portion they prepaid
// converts to non-expiring Site Cash (closed-loop, spendable on-site), NOT a refund to a card and NOT
// forfeited. Discount already earned stays earned. Site Cash issued here is non-expiring by policy (stored
// value — see PREPAY-EARNBACK-DISCOUNT.md; keep the non-expiry + disclosure under compliance sign-off).
//   Body: { plan_id }  → { converted_site_cash_usd, points_credited }
export default __handler(async (req) => {
  try {
    await primeSettings();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const plan = await db.get("EarnBackPlan", String(body.plan_id || "")).catch(() => null) as Record<string, unknown> | null;
    if (!plan) return Response.json({ error: "Plan not found." }, { status: 404 });
    if (plan.user_id !== user.id) return Response.json({ error: "Not your plan." }, { status: 403 });
    if (plan.status !== "active") return Response.json({ error: "This plan isn't active." }, { status: 409 });

    const unearned = unearnedPortionUsd(plan as { portion_prepaid_usd?: number; earned_usd?: number });
    const points = unearned > 0 ? Math.round(unearned / pointValueUsd()) : 0;
    if (points > 0) await adjustUserBalance(user.id, points, { field: "points" });

    await db.update("EarnBackPlan", plan.id as string, {
      status: "abandoned",
      abandoned_at: new Date().toISOString(),
      converted_site_cash_usd: unearned,
    });

    return Response.json({
      ok: true,
      converted_site_cash_usd: unearned,
      points_credited: points,
      note: "The part of your prepayment you hadn't yet earned back is now Site Cash — it doesn't expire and spends only on this site. It's never withdrawn to a bank or card.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
