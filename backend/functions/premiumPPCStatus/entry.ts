import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { annualEarnCeiling, DAILY_EARN_CAP, round2 } from "../../sdk/premium-ppc.ts";

// premiumPPCStatus — membership + earn-as-you-go ledger for the UI, plus the 1:1 slot availability.
//
// NO-PENALTY MODEL: shows POINTS EARNED and opportunity remaining (a positive tracker) and the
// count of active vs. missed days. There is no debt, no "amount owed", and nothing to collect.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const members = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ user_id: user.id });
    const member = (members || []).find((m: Record<string, unknown>) => m.status === "active" || m.status === "ceiling_reached") ?? null;

    // Daily engagement records (met/missed), most recent first.
    const days = member
      ? await base44.asServiceRole.entities.PremiumPPCCharge.filter({ membership_id: member.id }, "-date", 90)
      : [];

    // Slot availability (1:1 cap).
    const advertisers = await base44.asServiceRole.entities.User.filter({ ppc_grid_active: true });
    const all = await base44.asServiceRole.entities.PremiumPPCMembership.list("-created_date", 5000);
    const taken = new Set((all || [])
      .filter((m: Record<string, unknown>) => m.status === "active" || m.status === "ceiling_reached")
      .map((m: Record<string, unknown>) => m.advertiser_user_id));

    const ceiling = annualEarnCeiling();
    const earned = round2(member?.points_earned_total ?? 0);

    return Response.json({
      enrolled: !!member,
      membership: member,
      model: "no-penalty-points",
      daily_earn_cap: DAILY_EARN_CAP,
      annual_earn_ceiling: ceiling,
      points_earned: earned,
      remaining_to_earn: round2(Math.max(0, ceiling - earned)),
      met_days: round2(member?.met_days ?? 0),
      missed_days: round2(member?.missed_days ?? 0),
      streak: round2(member?.streak ?? 0),
      membership_status: member?.status ?? null,
      // Nothing is ever owed in this model.
      amount_owed: 0,
      days,
      slots: { advertisers: (advertisers || []).length, matched: taken.size, available: Math.max(0, (advertisers || []).length - taken.size) },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
