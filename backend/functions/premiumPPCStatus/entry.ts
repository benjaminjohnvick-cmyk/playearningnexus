import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { annualEarnCeiling, DAILY_EARN_CAP, round2, commitmentPace, isDefaulted, surveyMinutesPerDay, makeupPlan } from "../../sdk/premium-ppc.ts";
import { db } from "../../sdk/db.ts";

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
    let member = (members || []).find((m: Record<string, unknown>) => m.status === "active" || m.status === "ceiling_reached") ?? null;

    // Lazy DEFAULT check for up-front members: spent-out AND behind the survey pace → lock out of the
    // program (until a new slot opens; re-enrollment then requires lockout mode). Nothing is charged or
    // clawed back — the granted points stay banked in their balance.
    if (member && member.upfront_grant && member.status === "active" && isDefaulted(user as Record<string, unknown>, member)) {
      await base44.asServiceRole.entities.PremiumPPCMembership.update(String(member.id), { status: "locked_out", defaulted: true, defaulted_at: new Date().toISOString() }).catch(() => null);
      await db.remove("PremiumEnrollClaim", `pec_${user.id}`).catch(() => null);
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id, type: "premium_locked_out",
        title: "⏸️ Premium PPC surveys paused",
        message: "You've spent your points and fallen behind on the survey commitment, so PPC surveys are paused. You keep all your points. You can rejoin when a new advertiser slot opens — re-enrollment uses lockout mode to help you keep pace.",
        is_read: false,
      }).catch(() => null);
      member = { ...member, status: "locked_out", defaulted: true };
    }
    const pace = member && member.upfront_grant ? commitmentPace(member) : null;
    const makeup = member && member.upfront_grant ? makeupPlan(member) : null;

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
      model: member?.upfront_grant ? "upfront-grant" : "no-penalty-points",
      upfront_grant: !!member?.upfront_grant,
      grant_points: round2(member?.grant_points ?? 0),
      locked_out: member?.status === "locked_out",
      defaulted: !!member?.defaulted,
      lockout_mode_enabled: !!member?.lockout_mode_enabled,
      lockout_time: member?.lockout_time ?? null,
      survey_minutes_per_day: surveyMinutesPerDay(),
      survey_pace: pace,   // { requirement, expected, done, behind_by, behind, complete } for up-front members
      // Make-up plan: how many sessions/minutes to complete TODAY to stay on track or catch up missed days.
      makeup: makeup,      // { missed_days, sessions_today, remaining_sessions_today, required_minutes_today, makeup_window_end, ... }
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
