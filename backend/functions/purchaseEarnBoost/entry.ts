import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordRevenue } from "../../sdk/revenue.ts";
import { earnBoostEnabled, earnBoostHours, earnBoostPriceUsd, activeBoostMultiplier } from "../../sdk/boosts.ts";
import { applySinkReward } from "../../sdk/sink-rewards.ts";

// purchaseEarnBoost (authenticated) — buy a TIME-LIMITED Site-Cash earn multiplier with Site Cash. Deterministic
// (fixed step, fixed window, known price — NOT a random/paid draw, not a loot box, not gambling). The purchase is
// a closed-loop Site-Cash SINK (booked as `breakage`); the boost only ever scales NON-CASHABLE Site-Cash earnings.
// This is the RECURRING sink: each repurchase STACKS the multiplier a step (2× → 2.5× → 3× …, capped) and refreshes
// the window, so buying again is what keeps the boost up — which keeps Site Cash draining. Regular buyers also get
// the loyalty top-off. Atomic debit; refund if nothing could be granted.  {} → { ok, multiplier, ... } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!earnBoostEnabled()) return Response.json({ error: "Earn boosts aren't available right now." }, { status: 403 });

    const uid = String(user.id);
    const price = earnBoostPriceUsd();
    const hours = earnBoostHours();

    // ATOMIC debit. Null = insufficient funds (no floor) or contention.
    const newBalance = price > 0 ? await adjustUserBalance(uid, -price, { field: "current_balance" }) : (Number((user as Record<string, unknown>).current_balance) || 0);
    if (newBalance === null) {
      const bal = Math.max(0, Number((user as Record<string, unknown>).current_balance) || 0);
      return Response.json({ error: `Not enough Site Cash. A boost costs $${price.toFixed(2)} and you have $${bal.toFixed(2)}.` }, { status: 402 });
    }

    // Stack the boost (create at base, or +step up to the cap) and grant the loyalty top-off. This IS the boost
    // grant for a paid boost purchase, so we read back the resulting multiplier for the response.
    const reward = await applySinkReward(uid, price, `earn_boost`).catch(() => null);
    const multiplier = reward?.boost_multiplier ?? await activeBoostMultiplier(uid).catch(() => 1);

    if (!reward) {
      // Reward path failed entirely (couldn't grant a boost) — refund so the user isn't charged for nothing.
      if (price > 0) await adjustUserBalance(uid, price, { field: "current_balance" }).catch(() => null);
      return Response.json({ error: "Couldn't activate the boost — you were not charged." }, { status: 500 });
    }

    if (price > 0) await recordRevenue({ type: "breakage", amount_usd: price, user_id: uid, ref: `earn_boost`, meta: { source: "earn_boost", multiplier, hours } }).catch(() => null);

    const expires = new Date(Date.now() + hours * 3_600_000).toISOString();
    return Response.json({
      ok: true, multiplier, hours, expires_at: expires,
      topoff_usd: reward.topoff_usd ?? 0,
      new_balance_usd: Math.round((Number(newBalance) || 0) * 100) / 100,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
