import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { getNumber } from "../../sdk/settings.ts";
import { db } from "../../sdk/db.ts";
import { loyaltyPerks } from "../../sdk/loyalty.ts";

// premiumAcceptOffer — the user's ONE TAP that turns an EARNED offer into Premium enrollment.
//
// The tap IS the consent: by accepting, the user agrees to (1) posting clearly-marked #ad promotional
// content and (2) the one-year program term — exactly the two consents loyaltyEnroll captures, recorded
// here with timestamps. This is NOT silent enrollment: the offer only appears after the user earned it
// (premiumEligibility), and nothing changes until the user taps accept and this handler runs.
//
// Eligibility is RE-VERIFIED server-side (never trust the client). An earned member BYPASSES the
// capacity governor — they did the work, so a slot is guaranteed rather than gated on advertiser count.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await isEnabled("loyalty_program"))) {
      return Response.json({ blocked: true, message: "The rewards program isn't open right now." }, { status: 403 });
    }

    // The tap carries the two consents. Require them explicitly so the accept UI must present them.
    const body = await req.json().catch(() => ({}));
    if (body.social_consent !== true || body.annual_agreement !== true) {
      return Response.json({
        error: "consent_required",
        message: "To accept Premium, please agree to (1) posting clearly-marked #ad promotional content and (2) the one-year program term.",
        needs: { social_consent: body.social_consent === true, annual_agreement: body.annual_agreement === true },
      }, { status: 400 });
    }

    const goalUsd = await getNumber("SURVEY_DAILY_GOAL_USD", 8);
    const needDays = Math.max(1, Math.round(await getNumber("PREMIUM_AUTOQUALIFY_DAYS", 260)));
    const windowDays = Math.max(1, Math.round(await getNumber("PREMIUM_AUTOQUALIFY_WINDOW_DAYS", 365)));

    const existing = (await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0] || null;
    if (existing?.loyalty_enrolled && existing?.status !== "ended") {
      return Response.json({ enrolled: true, already: true, perks: loyaltyPerks({ loyalty_enrolled: true }), message: "You're already a Premium member." });
    }

    // RE-VERIFY the earned qualification server-side.
    const cutoffMs = Date.now() - windowDays * 86400000;
    const rows = await base44.asServiceRole.entities.DailyEarnings
      .filter({ user_id: user.id }, "-date", 5000).catch(() => []) as Record<string, unknown>[];
    let qualifyingDays = 0;
    for (const r of (rows || [])) {
      if ((Number(r.survey_gross) || 0) < goalUsd) continue;
      const d = r.date ? new Date(String(r.date) + "T00:00:00Z").getTime() : NaN;
      if (Number.isFinite(d) && d >= cutoffMs) qualifyingDays++;
    }
    if (qualifyingDays < needDays) {
      return Response.json({
        error: "not_yet_eligible",
        message: "You haven't reached the survey-day milestone yet — keep completing your daily surveys.",
        qualifying_days: qualifyingDays, days_required: needDays, days_remaining: needDays - qualifyingDays,
      }, { status: 403 });
    }

    const now = new Date();
    // Mirror loyaltyEnroll's patch; mark auto_qualified so the origin is auditable. Earned member ⇒
    // capacity bypassed (no hasLoyaltyCapacity gate here).
    const patch = {
      user_id: user.id,
      status: "active",
      loyalty_enrolled: true,
      auto_qualified: true,
      social_consent_at: now.toISOString(),
      annual_agreement_at: now.toISOString(),
      enrolled_at: existing?.enrolled_at ?? now.toISOString(),
      commitment_start: existing?.commitment_start ?? now.toISOString(),
      cap_year_start: existing?.cap_year_start ?? now.toISOString(),
      rewardback_used_usd: Number(existing?.rewardback_used_usd) || 0,
      renewal_due: false,
    };
    if (existing?.id) await db.update("PremiumPPCMembership", String(existing.id), patch).catch(() => null);
    else await db.create("PremiumPPCMembership", patch, user.id).catch(() => null);

    await db.create("LoyaltyLedger", {
      user_id: user.id, type: "enroll", amount_usd: 0,
      meta: { indefinite: true, auto_qualified: true, qualifying_days: qualifyingDays, days_required: needDays },
      at: now.toISOString(),
    }).catch(() => null);

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: "premium_enrolled",
      title: "🎉 Welcome to Premium!",
      message: "You earned it — you're now a Premium member. Your surveys now pay cash back, and you earn points back on every purchase.",
      status: "unread",
      delivery_method: ["in_app"],
    }).catch(() => null);

    return Response.json({
      enrolled: true,
      auto_qualified: true,
      indefinite: true,
      perks: loyaltyPerks({ loyalty_enrolled: true }),
      message: "You're in — Premium unlocked. Keep up your daily surveys to keep earning cash back and points back.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
