import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { saveToGetConfig, activeGoals, goalView } from "../../sdk/save-to-get.ts";

// saveToGetCreate (auth) — start a savings goal for an item. Creates the goal only; no money moves until the
// user contributes. Optionally set auto_pct (share of new earnings to auto-route here; 0 = off).
//   Body: { item_name, item_price_usd, auto_pct?, product_ref? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await saveToGetConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ error: "Save-to-Get is not available." }, { status: 400 });

    const uid = String(user.id);
    const existing = (await activeGoals(uid)).filter((g) => ["active", "funded"].includes(String(g.status || "active")));
    if (existing.length >= cfg.maxGoals) return Response.json({ error: `You already have the maximum of ${cfg.maxGoals} savings goals.` }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const price = Math.round((Number(body.item_price_usd) || 0) * 100) / 100;
    const name = String(body.item_name || "").trim().slice(0, 200);
    if (!name) return Response.json({ error: "Give the item a name." }, { status: 400 });
    if (price < cfg.minPriceUsd) return Response.json({ error: `Item price must be at least $${cfg.minPriceUsd}.` }, { status: 400 });
    const auto = Math.min(1, Math.max(0, Number(body.auto_pct) || 0));

    const row = await db.create("SaveToGetGoal", {
      user_id: uid, item_name: name, item_price_usd: price, saved_usd: 0,
      auto_pct: auto, status: "active", product_ref: String(body.product_ref || "").slice(0, 200),
      created_at: new Date().toISOString(),
    }, uid);
    return Response.json({ success: true, goal: goalView(row as Record<string, unknown>) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
