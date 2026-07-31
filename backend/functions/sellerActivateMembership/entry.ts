import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { sellerUserCommitmentMonths } from "../../sdk/revenue.ts";
import { SELLER_USER_CONSENT_KIND, commitmentUntil, isSellerActivated } from "../../sdk/seller-activation.ts";

// sellerActivateMembership — the seller's ONE TAP that turns on using the site as a USER and unlocks their
// held cash-back. By tapping, the seller agrees to use the platform as BOTH a seller AND a user for a year
// (SELLER_USER_COMMITMENT_MONTHS). This is part of seller onboarding — one click, no payment.
//
// Effect: mark the seller activated (with the commitment term), record the consent to the append-only
// ConsentRecord ledger, and SWEEP their locked `pending_cashback_points` into spendable `points`. Nothing
// is ever converted to cash — the cash-back is closed-loop scrip the seller can now spend on the site.
// Idempotent: re-tapping just re-sweeps any pending and returns the current state.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // The tap IS the agreement — require it explicitly so the onboarding UI must present the terms.
    const body = await req.json().catch(() => ({}));
    if (body.agree_seller_and_user !== true) {
      return Response.json({
        error: "consent_required",
        message: "To unlock your cash-back, agree to use the site as a seller AND a member for a year.",
      }, { status: 400 });
    }

    const now = new Date();
    const months = sellerUserCommitmentMonths();
    const already = isSellerActivated(user);
    const until = already && (user as Record<string, unknown>).seller_user_commitment_until
      ? String((user as Record<string, unknown>).seller_user_commitment_until)
      : commitmentUntil(now.getTime(), months);

    // 1) Mark activated + capture the commitment term FIRST — so any new sale credits cash-back straight to
    //    spendable points instead of the locked bucket. (Merge patch; leaves pending_cashback_points intact.)
    await db.update("User", user.id, {
      seller_user_activated: true,
      seller_user_activated_at: already ? ((user as Record<string, unknown>).seller_user_activated_at ?? now.toISOString()) : now.toISOString(),
      seller_user_commitment_until: until,
      seller_user_commitment_months: months,
    }).catch(() => null);

    // 2) Sweep the LOCKED cash-back into spendable points. Re-read for a fresh held amount, credit points,
    //    then decrement pending by exactly what we moved (so an in-flight sale that added more isn't lost).
    const fresh = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0] || user;
    const held = Math.max(0, Math.round(Number((fresh as Record<string, unknown>).pending_cashback_points) || 0));
    let swept = 0;
    if (held > 0) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const s = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0] || fresh;
        const bal = Number((s as Record<string, unknown>).points) || 0;
        const ok = await db.updateIf("User", user.id, { points: bal + held }, { field: "points", equals: String(bal) }).catch(() => false);
        if (ok) { swept = held; break; }
      }
      if (swept > 0) await db.incrementField("User", user.id, "pending_cashback_points", -swept).catch(() => null);
    }

    // 3) Append the consent record (append-only evidence: they agreed, to exactly what, when).
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    await recordConsent({
      user_id: user.id,
      kind: SELLER_USER_CONSENT_KIND,
      accepted: true,
      shown: "I agree to use the site as a seller AND a member for one year to unlock and use my cash-back.",
      ip,
      meta: { commitment_months: months, commitment_until: until, swept_cashback_points: swept, auto_qualified: false },
    }).catch(() => null);

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: "seller_membership_activated",
      title: swept > 0 ? "✅ Cash-back unlocked!" : "✅ Member access on",
      message: swept > 0
        ? `You're set up as a member — ${swept} cash-back points are now in your balance to spend on the site.`
        : "You're set up to use the site as a member. Future cash-back will be spendable right away.",
      is_read: false,
    }).catch(() => null);

    return Response.json({
      success: true,
      activated: true,
      already_active: already,
      swept_cashback_points: swept,
      commitment_until: until,
      commitment_months: months,
      message: swept > 0
        ? `Unlocked ${swept} cash-back points — they're now spendable in your balance.`
        : "You're activated as a member. Any cash-back you earn is spendable right away.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
