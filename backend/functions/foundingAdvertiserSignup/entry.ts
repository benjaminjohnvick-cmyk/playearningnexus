import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import {
  foundingEnabled, foundingProgramOpen, foundingPriceUsd, foundingTermYears,
  foundingImpressionsPerYear, foundingAutoEnrollMember, signupFinancials,
  foundingDisclosures, DISCLOSURES_VERSION, FA_STATUS,
  foundingStoreCreditPoints, foundingStoreCreditReleaseYears, foundingSurveyEarnSharePct, foundingSocialAdsEnabled,
} from "../../sdk/founding-advertiser.ts";

// foundingAdvertiserSignup (authenticated) — reserve a founding-advertiser seat. This records the purchase
// as ESCROWED and enrolls the buyer as a member/affiliate of the closed loop. It does NOT move real money:
// the actual payment + escrow are handled by your processor/escrow agent (counsel-gated). No financial
// return is promised; member survey earnings are a separate, variable benefit.
//
// GATING: the buyer must explicitly accept the disclosures ({ accept_disclosures: true }) — which state, in
// plain language, that this is advertising (not an investment), earnings are variable and not an offset,
// and funds are escrowed/refundable. One active record per user.
//   { accept_disclosures: true } → { ok, status, record } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!foundingEnabled()) return Response.json({ error: "Program not open." }, { status: 403 });
    if (!(await foundingProgramOpen())) return Response.json({ error: "All founding slots are taken." }, { status: 409 });

    const body = await req.json().catch(() => ({}));
    if (body.accept_disclosures !== true) {
      // Never proceed without an explicit, recorded acceptance of the honest terms.
      return Response.json({ error: "You must accept the disclosures to continue.", disclosures: foundingDisclosures() }, { status: 400 });
    }

    // One active seat per user.
    const existing = await db.filter("FoundingAdvertiser", { user_id: user.id }, "-created_date", 1)
      .catch(() => []) as Record<string, unknown>[];
    if (existing[0] && ![FA_STATUS.REFUNDED, FA_STATUS.CANCELLED].includes(existing[0].status as never)) {
      return Response.json({ error: "You already hold a founding-advertiser seat.", record: existing[0] }, { status: 409 });
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    // Record explicit consent to the honest disclosures (append-only evidence).
    await recordConsent({
      user_id: user.id, kind: "founding_advertiser_terms", version: DISCLOSURES_VERSION, accepted: true,
      shown: foundingDisclosures(), ip, meta: { feature: "founding_advertiser" },
    }).catch(() => null);

    // Split the payment per the configured funds model. presale = fully non-refundable revenue (spendable on
    // ramp-up); escrow = fully refundable/held; hybrid = deposit spendable + rest escrowed. Real payment +
    // escrow are external — this is the state record only (it never moves money).
    const fin = signupFinancials();
    const initialStatus = fin.model === "escrow" ? FA_STATUS.ESCROWED : FA_STATUS.FUNDED;
    const rec = await base44.asServiceRole.entities.FoundingAdvertiser.create({
      user_id: user.id,
      tier: "founding",
      price_usd: fin.price_usd,
      funds_model: fin.model,
      spendable_usd: fin.spendable_usd,      // non-refundable revenue that funds the ramp-up
      escrow_usd: fin.escrow_usd,            // refundable portion held in escrow (0 in presale)
      refundable: fin.refundable,
      term_years: foundingTermYears(),
      status: initialStatus,
      impressions_per_year: foundingImpressionsPerYear(),
      impressions_served: 0,
      social_ads: foundingSocialAdsEnabled(),
      // Founding store-credit grant (points / closed-loop, non-cashable) — released in annual tranches once
      // the platform is live. A membership benefit, not a refund or a dollar value.
      store_credit_points_granted: foundingStoreCreditPoints(),
      store_credit_release_years: foundingStoreCreditReleaseYears(),
      store_credit_points_released: 0,
      credit_start: null,                            // set when the record activates (platform launched)
      survey_earn_share_pct: foundingSurveyEarnSharePct(),
      member_enrolled: foundingAutoEnrollMember(),   // part of the closed loop; earns surveys as a member
      affiliate_enrolled: foundingAutoEnrollMember(),
      disclosures_version: DISCLOSURES_VERSION,
      milestone_met: false,
      purchased_at: new Date().toISOString(),
    }).catch(() => null);

    const note = fin.model === "presale"
      ? "This founding payment is NON-REFUNDABLE and funds building/launching the platform. Your advertising " +
        "begins delivering once both launch milestones are met. You are also a member and can earn variable " +
        "Site Cash from surveys (not a repayment of your ad cost)."
      : fin.model === "hybrid"
      ? `A ${fin.spendable_usd.toLocaleString()} deposit is non-refundable and funds the ramp-up; ` +
        `${fin.escrow_usd.toLocaleString()} is escrowed and refunded if the milestones aren't met.`
      : "Funds are held in escrow until both launch milestones are met; refunded if they aren't.";

    return Response.json({ ok: true, status: rec ? (rec as Record<string, unknown>).status : initialStatus, record: rec, note });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
