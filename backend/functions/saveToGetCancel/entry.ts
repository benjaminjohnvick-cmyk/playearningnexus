import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { saveToGetConfig, goalView, SPENDABLE_FIELD } from "../../sdk/save-to-get.ts";

// saveToGetCancel (auth) — cancel a goal and move its reserved savings BACK to spendable. Proves nothing is
// locked: the user reclaims every cent, no penalty, no balance owed.
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
    if (["claimed", "canceled"].includes(String(g.status))) return Response.json({ error: "That goal is already closed." }, { status: 400 });

    const saved = Math.max(0, Number(g.saved_usd) || 0);
    if (saved > 0) await adjustUserBalance(uid, saved, { field: SPENDABLE_FIELD });
    await db.update("SaveToGetGoal", String(body.goal_id), { saved_usd: 0, status: "canceled", canceled_at: new Date().toISOString() }, uid);
    const updated = { ...g, saved_usd: 0, status: "canceled" };
    return Response.json({ success: true, goal: goalView(updated), refunded_usd: Math.round(saved * 100) / 100, note: `Canceled. $${saved.toLocaleString()} moved back to your spendable balance — it was your money the whole time.` });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
