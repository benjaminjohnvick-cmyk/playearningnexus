import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { giftBoostConfig, sentTodayCount, giftBoostDisclosures } from "../../sdk/gift-boost.ts";

// giftBoostStatus (read) — config, how many boosts the caller can still send today, and recent boosts they
// sent or received. Read-only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await giftBoostConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ enabled: false });
    const uid = String(user.id);
    const sentToday = await sentTodayCount(uid);
    let sent: Record<string, unknown>[] = [], received: Record<string, unknown>[] = [];
    try { sent = await db.filter("GiftBoost", { sender_id: uid }, "-created_date", 10) || []; } catch { /* ignore */ }
    try { received = await db.filter("GiftBoost", { recipient_id: uid }, "-created_date", 10) || []; } catch { /* ignore */ }
    return Response.json({
      enabled: true,
      config: { max_usd: cfg.maxUsd, daily_cap: cfg.dailyCap, point_cost: cfg.pointCost, remaining_today: Math.max(0, cfg.dailyCap - sentToday) },
      sent: sent.map((r) => ({ amount_usd: r.amount_usd, at: r.created_at })),
      received: received.map((r) => ({ amount_usd: r.amount_usd, at: r.created_at })),
      disclosures: giftBoostDisclosures(cfg),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
