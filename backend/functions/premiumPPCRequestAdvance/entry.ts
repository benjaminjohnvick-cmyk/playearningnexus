import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { round2 } from "../../sdk/premium-ppc.ts";

// premiumPPCRequestAdvance — disburse up to 50% of the grid price ($1,460) as in-store credit.
// The user keeps this as store credit; they repay it to the matched advertiser over the year by
// staying active (missed days are charged and refunded to the advertiser — see the reconcile job).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const members = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ user_id: user.id, status: "active" });
    const member = (members || [])[0];
    if (!member) return Response.json({ error: "No active Premium PPC membership. Enroll first." }, { status: 400 });

    const remaining = round2((member.advance_limit ?? 0) - (member.advance_disbursed ?? 0));
    if (remaining <= 0) {
      return Response.json({ error: "You have already received the maximum advance.", total_disbursed: member.advance_disbursed }, { status: 400 });
    }
    const requested = body.amount != null ? round2(body.amount) : remaining;
    if (requested <= 0) return Response.json({ error: "Requested amount must be > 0." }, { status: 400 });
    const amount = Math.min(requested, remaining);

    // Grant in-store credit.
    const balance = round2(Number(user.current_balance ?? 0) + amount);
    await base44.asServiceRole.entities.User.update(user.id, { current_balance: balance });

    const newDisbursed = round2((member.advance_disbursed ?? 0) + amount);
    await base44.asServiceRole.entities.PremiumPPCMembership.update(member.id, { advance_disbursed: newDisbursed });

    await base44.asServiceRole.entities.Transaction.create({
      user_id: user.id,
      type: "premium_ppc_advance",
      amount,
      method: "store_credit",
      status: "completed",
      membership_id: member.id,
      note: `Premium PPC advance (in-store credit). Repaid to matched advertiser via activity.`,
      at: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({
      success: true,
      advance_granted: amount,
      total_disbursed: newDisbursed,
      remaining_advance: round2((member.advance_limit ?? 0) - newDisbursed),
      new_balance: balance,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
