import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { sellerUserCommitmentMonths } from "../../sdk/revenue.ts";
import { SELLER_USER_CONSENT_KIND, commitmentUntil, deriveSellerUsername, isSeller, sweepPendingCashback } from "../../sdk/seller-activation.ts";

// sellerSignupOneClick — ONE TAP to become a seller. Because fulfillment is AI-automated and the economy
// is closed-loop, any user can open a storefront instantly; there's no separate seller account — the
// account username IS the seller name. The tap also activates member use (so cash-back / curator points are
// spendable) and captures the seller + member consent for a year. Idempotent.
//
// The seller deal (advertised): keep 100% of your own sale + 10% back in points. Catalog products you
// resell from your storefront pay 10% back in points (the platform sources/fulfills and keeps the spread).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.agree_seller_and_user !== true) {
      return Response.json({
        error: "consent_required",
        message: "To open your storefront, agree to the seller terms and to use the site as a member for a year.",
      }, { status: 400 });
    }

    const now = new Date();
    const months = sellerUserCommitmentMonths();
    const alreadySeller = isSeller(user as Record<string, unknown>);
    const username = deriveSellerUsername(user as Record<string, unknown>);
    const until = (user as Record<string, unknown>).seller_user_commitment_until
      ? String((user as Record<string, unknown>).seller_user_commitment_until)
      : commitmentUntil(now.getTime(), months);

    // Mark seller + member in one write. Username = account username (no separate seller account).
    await db.update("User", user.id, {
      is_seller: true,
      seller_username: username,
      seller_since: (user as Record<string, unknown>).seller_since ?? now.toISOString(),
      seller_user_activated: true,
      seller_user_activated_at: (user as Record<string, unknown>).seller_user_activated_at ?? now.toISOString(),
      seller_user_commitment_until: until,
      seller_user_commitment_months: months,
    }).catch(() => null);

    // Activating member use unlocks any cash-back / curator points held while they weren't a member yet.
    const swept = await sweepPendingCashback(user.id);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    await recordConsent({
      user_id: user.id,
      kind: SELLER_USER_CONSENT_KIND,
      accepted: true,
      shown: "I agree to the seller terms and to use the site as a seller AND a member for one year. My points are closed-loop credit spendable on the site — not cash, not withdrawable.",
      ip,
      meta: { via: "seller_signup_one_click", commitment_months: months, commitment_until: until, swept_cashback_points: swept, username },
    }).catch(() => null);

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: "seller_signup",
      title: "🏪 Your storefront is open!",
      message: swept > 0
        ? `You're a seller now, @${username}. Keep 100% of your sales + 10% back in points — and ${swept} points you'd earned are now spendable.`
        : `You're a seller now, @${username}. Keep 100% of your sales + 10% back in points. Add products to your storefront to start.`,
      is_read: false,
    }).catch(() => null);

    return Response.json({
      success: true,
      is_seller: true,
      already_seller: alreadySeller,
      seller_username: username,
      swept_cashback_points: swept,
      commitment_until: until,
      commitment_months: months,
      deal: "Keep 100% of your sale + 10% back in points",
      message: `You're set up as a seller (@${username}). Keep 100% of your sales plus 10% back in points.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
