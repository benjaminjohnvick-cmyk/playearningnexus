import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { db } from "../../sdk/db.ts";
import { hasLoyaltyCapacity, loyaltyTermDays, loyaltyPerks } from "../../sdk/loyalty.ts";

// loyaltyEnroll — join the retail loyalty & rewards program.
// Requires: the two consents (social posting with #ad disclosure, and the one-year term agreement),
// and an open 1:1 slot (rewarded members ≤ signed-up advertiser businesses). Points stay EARNED,
// closed-loop, and non-cashable; the discount benefit is funded by the member's generated revenue.
// Body: { social_consent: true, annual_agreement: true }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await isEnabled("loyalty_program"))) {
      return Response.json({ blocked: true, message: "The rewards program isn't open right now." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.social_consent !== true || body.annual_agreement !== true) {
      return Response.json({
        error: "consent_required",
        message: "To join, please agree to (1) posting clearly-marked #ad promotional content and (2) the one-year program term.",
        needs: { social_consent: body.social_consent === true, annual_agreement: body.annual_agreement === true },
      }, { status: 400 });
    }

    // 1:1 capacity: never more rewarded members than advertiser businesses funding them.
    const cap = await hasLoyaltyCapacity();
    if (!cap.ok) {
      return Response.json({
        waitlisted: true,
        message: "The rewards program is currently full — a spot opens as more businesses join. You're on the list.",
      }, { status: 200 });
    }

    const now = new Date();
    const termEnd = new Date(now.getTime() + loyaltyTermDays() * 86400000).toISOString();

    // Reuse (or create) the member's PremiumPPCMembership record; store loyalty state on it (JSONB).
    const existing = (await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0];
    const patch = {
      user_id: user.id,
      status: "active",
      loyalty_enrolled: true,
      social_consent_at: now.toISOString(),
      annual_agreement_at: now.toISOString(),
      term_start: now.toISOString(),
      term_end: termEnd,
      commitment_start: existing?.commitment_start ?? now.toISOString(),
      reward_pool_usd: Number(existing?.reward_pool_usd) || 0,
      discount_used_usd: Number(existing?.discount_used_usd) || 0,
      program_complete: false,
      renewal_due: false,
    };
    if (existing?.id) await db.update("PremiumPPCMembership", String(existing.id), patch).catch(() => null);
    else await db.create("PremiumPPCMembership", patch, user.id).catch(() => null);

    await db.create("LoyaltyLedger", { user_id: user.id, type: "enroll", amount_usd: 0, meta: { term_end: termEnd }, at: now.toISOString() }).catch(() => null);

    return Response.json({
      enrolled: true,
      term_end: termEnd,
      perks: loyaltyPerks({ loyalty_enrolled: true }),
      message: "You're in. Complete your daily surveys to unlock your member discount and perks.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
