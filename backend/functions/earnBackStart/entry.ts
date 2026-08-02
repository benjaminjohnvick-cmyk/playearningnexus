import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { primeSettings } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { minutesToOwn } from "../../sdk/earn-rate.ts";
import { earnBackEnabled, earnBackMaxItemPct, monthKey, dayKey } from "../../sdk/earn-back.ts";

// earnBackStart (authenticated) — begin a Prepay & Earn-Back plan on ONE item. The member has PREPAID the
// item plus a "portion" equal to the discount they choose to earn back; this records the plan they then
// earn down by completing surveys. It's a closed-loop REBATE (paid first, no credit, no default) and the
// ownership % is a non-tradeable progress label — never a sold/traded stake.
//   Body: { listing_id?, price_usd?, item_title?, chosen_pct }  → { plan_id, chosen_pct, minutes_required, ... }
export default __handler(async (req) => {
  try {
    await primeSettings();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!earnBackEnabled()) return Response.json({ error: "Earn-back plans are turned off." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    let priceUsd = Number(body.price_usd) || 0;
    let title = String(body.item_title || "");
    if (!priceUsd && body.listing_id) {
      const l = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: body.listing_id }).then((r: any) => r[0]).catch(() => null);
      priceUsd = Number(l?.price_usd) || 0;
      title = String(l?.title || title);
    }
    if (priceUsd <= 0) return Response.json({ error: "No priced item to plan" }, { status: 400 });

    // Clamp the requested discount to the per-item cap (both tiers). Members pick a percentage, never dollars.
    const maxPct = earnBackMaxItemPct();
    const chosenPct = Math.min(maxPct, Math.max(0, Number(body.chosen_pct) || 0));
    if (chosenPct <= 0) return Response.json({ error: `Pick a discount between 1% and ${maxPct}%.` }, { status: 400 });

    const premium = await isPremiumUser(user.id);
    const step = minutesToOwn({ priceUsd, ownershipPct: chosenPct, isPremium: premium });
    const discountTargetUsd = step.usd_needed;          // = the "portion" they prepaid and now earn back

    // One active plan per member per item: don't duplicate.
    const existing = await db.filter("EarnBackPlan", { user_id: user.id, item_title: title, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if ((existing || []).length && title) {
      return Response.json({ error: "You already have an active plan for this item.", plan_id: existing[0].id }, { status: 409 });
    }

    const now = new Date();
    const plan = await db.create("EarnBackPlan", {
      user_id: user.id,
      item_title: title,
      item_price_usd: Math.round(priceUsd * 100) / 100,
      chosen_pct: chosenPct,
      discount_target_usd: discountTargetUsd,
      portion_prepaid_usd: discountTargetUsd,     // charged upfront alongside the item; earned back over time
      earned_usd: 0,
      earned_this_month_usd: 0,
      minutes_required: step.minutes,
      minutes_done: 0,
      ownership_pct: 0,
      is_premium: premium,
      tier: premium ? "premium" : "nonpremium",
      status: "active",
      month: monthKey(now),
      grace_used: 0,
      last_active_day: dayKey(now),               // starting counts as active today
      created_at: now.toISOString(),
    }, user.id);

    return Response.json({
      plan_id: plan.id,
      chosen_pct: chosenPct,
      max_discount_pct: maxPct,
      discount_target_usd: discountTargetUsd,
      minutes_required: step.minutes,
      days_at_cap: step.days_at_cap,
      is_premium: premium,
      note: "You'll earn this discount back as Site Cash by completing surveys. Site Cash spends only on this site — it's never withdrawable, sold, or traded.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
