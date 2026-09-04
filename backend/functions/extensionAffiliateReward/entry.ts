import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordRevenue, recordSubsidy } from "../../sdk/revenue.ts";
import { extensionEnabled, extensionAffiliateEnabled, mayAttributeAffiliate, splitAffiliateCommission, pointsToUsd } from "../../sdk/extension.ts";

// extensionAffiliateReward (INTERNAL/ADMIN — called by the affiliate network's verified conversion postback or a
// reconciliation job, NOT by an arbitrary client) — records a CONFIRMED affiliate conversion with CLEAN
// attribution and credits the user's cashback share as closed-loop Site Points. The clean-attribution guard is
// the anti-Honey rule: if another party's affiliate cookie was already present we DO NOT claim credit (and pay
// nothing); we only book commission we genuinely earned. Commission is booked as `affiliate_commission`; the
// user's share is a subsidy (cost). Every referral is logged (attributed or not) for audit.
//   { user_id, merchant, order_usd?, commission_usd, network?, existing_cookie_present?, genuine_referral? }
export default __handler(async (req) => {
  try {
    const guard = await requireInternalOrAdmin(req);
    if (guard) return guard;
    if (!extensionEnabled() || !extensionAffiliateEnabled()) return Response.json({ error: "Extension affiliate isn't enabled." }, { status: 403 });

    const b = await req.json().catch(() => ({}));
    const uid = String(b.user_id || "");
    const merchant = String(b.merchant || "");
    const commissionUsd = Math.max(0, Number(b.commission_usd) || 0);
    if (!uid) return Response.json({ error: "user_id required" }, { status: 400 });

    // CLEAN ATTRIBUTION: never override an existing affiliate cookie; only claim genuine referrals.
    const attr = mayAttributeAffiliate({ existing_cookie_present: b.existing_cookie_present === true, genuine_referral: b.genuine_referral !== false });

    // Always log the referral (attributed or not) for audit / dispute resolution.
    const ref = await db.create("AffiliateReferral", {
      user_id: uid, merchant, network: String(b.network || ""), order_usd: Math.max(0, Number(b.order_usd) || 0),
      commission_usd: commissionUsd, existing_cookie_present: b.existing_cookie_present === true,
      genuine_referral: b.genuine_referral !== false, attributed: attr.allowed, reason: attr.reason, at: new Date().toISOString(),
    }).catch(() => null);

    if (!attr.allowed) {
      // We did NOT claim the sale (respecting the other party's attribution) — nothing booked, nothing paid.
      return Response.json({ ok: true, attributed: false, reason: attr.reason, credited_points: 0, note: "Attribution left with the original referrer — no commission claimed." });
    }

    // Book the commission we genuinely earned, then share the user's cashback as closed-loop points.
    if (commissionUsd > 0) await recordRevenue({ type: "affiliate_commission", amount_usd: commissionUsd, user_id: uid, ref: `affiliate:${merchant}`, meta: { source: "extension_affiliate", network: String(b.network || ""), referral_id: (ref as Record<string, unknown>)?.id ?? null } }).catch(() => null);

    const split = splitAffiliateCommission(commissionUsd);
    let creditedPts = 0;
    if (split.user_points > 0) {
      const newBal = await adjustUserBalance(uid, split.user_points, { field: "points" }).catch(() => null);
      if (newBal !== null) {
        creditedPts = split.user_points;
        await db.create("ExtensionReward", { user_id: uid, kind: "affiliate", points: creditedPts, day: new Date().toISOString().slice(0, 10), merchant, promotional: true, at: new Date().toISOString() }).catch(() => null);
        await recordSubsidy({ type: "earnback_subsidy", amount_usd: pointsToUsd(creditedPts), user_id: uid, ref: `affiliate:${merchant}`, funded_by: "affiliate_commission", meta: { source: "extension_affiliate_cashback" } }).catch(() => null);
      }
    }

    return Response.json({ ok: true, attributed: true, commission_usd: commissionUsd, credited_points: creditedPts, credited_usd: pointsToUsd(creditedPts), platform_usd: split.platform_usd });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
