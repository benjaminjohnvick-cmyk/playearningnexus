import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { annualEarnCeiling, DAILY_EARN_CAP, round2 } from "../../sdk/premium-ppc.ts";

// premiumPPCRequestAdvance — DEPRECATED under the no-penalty points model.
//
// There is NO upfront advance/disbursement anymore. (An upfront advance repaid over time is exactly
// what created the lending/credit risk.) Points are EARNED as you go — up to $4/day, capped at the
// annual ceiling ($1,460) — so there is nothing to "request" and nothing to repay.
//
// This endpoint NO LONGER grants any balance. It is kept only so existing callers get a clear,
// harmless response; it simply reports the member's earn-as-you-go status.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const members = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ user_id: user.id, status: "active" });
    const member = (members || [])[0];
    if (!member) return Response.json({ error: "No active Premium PPC membership. Enroll first." }, { status: 400 });

    const earned = round2(member.points_earned_total ?? 0);
    const ceiling = annualEarnCeiling();

    return Response.json({
      success: true,
      advance_granted: 0,
      model: "no-penalty-points",
      message: `There is no upfront advance. You earn points as you go — up to $${DAILY_EARN_CAP}/day — ` +
        `with no repayment and no charge for days you don't participate.`,
      points_earned: earned,
      annual_earn_ceiling: ceiling,
      remaining_to_earn: round2(Math.max(0, ceiling - earned)),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
