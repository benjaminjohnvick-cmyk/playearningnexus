import { __handler } from "../../sdk/runtime.ts";
import { snapNumber } from "../../sdk/settings.ts";
import { foundingPriceUsd, foundingMonthlyPriceUsd, foundingImpressionsPerYear, foundingTermYears, tier1AiSocialPostsPerMonth,
  foundingProgramOpen, foundingSlotsRemaining, tier1PostFoundingPriceUsd, foundingCategoryExclusivityEnabled, foundingDisclosureCopy } from "../../sdk/founding-advertiser.ts";
import { upgradeDiscountPct } from "../../sdk/founding-rollover.ts";
import { tier2Name, tier2TotalUsd, tier2Parts } from "../../sdk/tier2-scaling.ts";
import { flexPayLive } from "../../sdk/flexpay.ts";
import { tier1FinancedLive } from "../../sdk/tier1-financed.ts";
import { publicSeatAvailability } from "../../sdk/inventory-governor.ts";
import { billing13PeriodPricingEnabled, billingPeriodsPerYear } from "../../sdk/billing-cadence.ts";

// advertiserApplyInfo (public read) — the content for the /Apply page: the prominent Founding Advertiser
// (Tier 1) offer with its live benefits + availability, and the three financing options with their real
// gate status (all "coming_soon" until a licensed provider + counsel sign-off flip them live). No auth needed.
export default __handler(async () => {
  try {
    const impressions = foundingImpressionsPerYear();
    const term = foundingTermYears();
    const boost = Math.max(0, snapNumber("PREMIUM_GIFT_BOOST_MAX_USD", 2000));
    const discPct = Math.round(upgradeDiscountPct() * 100);
    const slots = Math.max(0, snapNumber("FOUNDING_ADVERTISER_SLOTS", 100000));

    // Billing cadence: with 13-period pricing on, the annual is 13 four-week periods (never "monthly").
    const thirteenPeriod = billing13PeriodPricingEnabled();

    // TWO-PHASE offer: Founding (pre-revenue) while the cap is open → standard Tier 1 (+30%) after it closes.
    const foundingOpen = await foundingProgramOpen();
    const remaining = await foundingSlotsRemaining().catch(() => null);
    const exclusivity = foundingCategoryExclusivityEnabled();
    const annual = foundingOpen ? foundingPriceUsd() : tier1PostFoundingPriceUsd();

    const benefits: string[] = [
      `${impressions.toLocaleString()} ad impressions per year — a ${term}-year term`,
      "Premier featured placement + a spot on the sponsors wall",
      "Free AI-written ad creative for your products",
      "Always-on AI campaign manager + optimization (AI concierge, human escalation)",
      `~${tier1AiSocialPostsPerMonth()} AI social ad posts per month (clearly labeled)`,
      "A/B testing, analytics & sentiment insights included",
      foundingOpen
        ? "Keep 100% of your own survey earnings — for life (as Site Cash)"
        : "Keep the standard share of your own survey earnings (as Site Cash)",
      `Premium membership — up to $${boost.toLocaleString()} advertiser-funded gift boost (non-cashable store credit), decoupled from the price you pay`,
    ];
    if (foundingOpen) {
      benefits.push(
        "Founding price locked for life",
        "“Founding Partner” verified badge + a spot on the Founding Partners wall",
        `${discPct}% off the Tier 2 “Scale” upgrade — kept for life`,
        "Audience-growth dividend, founder referral bonus, roadmap input & co-marketing",
      );
      if (exclusivity) benefits.push("Category exclusivity — you're the only founding advertiser in your category");
    }

    const tier1 = {
      name: foundingOpen ? "Founding Advertiser — Tier 1" : "Tier 1",
      phase: foundingOpen ? "founding" : "tier1",
      founding_open: foundingOpen,
      annual_usd: annual,
      // Per-period price + label for the sub-line. 13-period → "$1,000 / 4 weeks" (13 cycles/yr); off → "/mo".
      period_usd: foundingMonthlyPriceUsd(),
      period_label: thirteenPeriod ? "4 weeks" : "month",
      periods_per_year: thirteenPeriod ? billingPeriodsPerYear() : 12,
      thirteen_period: thirteenPeriod,
      slots_cap: slots,
      slots_remaining: remaining,
      category_exclusivity: foundingOpen && exclusivity,
      delivery_disclosure: foundingDisclosureCopy(),
      benefits,
    };

    const seats = await publicSeatAvailability().catch(() => null);
    const tier2SeatLine = seats
      ? (seats.tier2_always_open
          ? (seats.tier2_seats_available > 0
              ? `${seats.tier2_seats_available.toLocaleString()} seats available now for immediate full delivery — and Tier 2 is always open to join (additional seats deliver as our audience grows).`
              : `Always open to join — your impressions are guaranteed over your term and deliver as our audience grows.`)
          : (seats.tier2_seats_available >= 0 ? `${seats.tier2_seats_available.toLocaleString()} seats available now.` : "Available now."))
      : "Scale up in monthly, pay-as-you-go parts — available now.";
    const tier2 = { name: tier2Name(), total_usd: tier2TotalUsd(), parts: tier2Parts(), available: true,
      seats_available: seats?.tier2_seats_available ?? null, always_open: seats?.tier2_always_open ?? true,
      tagline: tier2SeatLine };

    const gates = [
      { key: "flexpay", name: "Flexible Payment Terms", tagline: "Split a package into 4 quarterly credit-card payments.", live: await flexPayLive(null) },
      { key: "tier1_financed", name: "Tier 1 — Pay From Results", tagline: "Start advertising now and pay across the year as results come in.", live: await tier1FinancedLive(null) },
    ];
    const coming_soon = gates.map((g) => ({ key: g.key, name: g.name, tagline: g.tagline, status: g.live ? "available" : "coming_soon" }));

    return Response.json({
      tier1, tier2, coming_soon,
      seats: seats ? {
        tier1_available: seats.tier1_seats_available,
        tier2_available: seats.tier2_seats_available,
        tier2_always_open: seats.tier2_always_open,
      } : null,
      scarcity: tier1.founding_open
        ? `Founding is open until ${slots.toLocaleString()} founding advertisers enroll, then it closes and Tier 1 (at a higher price) takes over.${remaining != null ? ` ~${remaining.toLocaleString()} founding spots of runway left.` : ""}`
        : `The Founding offer has closed. This is the standard Tier 1 offer.`,
      delivery_disclosure: foundingDisclosureCopy(),
      disclaimer: "Applying does not commit you to anything. Options marked “coming soon” are financing products that are subject to approval and availability and are not offered yet.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
