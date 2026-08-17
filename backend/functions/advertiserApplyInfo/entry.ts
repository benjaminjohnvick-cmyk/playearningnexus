import { __handler } from "../../sdk/runtime.ts";
import { snapNumber } from "../../sdk/settings.ts";
import { foundingPriceUsd, foundingMonthlyPriceUsd, foundingImpressionsPerYear, foundingTermYears, tier1AiSocialPostsPerMonth } from "../../sdk/founding-advertiser.ts";
import { upgradeDiscountPct } from "../../sdk/founding-rollover.ts";
import { tier2Name, tier2TotalUsd, tier2Parts } from "../../sdk/tier2-scaling.ts";
import { flexPayLive } from "../../sdk/flexpay.ts";
import { tier1FinancedLive } from "../../sdk/tier1-financed.ts";
import { publicSeatAvailability } from "../../sdk/inventory-governor.ts";

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

    const tier1 = {
      name: "Founding Advertiser — Tier 1",
      annual_usd: foundingPriceUsd(),
      monthly_usd: foundingMonthlyPriceUsd(),
      slots_cap: slots,
      benefits: [
        `${impressions.toLocaleString()} ad impressions per year — a ${term}-year term`,
        "Premier featured placement + a spot on the sponsors wall",
        "Free AI-written ad creative for your products",
        `~${tier1AiSocialPostsPerMonth()} AI social ad posts per month (clearly labeled)`,
        "A/B testing, analytics & sentiment insights included",
        "Keep 100% of your own survey earnings for 4 years (as Site Cash)",
        `Premium membership — premium members get the advertiser-funded gift boost (up to $${boost.toLocaleString()} in non-cashable store credit, subject to availability), a benefit decoupled from the price you pay`,
        `${discPct}% off the Tier 2 "Scale" upgrade — kept for life as a founding member`,
      ],
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
      scarcity: `Limited space for advertisers — the Founding tier is open until ${slots.toLocaleString()} advertisers enroll, then it closes.`,
      disclaimer: "Applying does not commit you to anything. Options marked “coming soon” are financing products that are subject to approval and availability and are not offered yet.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
