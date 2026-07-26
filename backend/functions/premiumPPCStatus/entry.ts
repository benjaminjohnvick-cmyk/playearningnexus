import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { advanceLimit, liveChargesEnabled, round2 } from "../../sdk/premium-ppc.ts";

// premiumPPCStatus — membership + ledger for the UI, plus the 1:1 slot availability.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const members = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ user_id: user.id });
    const member = (members || []).find((m: Record<string, unknown>) => m.status === "active" || m.status === "repaid") ?? null;

    const charges = member
      ? await base44.asServiceRole.entities.PremiumPPCCharge.filter({ membership_id: member.id }, "-date", 90)
      : [];

    // Slot availability (1:1 cap).
    const advertisers = await base44.asServiceRole.entities.User.filter({ ppc_grid_active: true });
    const all = await base44.asServiceRole.entities.PremiumPPCMembership.list("-created_date", 5000);
    const taken = new Set((all || [])
      .filter((m: Record<string, unknown>) => m.status === "active" || m.status === "repaid")
      .map((m: Record<string, unknown>) => m.advertiser_user_id));

    const disbursed = round2(member?.advance_disbursed ?? 0);
    const repaid = round2(member?.repaid_to_advertiser ?? 0);

    return Response.json({
      enrolled: !!member,
      membership: member,
      advance_limit: advanceLimit(),
      advance_disbursed: disbursed,
      repaid_to_advertiser: repaid,
      outstanding_to_advertiser: round2(Math.max(0, disbursed - repaid)),
      social_credit_granted_to_advertiser: round2(member?.social_credit_to_advertiser ?? 0),
      charges,
      slots: { advertisers: (advertisers || []).length, matched: taken.size, available: Math.max(0, (advertisers || []).length - taken.size) },
      live_mode: liveChargesEnabled(),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
