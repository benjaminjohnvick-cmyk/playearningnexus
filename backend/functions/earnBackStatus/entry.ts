import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { primeSettings } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import {
  earnBackEnabled, earnBackMaxItemPct, monthKey, dayKey, eligibility, graceDaysPerMonth,
  premiumHeadroomUsd, premiumPricing, unearnedPortionUsd,
} from "../../sdk/earn-back.ts";

// earnBackStatus (authenticated) — the member's earn-back dashboard: their active/recent plans as
// PERCENTAGES + survey minutes (no dollars lead), progress, grace days left, and whether earning is paused
// (missed too many days). Also returns the current premium price (founding vs sustainable) and, for premium,
// the remaining subsidy headroom this month. Read-only.
export default __handler(async (req) => {
  try {
    await primeSettings();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const premium = await isPremiumUser(user.id);
    const today = dayKey();
    const thisMonth = monthKey();

    const rows = await db.filter("EarnBackPlan", { user_id: user.id }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
    const plans = (rows || []).map((p) => {
      const activeToday = String(p.last_active_day || "") === today && p.status === "active";
      const graceUsed = p.month === thisMonth ? (Number(p.grace_used) || 0) : 0;
      const elig = eligibility({ activeToday, graceUsed });
      return {
        plan_id: p.id,
        item_title: p.item_title || "",
        chosen_pct: Number(p.chosen_pct) || 0,
        ownership_pct: Number(p.ownership_pct) || 0,
        minutes_required: Number(p.minutes_required) || 0,
        minutes_done: Number(p.minutes_done) || 0,
        status: p.status || "active",
        grace_left: elig.grace_left,
        grace_total: elig.grace_total,
        paused: p.status === "active" ? elig.paused : false,
        unearned_site_cash_on_quit: unearnedPortionUsd(p as { portion_prepaid_usd?: number; earned_usd?: number }),
      };
    });

    const pricing = premiumPricing({ memberJoinedFounding: premium });
    const headroom = premium ? await premiumHeadroomUsd(user.id, thisMonth) : null;

    return Response.json({
      enabled: earnBackEnabled(),
      is_premium: premium,
      max_discount_pct: earnBackMaxItemPct(),
      grace_days_per_month: graceDaysPerMonth(),
      active_today: plans.some((p) => p.status === "active" && String((rows.find((r) => r.id === p.plan_id) || {}).last_active_day || "") === today),
      premium_price_usd: pricing.price_usd,
      premium_founding: pricing.founding,
      premium_headroom_usd: headroom ? (Number.isFinite(headroom.allowed) ? headroom.allowed : null) : null,
      plans,
      note: "Earn-back is a discount on your own purchase, paid back to you as Site Cash. Site Cash spends only on this site — never withdrawable, sold, or traded.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
