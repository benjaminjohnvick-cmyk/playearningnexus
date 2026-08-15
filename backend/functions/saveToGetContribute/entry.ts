import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { saveToGetConfig, goalView, SPENDABLE_FIELD } from "../../sdk/save-to-get.ts";

// saveToGetContribute (auth) — move a chosen amount of the user's OWN spendable Site Cash into a goal's
// reservation. Optionally update the goal's auto_pct too. Nothing owed; reversible via cancel.
//   Body: { goal_id, amount_usd, auto_pct? }
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
    if (["claimed", "canceled"].includes(String((goal as Record<string, unknown>).status))) return Response.json({ error: "That goal is closed." }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (body.auto_pct !== undefined) patch.auto_pct = Math.min(1, Math.max(0, Number(body.auto_pct) || 0));

    const amount = Math.round((Number(body.amount_usd) || 0) * 100) / 100;
    if (amount > 0) {
      const price = Math.max(0, Number((goal as Record<string, unknown>).item_price_usd) || 0);
      const saved = Math.max(0, Number((goal as Record<string, unknown>).saved_usd) || 0);
      const room = Math.max(0, price - saved);
      const put = Math.min(amount, room);
      if (put <= 0) return Response.json({ error: "This goal is already fully funded." }, { status: 400 });
      const debited = await adjustUserBalance(uid, -put, { field: SPENDABLE_FIELD });
      if (debited === null) return Response.json({ error: "Not enough spendable Site Cash for that amount." }, { status: 400 });
      patch.saved_usd = Math.round((saved + put) * 100) / 100;
      patch.status = patch.saved_usd >= price ? "funded" : "active";
    }
    if (Object.keys(patch).length === 0) return Response.json({ error: "Nothing to do — pass an amount or an auto_pct." }, { status: 400 });

    await db.update("SaveToGetGoal", String(body.goal_id), patch, uid);
    const updated = await db.get("SaveToGetGoal", String(body.goal_id)).catch(() => ({ ...(goal as Record<string, unknown>), ...patch }));
    return Response.json({ success: true, goal: goalView(updated as Record<string, unknown>), note: "Saved toward your item — still your money, move it back anytime." });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
