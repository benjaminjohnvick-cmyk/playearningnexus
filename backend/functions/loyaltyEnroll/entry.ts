import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { db } from "../../sdk/db.ts";
import { hasLoyaltyCapacity, loyaltyPerks } from "../../sdk/loyalty.ts";

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

    // Reuse (or create) the member's PremiumPPCMembership record; store loyalty state on it (JSONB).
    // Membership is INDEFINITE — no hard term end. The annual mark is a re-consent reminder; the $1,460
    // points-back cap resets each program year (tracked from cap_year_start).
    const existing = (await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0];
    const patch = {
      user_id: user.id,
      status: "active",
      loyalty_enrolled: true,
      social_consent_at: now.toISOString(),
      annual_agreement_at: now.toISOString(),         // resets the annual re-consent clock
      enrolled_at: existing?.enrolled_at ?? now.toISOString(),
      commitment_start: existing?.commitment_start ?? now.toISOString(),
      cap_year_start: existing?.cap_year_start ?? now.toISOString(),
      rewardback_used_usd: Number(existing?.rewardback_used_usd) || 0,
      renewal_due: false,
    };
    if (existing?.id) await db.update("PremiumPPCMembership", String(existing.id), patch).catch(() => null);
    else await db.create("PremiumPPCMembership", patch, user.id).catch(() => null);

    await db.create("LoyaltyLedger", { user_id: user.id, type: "enroll", amount_usd: 0, meta: { indefinite: true }, at: now.toISOString() }).catch(() => null);

    return Response.json({
      enrolled: true,
      indefinite: true,
      perks: loyaltyPerks({ loyalty_enrolled: true }),
      message: "You're in — and you can stay in year to year as long as you keep up your daily surveys. Complete today's to start earning points back.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
