import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordRevenue } from "../../sdk/revenue.ts";
import { cosmeticsEnabled, defaultByKey, normalizeCosmetic } from "../../sdk/cosmetics.ts";
import { applySinkReward } from "../../sdk/sink-rewards.ts";

// purchaseCosmetic (authenticated) — buy a closed-loop cosmetic with non-cashable Site Cash (current_balance,
// USD store credit). NO real-money purchase, NO cash value, non-tradeable — a pure Site-Cash SINK, so it stays
// inside the closed-loop / non-money-transmission model. The debit is ATOMIC (adjustUserBalance → db.updateIf
// compare-and-set), so it can't be double-spent, and it FAILS on insufficient funds (never floors to 0). The
// recaptured store-credit liability is booked as `breakage` revenue. Owning an item is permanent and one-per-user.
//   { cosmetic_key } → { ok, owned, new_balance_usd } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!cosmeticsEnabled()) return Response.json({ error: "The cosmetics store is not available right now." }, { status: 403 });

    const { cosmetic_key } = await req.json().catch(() => ({}));
    const key = String(cosmetic_key || "").trim();
    if (!key) return Response.json({ error: "cosmetic_key required" }, { status: 400 });

    // Resolve the item: an admin-curated CosmeticItem row wins over the starter default.
    const curated = await db.filter("CosmeticItem", { key }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const def = curated && curated[0] ? normalizeCosmetic(curated[0]) : (defaultByKey(key) ? normalizeCosmetic(defaultByKey(key)) : null);
    if (!def || def.active === false) return Response.json({ error: "That cosmetic isn't available." }, { status: 404 });

    const uid = String(user.id);
    const price = Math.max(0, Number(def.price_usd) || 0);

    // One-per-user: refuse a repeat purchase (also the fast-path before touching money).
    const already = await db.filter("UserCosmetic", { user_id: uid, cosmetic_key: key }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if (already && already[0]) return Response.json({ error: "You already own this cosmetic.", already: true }, { status: 409 });

    // ATOMIC debit of closed-loop Site Cash. Returns null on insufficient funds (no floorZero) or contention.
    const newBalance = price > 0 ? await adjustUserBalance(uid, -price, { field: "current_balance" }) : (Number((user as Record<string, unknown>).current_balance) || 0);
    if (newBalance === null) {
      const bal = Math.max(0, Number((user as Record<string, unknown>).current_balance) || 0);
      return Response.json({ error: `Not enough Site Cash. This item costs $${price.toFixed(2)} and you have $${bal.toFixed(2)}.` }, { status: 402 });
    }

    // Grant ownership. If the grant write fails, refund the debit so the buyer is never charged for nothing.
    let grant: Record<string, unknown> | null = null;
    try {
      grant = await db.create("UserCosmetic", {
        user_id: uid, cosmetic_key: key, cosmetic_type: def.type, name: def.name, price_usd: price,
        rarity: def.rarity, equipped: false, purchased_at: new Date().toISOString(),
      });
    } catch (_e) {
      if (price > 0) await adjustUserBalance(uid, price, { field: "current_balance" }).catch(() => null);
      return Response.json({ error: "Couldn't complete the purchase — you were not charged." }, { status: 500 });
    }

    // Book the recaptured closed-loop liability as breakage revenue (never a customer markup).
    if (price > 0) {
      await recordRevenue({
        type: "breakage", amount_usd: price, user_id: uid, ref: `cosmetic:${key}`,
        meta: { source: "cosmetics_store", cosmetic_key: key, cosmetic_type: def.type, rarity: def.rarity },
      }).catch(() => null);
    }

    // Sink-purchase rewards: stack the earn boost + (regular users) grant the loyalty top-off. Best-effort.
    const reward = await applySinkReward(uid, price, `cosmetic:${key}`).catch(() => null);

    return Response.json({
      ok: true, owned: key, cosmetic_type: def.type,
      new_balance_usd: Math.round((Number(newBalance) || 0) * 100) / 100,
      grant_id: (grant as Record<string, unknown>)?.id ?? null,
      boost_multiplier: reward?.boost_multiplier ?? null,
      topoff_usd: reward?.topoff_usd ?? 0,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
