import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { giftingEnabled, giftFeePct, giftMinUsd, giftMaxUsd, splitGift } from "../../sdk/gifting.ts";
import { earnBoostEnabled, earnBoostMultiplier, earnBoostHours, earnBoostPriceUsd, activeBoostMultiplier } from "../../sdk/boosts.ts";

// siteCashPerksStatus (authenticated) — powers the closed-loop "Site-Cash extras" page: current balance, the
// gifting config (fee/min/max + a sample split), and the earn-boost config + whether one is active now. Read-only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const uid = String(user.id);
    const balance_usd = Math.max(0, Number((user as Record<string, unknown>).current_balance) || 0);

    const activeMult = await activeBoostMultiplier(uid);
    let boost_active_until: string | null = null;
    if (activeMult > 1) {
      const rows = await db.filter("EarnBoost", { user_id: uid }, "-created_date", 5).catch(() => []) as Record<string, unknown>[];
      const now = Date.now();
      for (const r of rows || []) { const exp = Date.parse(String(r.expires_at || "")) || 0; if (exp > now) { boost_active_until = String(r.expires_at); break; } }
    }

    return Response.json({
      balance_usd,
      gifting: {
        enabled: giftingEnabled(), fee_pct: giftFeePct(), min_usd: giftMinUsd(), max_usd: giftMaxUsd(),
        sample: splitGift(10), // illustrative: what a $10 gift becomes
      },
      earn_boost: {
        enabled: earnBoostEnabled(), multiplier: earnBoostMultiplier(), hours: earnBoostHours(),
        price_usd: earnBoostPriceUsd(), active: activeMult > 1, active_multiplier: activeMult, active_until: boost_active_until,
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
