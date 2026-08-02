import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { pointValueUsd } from "../../sdk/revenue.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { maxPointsPerTransaction } from "../../sdk/redemption.ts";
import { earnRateUsdPerMin, earnDailyCapUsd, ownershipPctFromCash, ownershipTable, usdForOwnership } from "../../sdk/earn-rate.ts";

// itemOwnershipPlan (authenticated) — the "how many minutes of surveys to own this?" calculator.
// Given an item (listing_id or price_usd), returns: the user's CURRENT ownership % from their earned
// Site Cash, the minutes/days to reach each ownership milestone at their tier's earn rate, and how much
// they could apply RIGHT NOW as a cash discount (spend-cap limited). Read-only. Site Cash never leaves
// the platform — ownership only becomes a discount or a fully-covered item.
//   Body: { listing_id }  or  { price_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let priceUsd = Number(body.price_usd) || 0;
    let title = String(body.title || "");
    if (!priceUsd && body.listing_id) {
      const l = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: body.listing_id }).then((r: any) => r[0]);
      priceUsd = Number(l?.price_usd) || 0;
      title = String(l?.title || title);
    }
    if (priceUsd <= 0) return Response.json({ error: "No priced item to plan" }, { status: 400 });

    const pointUsd = pointValueUsd();
    const points = Number(user.points) || 0;
    const cashUsd = Math.round(points * pointUsd * 100) / 100;
    const premium = await isPremiumUser(user.id);

    const currentPct = Math.round(ownershipPctFromCash(priceUsd, cashUsd) * 100) / 100;
    const table = ownershipTable({ priceUsd, isPremium: premium });

    // What they can apply as a cash discount on this item right now (spend cap × balance, not exceeding price).
    const cap = maxPointsPerTransaction({ isPremium: premium, userPoints: points });
    const capUsd = Math.round(cap.points * pointUsd * 100) / 100;
    const discountNowUsd = Math.min(capUsd, priceUsd, cashUsd);
    const coveredFully = cashUsd >= priceUsd;

    return Response.json({
      title,
      price_usd: Math.round(priceUsd * 100) / 100,
      site_cash_usd: cashUsd,
      is_premium: premium,
      earn_rate_usd_per_min: earnRateUsdPerMin(premium),
      daily_cap_usd: earnDailyCapUsd(premium),
      current_ownership_pct: currentPct,
      covered_fully: coveredFully,
      usd_to_full: Math.max(0, Math.round((usdForOwnership(priceUsd, 100) - cashUsd) * 100) / 100),
      // biggest cash discount applicable this transaction (respects the 12%/24% spend cap)
      discount_now_usd: discountNowUsd,
      spend_cap_pct: cap.capPct,
      // minutes/days to reach 1%,5%,10%,25%,50%,75%,100%
      ownership_table: table,
      note: "Site Cash spends only on this site and is never withdrawable to a bank, card, or Cash App.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
