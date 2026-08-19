import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { foundingPriceUsd } from "../../sdk/founding-advertiser.ts";
import { tier2TotalUsd } from "../../sdk/tier2-scaling.ts";
import { billingScheduleStatus, annualPrepayAmount, billingAnnualPrepayEnabled, type BillingTier } from "../../sdk/billing-schedule.ts";

// billingScheduleStatus (auth, read-only) — the caller's advertiser billing picture: the full 52 weeks they
// PREPAID up front, and how it's tracked across 13 four-week cycles (which cycle they're in, how much of the
// prepay has been recognized). Works for Tier 1 / Tier 2 / Tier 3 Unlimited. Records/moves no money.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!billingAnnualPrepayEnabled()) return Response.json({ enabled: false, reason: "annual prepay billing disabled" });

    const uid = String(user.id);
    // A Tier 2 / Tier 3 plan takes precedence (it also holds a founding seat); else the Tier 1 founding seat.
    const plans = await db.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    let tier: BillingTier; let annual: number; let termStart: string;

    if (plans && plans[0]) {
      const p = plans[0];
      const budget = Number(p.budget_usd) || 0;
      if (budget > 0) { tier = "tier3"; annual = annualPrepayAmount("tier3", { budgetUsd: budget }); }
      else { tier = "tier2"; annual = annualPrepayAmount("tier2"); }
      termStart = String(p.started_at ?? p.current_year_started_at ?? p.created_date ?? "");
    } else {
      const seats = await db.filter("FoundingAdvertiser", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      if (!seats || !seats[0]) return Response.json({ enabled: true, has_plan: false, note: "No active advertiser package found for this account." });
      const s = seats[0];
      tier = "tier1";
      annual = Number(s.price_usd) > 0 ? Number(s.price_usd) : foundingPriceUsd();
      termStart = String(s.purchased_at ?? s.credit_start ?? s.created_date ?? "");
    }

    const status = billingScheduleStatus(tier, annual, termStart, Date.now());
    return Response.json({ enabled: true, has_plan: true, ...status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
