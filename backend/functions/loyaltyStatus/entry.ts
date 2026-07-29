import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  consentsComplete, withinTerm, dailyRequirementMet, eligibleForDiscount, renewalDue,
  loyaltyPerks, loyaltyDiscountPct,
} from "../../sdk/loyalty.ts";
import { makeupPlan } from "../../sdk/premium-ppc.ts";

// loyaltyStatus — what the MEMBER sees. Deliberately hides the back-end value figures (the $1,460
// annual cap and cumulative usage are never returned); it only tells the member whether their
// points-back is active right now and what today's steps are. Membership is indefinite. Body: {}
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const member = (await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0] || null;
    const enrolled = !!member?.loyalty_enrolled;
    if (!enrolled) {
      return Response.json({ enrolled: false, perks: loyaltyPerks(null), discount_pct: loyaltyDiscountPct() });
    }

    const plan = makeupPlan(member);
    const stepsDoneToday = dailyRequirementMet(member);
    const cashbackActive = eligibleForDiscount(member);
    const reconsent = renewalDue(member);

    return Response.json({
      enrolled: true,
      indefinite: true,
      // Member-facing booleans only — no dollar cap, no cumulative usage figure.
      cashback_active: cashbackActive,
      cashback_pct: loyaltyDiscountPct(),
      membership_active: withinTerm(member),
      steps_today: {
        surveys_done_today: stepsDoneToday,
        sessions_remaining_today: plan.remaining_sessions_today,
        minutes_remaining_today: plan.required_minutes_today,
        social_consent: !!member?.social_consent_at,
      },
      consents_complete: consentsComplete(member),
      reconsent_due: reconsent,   // annual re-agreement reminder — membership continues
      perks: loyaltyPerks(member),
      message: cashbackActive
        ? "Your 10% points-back is active — it's added to your store credit after each purchase."
        : (reconsent
            ? "It's your yearly check-in — re-confirm to keep your rewards going. You stay in the program."
            : "Finish today's surveys to activate your 10% points-back."),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
