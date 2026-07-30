import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { getNumber } from "../../sdk/settings.ts";
import { db } from "../../sdk/db.ts";
import { hasLoyaltyCapacity } from "../../sdk/loyalty.ts";

// premiumEligibility — read-only check: has this user EARNED the one-tap Premium offer?
//
// The bargain the owner set: complete the daily survey goal (SURVEY_DAILY_GOAL_USD gross, default $8)
// on at least PREMIUM_AUTOQUALIFY_DAYS days (default 260 = 5 days/week × 52 weeks) within the trailing
// PREMIUM_AUTOQUALIFY_WINDOW_DAYS (default 365). A qualifying day = a DailyEarnings row whose
// survey_gross ≥ the goal. This function ONLY reports status; it never enrolls (that's the explicit
// one-tap accept in premiumAcceptOffer, which captures consent). Nothing here is silent enrollment.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const goalUsd = await getNumber("SURVEY_DAILY_GOAL_USD", 8);
    const needDays = Math.max(1, Math.round(await getNumber("PREMIUM_AUTOQUALIFY_DAYS", 260)));
    const windowDays = Math.max(1, Math.round(await getNumber("PREMIUM_AUTOQUALIFY_WINDOW_DAYS", 365)));

    // Already premium? Then there's nothing to offer.
    const member = (await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0] || null;
    const alreadyPremium = !!member?.loyalty_enrolled && member?.status !== "ended";

    // Count qualifying survey-days inside the trailing window.
    const cutoffMs = Date.now() - windowDays * 86400000;
    const rows = await base44.asServiceRole.entities.DailyEarnings
      .filter({ user_id: user.id }, "-date", 5000).catch(() => []) as Record<string, unknown>[];
    let qualifyingDays = 0;
    for (const r of (rows || [])) {
      const gross = Number(r.survey_gross) || 0;
      if (gross < goalUsd) continue;
      const d = r.date ? new Date(String(r.date) + "T00:00:00Z").getTime() : NaN;
      if (Number.isFinite(d) && d >= cutoffMs) qualifyingDays++;
    }

    const met = qualifyingDays >= needDays;
    const programOpen = await isEnabled("loyalty_program");
    const cap = await hasLoyaltyCapacity();
    // Earned members bypass the capacity governor (they did the work), but we surface capacity so the
    // banner can explain a rare "spot opening soon" case honestly rather than silently.
    const eligible = met && !alreadyPremium && programOpen;

    return Response.json({
      eligible,
      already_premium: alreadyPremium,
      program_open: programOpen,
      qualifying_days: qualifyingDays,
      days_required: needDays,
      days_remaining: Math.max(0, needDays - qualifyingDays),
      window_days: windowDays,
      daily_goal_usd: goalUsd,
      capacity: { ok: cap.ok, enrolled: cap.enrolled, capacity: cap.capacity },
      progress: Math.min(1, needDays > 0 ? qualifyingDays / needDays : 0),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
