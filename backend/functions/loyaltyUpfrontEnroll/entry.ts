import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { db } from "../../sdk/db.ts";
import { loyaltyUpfrontEnabled, enrollUpfront, upfrontStatus } from "../../sdk/loyalty.ts";

// loyaltyUpfrontEnroll (authenticated, PREMIUM members only) — opt to take your reward value UP FRONT.
// You're enrolled as an affiliate; the grant is escrowed and RELEASED incrementally to spendable store
// credit as you generate real affiliate commission worth 2× the grant. Vesting, not a loan: no clawback,
// nothing owed; if you stop, the unreleased remainder simply doesn't release. Body: { confirm: true }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await isEnabled("loyalty_program")) || !loyaltyUpfrontEnabled()) {
      return Response.json({ blocked: true, message: "The upfront option isn't available right now." }, { status: 403 });
    }

    const member = (await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0] || null;
    // PREMIUM ONLY: must be an enrolled loyalty member first.
    if (!member?.loyalty_enrolled) {
      return Response.json({ error: "premium_only", message: "The upfront option is for loyalty members. Join the rewards program first." }, { status: 403 });
    }
    if (member.upfront_mode === true) {
      return Response.json({ already: true, upfront: upfrontStatus(member), message: "You're already on the upfront plan." });
    }

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) {
      return Response.json({ error: "confirm_required", message: "Confirm to take your rewards up front and enroll as an affiliate." }, { status: 400 });
    }

    const plan = await enrollUpfront(String(member.id), user.id);
    const fresh = (await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0] || member;

    return Response.json({
      enrolled_upfront: true,
      affiliate: true,
      plan,   // { grant, target } — target is the 2× real-commission goal
      upfront: upfrontStatus(fresh),
      message: "You're on the upfront plan and enrolled as an affiliate. Your rewards unlock in steps as your affiliate commissions add up — no repayment, ever.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
