import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import {
  foundingEnabled, foundingProgramOpen, foundingPriceUsd, foundingTermYears,
  foundingImpressionsPerYear, foundingAutoEnrollMember, foundingEscrowRequired,
  foundingDisclosures, DISCLOSURES_VERSION, FA_STATUS,
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

    // Record the purchase as ESCROWED (funds held pending the launch milestone). Real payment/escrow is
    // external — this is the state record only.
    const rec = await base44.asServiceRole.entities.FoundingAdvertiser.create({
      user_id: user.id,
      tier: "founding",
      price_usd: foundingPriceUsd(),
      term_years: foundingTermYears(),
      status: foundingEscrowRequired() ? FA_STATUS.ESCROWED : FA_STATUS.ACTIVE,
      impressions_per_year: foundingImpressionsPerYear(),
      impressions_served: 0,
      member_enrolled: foundingAutoEnrollMember(),   // part of the closed loop; earns surveys as a member
      affiliate_enrolled: foundingAutoEnrollMember(),
      disclosures_version: DISCLOSURES_VERSION,
      milestone_met: false,
      purchased_at: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({
      ok: true,
      status: rec ? (rec as Record<string, unknown>).status : FA_STATUS.ESCROWED,
      record: rec,
      note: "Funds are held in escrow until the premium-user launch milestone is met; refunded if it isn't. " +
            "You are enrolled as a member and can earn variable Site Cash from surveys (not a repayment of your ad cost).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
