import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { fundBoostPoolFromAdvertiser } from "../../sdk/premium-boost.ts";
import { inventorySaleBlock } from "../../sdk/inventory-governor.ts";
import {
  foundingEnabled, foundingProgramOpen, foundingPriceUsd, foundingTermYears,
  foundingImpressionsPerYear, foundingAutoEnrollMember, signupFinancials,
  foundingDisclosures, DISCLOSURES_VERSION, FA_STATUS,
  foundingSurveyEarnSharePct, tier1PostSurveySharePct, foundingFullKeepYears, foundingSocialAdsEnabled,
  tier1Perks, tier1LaunchBonusImpressions, tier1IncludesPremium,
  tier1PostFoundingPriceUsd, foundingCategoryExclusivityEnabled, foundingCategoryTaken,
} from "../../sdk/founding-advertiser.ts";

// foundingAdvertiserSignup (authenticated) — reserve a Tier 1 advertising seat. Clean Tier 1 model:
//   • Records the purchase of an ADVERTISING product (impressions/term/priority) at the introductory price.
//   • Enrolls the buyer as a member with a SEPARATE survey earn-SHARE perk: keep 100% of their OWN survey
//     earnings for the window (default 4 years) — no amount promised, no cap, not a return of the price.
//   • Availability: while the Tier 1 offer is OPEN (cap not reached) the member keeps 100% in-window; a member
//     who joins AFTER it closes keeps the post-Tier-1 share (default 75%; platform fee 25%).
//   • NON-REFUNDABLE presale by default; NO escrow, NO refund milestone. Records ACTIVE immediately.
//   • Never moves real money — payment is handled by the processor (counsel-gated). Requires explicit,
//     recorded acceptance of the disclosures.
//   { accept_disclosures: true } → { ok, tier1, status, survey_earn_share_pct, record } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!foundingEnabled()) return Response.json({ error: "Offer not open." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (body.accept_disclosures !== true) {
      // Never proceed without an explicit, recorded acceptance of the honest terms.
      return Response.json({ error: "You must accept the disclosures to continue.", disclosures: foundingDisclosures() }, { status: 400 });
    }

    // One active seat per user.
    const existing = await db.filter("FoundingAdvertiser", { user_id: user.id }, "-created_date", 1)
      .catch(() => []) as Record<string, unknown>[];
    if (existing[0] && ![FA_STATUS.REFUNDED, FA_STATUS.CANCELLED].includes(existing[0].status as never)) {
      return Response.json({ error: "You already hold a Tier 1 seat.", record: existing[0] }, { status: 409 });
    }

    // Inventory governor: never sell a Tier 1 seat the current audience can't serve impressions for.
    const invBlock = await inventorySaleBlock("tier1").catch(() => null);
    if (invBlock) return Response.json({ error: invBlock, inventory_full: true }, { status: 409 });

    // Tier assignment by AVAILABILITY: while the introductory offer is open, the member keeps 100% in-window;
    // once the advertiser cap is reached the offer has closed and new members keep the post-Tier-1 share.
    const isTier1 = await foundingProgramOpen();  // true = FOUNDING (pre-revenue) phase open; false = post-founding Tier 1
    const sharePct = isTier1 ? foundingSurveyEarnSharePct() : tier1PostSurveySharePct();

    // Category exclusivity — a FOUNDER-ONLY perk: each founder claims a category no other live founder holds.
    const exclusivityOn = isTier1 && foundingCategoryExclusivityEnabled();
    const category = String(body.category ?? "").trim();
    if (exclusivityOn && category) {
      const taken = await foundingCategoryTaken(db, category).catch(() => false);
      if (taken) {
        return Response.json({ error: `The "${category}" category is already held by a founding advertiser — pick another.`, category_taken: true }, { status: 409 });
      }
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    // Record explicit consent to the honest disclosures (append-only evidence).
    await recordConsent({
      user_id: user.id, kind: "tier1_advertiser_terms", version: DISCLOSURES_VERSION, accepted: true,
      shown: foundingDisclosures(), ip, meta: { feature: "tier1_advertiser", tier1: isTier1 },
    }).catch(() => null);

    // Presale funds split (non-refundable revenue by default). Real payment/escrow are external — state only.
    // Founding phase pays the founding price ($13,000); after it closes, standard Tier 1 pays the +30% price.
    const fin = signupFinancials(isTier1 ? undefined : tier1PostFoundingPriceUsd());
    const now = new Date().toISOString();
    const rec = await base44.asServiceRole.entities.FoundingAdvertiser.create({
      user_id: user.id,
      tier: "tier1",
      tier1: isTier1,                        // true = joined while the offer was open (100%-keep in-window)
      price_usd: fin.price_usd,
      funds_model: fin.model,
      spendable_usd: fin.spendable_usd,      // non-refundable revenue that funds build/launch/growth
      escrow_usd: fin.escrow_usd,            // refundable portion (0 in presale)
      refundable: fin.refundable,
      term_years: foundingTermYears(),
      // Founder-only category exclusivity (null when not claimed or post-founding).
      category: category || null,
      category_exclusive: !!(exclusivityOn && category),
      is_founding: isTier1,
      // The advertising is live immediately (no launch-milestone gate in the clean model).
      status: FA_STATUS.ACTIVE,
      impressions_per_year: foundingImpressionsPerYear(),
      launch_bonus_impressions: tier1LaunchBonusImpressions(),
      impressions_served: 0,
      social_ads: foundingSocialAdsEnabled(),
      // The packed value stack — a durable record of exactly what this member's package includes.
      premium_included: tier1IncludesPremium(),
      perks: tier1Perks(),
      // SEPARATE survey earn-SHARE perk — a rate, not an amount; NO cap.
      survey_earn_share_pct: sharePct,       // 1.0 (Tier 1, in-window) or the post-Tier-1 share
      fullkeep_window_years: foundingFullKeepYears(),
      fullkeep_earned_usd: 0,                // cumulative survey earnings recorded (reporting only; no cap)
      fullkeep_start: now,                   // 100%-keep window starts at signup
      credit_start: now,
      member_enrolled: foundingAutoEnrollMember(),
      affiliate_enrolled: foundingAutoEnrollMember(),
      disclosures_version: DISCLOSURES_VERSION,
      purchased_at: now,
    }).catch(() => null);

    // Advertiser contribution to the SHARED premium member-boost pool. DECOUPLED from this member's own
    // payment: it is not earmarked to them and is not a rebate of the fee. Premium members (Tier 1 includes
    // premium) claim the advertiser-funded gift boost from this collective pool as a premium benefit, subject
    // to availability — never "get part of your $12k back." Best-effort; safe no-op if the program is off.
    await fundBoostPoolFromAdvertiser(String(user.id), fin.price_usd).catch(() => null);

    const note = isTier1
      ? "Tier 1 confirmed. You've bought the advertising package, and as a Tier 1 member you keep 100% of what " +
        "YOU earn from third-party surveys for " + foundingFullKeepYears() + " years (paid as Site Cash; a rate, " +
        "not a promised amount; separate from the ad price). " +
        (fin.model === "presale" ? "Your payment is NON-REFUNDABLE." : "")
      : "The Tier 1 introductory offer has closed. You've bought the advertising package; as a member you keep " +
        Math.round(sharePct * 100) + "% of what you earn from third-party surveys (platform fee " +
        Math.round((1 - sharePct) * 100) + "%), paid as Site Cash. " +
        (fin.model === "presale" ? "Your payment is NON-REFUNDABLE." : "");

    const boostNote = " As a premium member you can claim the advertiser-funded gift boost — up to $2,000 in " +
      "non-cashable store credit for premium members, subject to availability. It's a premium benefit, not a " +
      "return of what you paid.";

    return Response.json({
      ok: true,
      tier1: isTier1,
      status: rec ? (rec as Record<string, unknown>).status : FA_STATUS.ACTIVE,
      survey_earn_share_pct: sharePct,
      record: rec,
      note: note + boostNote,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
