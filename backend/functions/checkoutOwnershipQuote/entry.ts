import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { ownershipSplit, earnRateUsdPerMin, buyerMaxDiscountPct } from "../../sdk/earn-rate.ts";

// checkoutOwnershipQuote (authenticated) — the percentage-first checkout. The user says how much they want
// to pay OUT OF POCKET for an item; we return the split as PERCENTAGES + survey minutes: how much they pay
// now vs how much they earn back as an ownership-% discount, and the minutes of surveys to earn it. This is
// a personal discount on the user's OWN purchase (closed-loop) — never a tradeable stake. Read-only.
//   Body: { listing_id?, price_usd?, out_of_pocket_usd }  → { out_of_pocket_pct, earn_back_pct, minutes, ... }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let priceUsd = Number(body.price_usd) || 0;
    if (!priceUsd && body.listing_id) {
      const l = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: body.listing_id }).then((r: any) => r[0]);
      priceUsd = Number(l?.price_usd) || 0;
    }
    if (priceUsd <= 0) return Response.json({ error: "No priced item to quote" }, { status: 400 });

    const premium = await isPremiumUser(user.id);
    const oop = Number(body.out_of_pocket_usd);
    // Default the slider to the minimum out-of-pocket (i.e. the biggest allowed earn-back) if none given.
    const outOfPocketUsd = Number.isFinite(oop) ? oop : priceUsd * (1 - buyerMaxDiscountPct() / 100);
    const split = ownershipSplit({ priceUsd, outOfPocketUsd, isPremium: premium });

    return Response.json({
      ...split,
      is_premium: premium,
      earn_rate_usd_per_min: earnRateUsdPerMin(premium),
      note: "Earned ownership is a discount on your own purchase — banked toward this item, never sold to anyone else.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
