import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { saveToGetConfig, goalView } from "../../sdk/save-to-get.ts";

// saveToGetClaim (auth) — claim an item once its goal is fully funded from the user's own savings. The
// reserved Site Cash (already moved out of spendable as they saved) is consumed and the item is marked
// claimed. Fulfillment (creating the actual order/entitlement) runs through the normal order flow — this
// records the claim and hands off; it never advances anything and never owes anything.
//   Body: { goal_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await saveToGetConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ error: "Save-to-Get is not available." }, { status: 400 });

    const uid = String(user.id);
    const body = await req.json().catch(() => ({}));
    const goal = await db.get("SaveToGetGoal", String(body.goal_id)).catch(() => null);
    if (!goal || String((goal as Record<string, unknown>).user_id) !== uid) return Response.json({ error: "Goal not found." }, { status: 404 });
    const g = goal as Record<string, unknown>;
    if (String(g.status) === "claimed") return Response.json({ error: "Already claimed." }, { status: 400 });
    const price = Math.max(0, Number(g.item_price_usd) || 0);
    const saved = Math.max(0, Number(g.saved_usd) || 0);
    if (saved < price) return Response.json({ error: `Not fully funded yet — $${Math.max(0, price - saved).toLocaleString()} left to save.` }, { status: 400 });

    await db.update("SaveToGetGoal", String(body.goal_id), { status: "claimed", claimed_at: new Date().toISOString() }, uid);
    // Fulfillment hand-off: create the order/entitlement in your normal flow using product_ref + item_name.
    return Response.json({
      success: true,
      goal: goalView({ ...g, status: "claimed" }),
      fulfill: { item_name: g.item_name, product_ref: g.product_ref ?? null, amount_usd: price },
      note: "Claimed from your savings. It'll be fulfilled through the normal order flow — you paid entirely with money you earned.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
