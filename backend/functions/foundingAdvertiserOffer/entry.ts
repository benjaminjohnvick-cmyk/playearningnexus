import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  foundingEnabled, foundingPriceUsd, foundingTermYears, foundingImpressionsPerYear,
  foundingSlots, foundingSlotsRemaining, foundingUpsellBusiness, foundingDisclosures,
  foundingValueSummary, foundingFullKeepStatus, foundingFullKeepYears,
  foundingSurveyEarnSharePct, tier1PostSurveySharePct, FA_STATUS,
} from "../../sdk/founding-advertiser.ts";
import {
  freeAdvertiserTierEnabled, noUpfrontEnabled, noUpfrontTermYears, earnedDisclosures,
  earnUnlockThreshold, earnDailyReferralGoal, EARN_MODE,
} from "../../sdk/earned-advertiser.ts";

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

    // The caller's earned/no-upfront record (if they already chose one of those Tier 1 paths).
    const earnedRows = await db.filter("EarnedAdvertiser", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const earnedMine = earnedRows[0]
      ? { mode: earnedRows[0].mode, unlock_level: earnedRows[0].unlock_level, status: earnedRows[0].status, onboarding_invite_step: earnedRows[0].onboarding_invite_step }
      : null;

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
      // The THREE ways into Tier 1 — the paid path plus the two $0 options (no-upfront + free earn-to-unlock).
      // These are presented as OPTIONS within Tier 1, chosen on this page.
      options: {
        paid: {
          key: "paid", enabled: open, label: "Pay upfront", cost_usd: foundingPriceUsd(),
          summary: `Get the full Tier 1 package now for ${foundingPriceUsd().toLocaleString()}, and keep 100% of your survey earnings for ${foundingFullKeepYears()} years.`,
        },
        no_upfront: {
          key: EARN_MODE.NOUPFRONT, enabled: noUpfrontEnabled(), label: "No upfront — participate", cost_usd: 0,
          term_years: noUpfrontTermYears(),
          summary: `$0 upfront. Get advertiser status now; your advertising delivers over ${noUpfrontTermYears()} years while you stay active. Nothing owed — stop anytime, owe nothing.`,
          disclosures: earnedDisclosures(EARN_MODE.NOUPFRONT),
        },
        free_earn: {
          key: EARN_MODE.FREE, enabled: freeAdvertiserTierEnabled(), label: "Free — earn as you go", cost_usd: 0,
          daily_referral_goal: earnDailyReferralGoal(),
          thresholds: [earnUnlockThreshold(1), earnUnlockThreshold(2), earnUnlockThreshold(3), earnUnlockThreshold(4)],
          summary: "$0. Use the site and refer friends to progressively unlock advertiser benefits — up to the full package. Nothing owed, ever. Referrals are the fastest path (optional).",
          disclosures: earnedDisclosures(EARN_MODE.FREE),
        },
      },
      earned_mine: earnedMine,
      statuses: FA_STATUS,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
