import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  consentsComplete, withinTerm, dailyRequirementMet, eligibleForDiscount, renewalDue,
  loyaltyPerks, loyaltyDiscountPct,
} from "../../sdk/loyalty.ts";
import { makeupPlan } from "../../sdk/premium-ppc.ts";

// loyaltyStatus — what the MEMBER sees. Deliberately hides the back-end value figures (the $1,460 cap
// and the pool balance are never returned); it only tells the member whether their discount is active
// right now and what today's steps are. Body: {}
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
    const discountActive = eligibleForDiscount(member);

    return Response.json({
      enrolled: true,
      // Member-facing booleans only — no dollar cap, no pool balance.
      discount_active: discountActive,
      discount_pct: loyaltyDiscountPct(),
      steps_today: {
        surveys_done_today: stepsDoneToday,
        sessions_remaining_today: plan.remaining_sessions_today,
        minutes_remaining_today: plan.required_minutes_today,
        social_consent: !!member?.social_consent_at,
        term_active: withinTerm(member),
      },
      consents_complete: consentsComplete(member),
      renewal_due: renewalDue(member),
      perks: loyaltyPerks(member),
      message: discountActive
        ? "Your member discount is active — it's applied automatically at checkout."
        : (renewalDue(member)
            ? "Your year is complete — re-enroll to keep your rewards going."
            : "Finish today's surveys to activate your member discount."),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
