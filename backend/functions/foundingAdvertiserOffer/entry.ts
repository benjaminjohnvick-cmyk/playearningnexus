import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  foundingEnabled, foundingPriceUsd, foundingTermYears, foundingImpressionsPerYear,
  foundingSlots, foundingSlotsRemaining, foundingUpsellBusiness, foundingDisclosures,
  foundingValueSummary, foundingFullKeepStatus, foundingFullKeepYears,
  foundingSurveyEarnSharePct, tier1PostSurveySharePct, FA_STATUS,
} from "../../sdk/founding-advertiser.ts";

// foundingAdvertiserOffer (authenticated) — the honest terms of the Tier 1 introductory advertising offer +
// the caller's own status. Read-only. Two things, kept SEPARATE: the advertising PRODUCT you buy, and a
// standalone survey earn-SHARE membership perk. NOTHING here promises a financial return (see disclosures).
//   {} → { open, price_usd, term_years, impressions_per_year, slots, slots_remaining, in_offer_share,
//          post_offer_share, fullkeep_years, disclosures, value, upsell_business, mine, statuses }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const remaining = await foundingSlotsRemaining();
    const open = foundingEnabled() && remaining > 0;

    const mineRows = await db.filter("FoundingAdvertiser", { user_id: user.id }, "-created_date", 1)
      .catch(() => []) as Record<string, unknown>[];
    const mine = mineRows[0]
      ? {
          status: mineRows[0].status,
          tier1: mineRows[0].tier1 === true,
          term_years: mineRows[0].term_years,
          impressions_per_year: mineRows[0].impressions_per_year,
          impressions_served: mineRows[0].impressions_served || 0,
          purchased_at: mineRows[0].purchased_at,
          // The member's current survey earn-SHARE standing (a rate, never a promised amount). Shows whether
          // they're still in their 100%-keep window, what share applies now, and cumulative earnings to date.
          survey_share: foundingFullKeepStatus(mineRows[0], today),
        }
      : null;

    return Response.json({
      open,
      price_usd: foundingPriceUsd(),
      term_years: foundingTermYears(),
      impressions_per_year: foundingImpressionsPerYear(),
      slots: foundingSlots(),
      slots_remaining: remaining,
      in_offer_share: foundingSurveyEarnSharePct(),      // 1.0 — Tier 1 members keep 100% in-window
      post_offer_share: tier1PostSurveySharePct(),        // 0.75 — after the offer closes, members keep 75%
      fullkeep_years: foundingFullKeepYears(),
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
