import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordRevenue } from "../../sdk/revenue.ts";
import { earnBoostEnabled, earnBoostMultiplier, earnBoostHours, earnBoostPriceUsd, activeBoostMultiplier } from "../../sdk/boosts.ts";

// purchaseEarnBoost (authenticated) — buy a TIME-LIMITED Site-Cash earn multiplier with Site Cash. Deterministic
// (fixed multiplier, fixed window, known price — NOT a random/paid draw, not a loot box, not gambling). The
// purchase is a closed-loop Site-Cash SINK (booked as `breakage`); the boost only ever scales NON-CASHABLE
// Site-Cash earnings. Refuses if a boost is already active (no stacking). Atomic debit; refund if the grant fails.
//   {} → { ok, expires_at, multiplier } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!earnBoostEnabled()) return Response.json({ error: "Earn boosts aren't available right now." }, { status: 403 });

    const uid = String(user.id);
    // No stacking: if a boost is already active, tell them when it ends instead of charging again.
    if (await activeBoostMultiplier(uid) > 1) {
      return Response.json({ error: "You already have an active earn boost. Wait for it to finish before buying another." }, { status: 409 });
    }

    const price = earnBoostPriceUsd();
    const mult = earnBoostMultiplier();
    const hours = earnBoostHours();

    // ATOMIC debit. Null = insufficient funds (no floor) or contention.
    const newBalance = price > 0 ? await adjustUserBalance(uid, -price, { field: "current_balance" }) : (Number((user as Record<string, unknown>).current_balance) || 0);
    if (newBalance === null) {
      const bal = Math.max(0, Number((user as Record<string, unknown>).current_balance) || 0);
      return Response.json({ error: `Not enough Site Cash. A boost costs $${price.toFixed(2)} and you have $${bal.toFixed(2)}.` }, { status: 402 });
    }

    const now = new Date();
    const expires = new Date(now.getTime() + hours * 3_600_000);
    let boost: Record<string, unknown> | null = null;
    try {
      boost = await db.create("EarnBoost", {
        user_id: uid, multiplier: mult, hours, price_usd: price,
        activated_at: now.toISOString(), expires_at: expires.toISOString(),
      });
    } catch (_e) {
      if (price > 0) await adjustUserBalance(uid, price, { field: "current_balance" }).catch(() => null);
      return Response.json({ error: "Couldn't activate the boost — you were not charged." }, { status: 500 });
    }

    if (price > 0) await recordRevenue({ type: "breakage", amount_usd: price, user_id: uid, ref: `earn_boost:${(boost as Record<string, unknown>)?.id ?? ""}`, meta: { source: "earn_boost", multiplier: mult, hours } }).catch(() => null);

    return Response.json({
      ok: true, multiplier: mult, hours, expires_at: expires.toISOString(),
      new_balance_usd: Math.round((Number(newBalance) || 0) * 100) / 100,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
