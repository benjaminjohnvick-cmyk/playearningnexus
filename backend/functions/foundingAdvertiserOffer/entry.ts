import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  foundingEnabled, foundingPriceUsd, foundingTermYears, foundingImpressionsPerYear,
  foundingSlots, foundingSlotsRemaining, foundingUpsellBusiness, foundingDisclosures,
  foundingValueSummary, foundingFullKeepStatus, milestoneState, FA_STATUS,
} from "../../sdk/founding-advertiser.ts";

// foundingAdvertiserOffer (authenticated) — the honest terms of the founding-advertiser package + the
// caller's own status. Read-only. Everything here is advertising + membership; NOTHING here promises a
// financial return (see the disclosures block).
//   {} → { open, price_usd, term_years, impressions_per_year, slots, slots_remaining, milestone,
//          disclosures, upsell_business, mine }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const [remaining, milestone] = await Promise.all([foundingSlotsRemaining(), milestoneState(today)]);

    const mineRows = await db.filter("FoundingAdvertiser", { user_id: user.id }, "-created_date", 1)
      .catch(() => []) as Record<string, unknown>[];
    const mine = mineRows[0]
      ? {
          status: mineRows[0].status,
          term_years: mineRows[0].term_years,
          impressions_per_year: mineRows[0].impressions_per_year,
          impressions_served: mineRows[0].impressions_served || 0,
          purchased_at: mineRows[0].purchased_at,
          // Founding full-keep progress: how much of the 100%-keep window/cap the member has used (variable,
          // not a promised amount). Shown so they can see their standing, never as "money you'll get back".
          full_keep: foundingFullKeepStatus(mineRows[0], today),
        }
      : null;

    return Response.json({
      open: foundingEnabled() && remaining > 0,
      price_usd: foundingPriceUsd(),
      term_years: foundingTermYears(),
      impressions_per_year: foundingImpressionsPerYear(),
      slots: foundingSlots(),
      slots_remaining: remaining,
      milestone: {
        target: milestone.target, current: milestone.current, users_met: milestone.users_met,
        founders_target: milestone.founders_target, founders_current: milestone.founders_current, founders_met: milestone.founders_met,
        met: milestone.met, deadline: milestone.deadline,
      },
      disclosures: foundingDisclosures(),
      value: foundingValueSummary(),
      upsell_business: foundingUpsellBusiness(),
      mine,
      statuses: FA_STATUS,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
