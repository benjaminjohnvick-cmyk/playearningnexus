import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  annualEarnCeiling, BUSINESS_REFUND_PER_DAY, hasDoubled, round2, SOCIAL_CREDIT_PER_DAY, utcDay,
} from "../../sdk/premium-ppc.ts";
import { dailyBoostCap, LAPSE_AFTER_DAYS, streakMultiplier } from "../../sdk/premium-boost.ts";

// premiumPPCDailyReconcile — runs once/day (scheduler, service token). NO-PENALTY model with legal
// engagement boosts:
//   • On an ACTIVE day the member earns a premium BOOST on top of their normal activity —
//     FRONT-LOADED (big early, an "upfront" feel), STREAK-multiplied (consistency pays more), and
//     capped to the annual ceiling.
//   • A MISSED day costs NOTHING. After LAPSE_AFTER_DAYS consecutive inactive days, premium status
//     simply LAPSES to free (a lost benefit, never a debt); it reactivates on the next active day.
//   • Advertisers earn pay-for-performance credit on active days (until they've doubled).
// Idempotent per (member, day).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const body = await req.json().catch(() => ({}));
    if (!user || (user.role !== "admin" && body.scheduled !== true)) {
      return Response.json({ error: "Forbidden (admin/scheduler only)." }, { status: 403 });
    }

    const today = utcDay();
    const active = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ status: "active" }, "-created_date", 5000);
    const lapsed = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ status: "lapsed" }, "-created_date", 5000);
    const members = [...(active || []), ...(lapsed || [])];

    let processed = 0, boostedDays = 0, missedDays = 0, lapsedCount = 0, skipped = 0;
    let totalBoost = 0, totalRefund = 0, totalSocial = 0;
    const details: unknown[] = [];

    for (const m of members) {
      // Idempotency: already processed this member today?
      const todays = await base44.asServiceRole.entities.PremiumPPCCharge.filter({ membership_id: m.id, date: today });
      if ((todays || []).length) { skipped++; continue; }
      processed++;

      // How much did the user earn today from normal activity?
      const earnRows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: m.user_id });
      const earnedToday = round2((earnRows || [])
        .filter((e: Record<string, unknown>) => String(e.date ?? e.created_date ?? "").slice(0, 10) === today)
        .reduce((s: number, e: Record<string, unknown>) => s + (Number(e.amount ?? e.total_earned) || 0), 0));
      const isActive = earnedToday > 0;

      const ceiling = annualEarnCeiling();
      const priorPoints = round2(m.points_earned_total ?? 0);
      const enrolledAt = String(m.enrolled_at ?? m.created_date ?? new Date().toISOString());
      const dayNum = Math.max(1, Math.floor((Date.now() - new Date(enrolledAt).getTime()) / (24 * 60 * 60 * 1000)) + 1);

      if (!isActive) {
        // Missed day — nothing owed, nothing charged. Track the streak break + possible lapse.
        missedDays++;
        const daysSinceActive = m.last_active_date
          ? Math.floor((Date.now() - new Date(String(m.last_active_date)).getTime()) / (24 * 60 * 60 * 1000))
          : 999;
        const willLapse = m.status !== "lapsed" && daysSinceActive >= LAPSE_AFTER_DAYS;
        if (willLapse) lapsedCount++;
        await base44.asServiceRole.entities.PremiumPPCMembership.update(m.id, {
          streak: 0,
          missed_days: round2((m.missed_days ?? 0) + 1),
          status: willLapse ? "lapsed" : m.status,
          last_reconciled_date: today,
        }).catch(() => null);
        await base44.asServiceRole.entities.PremiumPPCCharge.create({
          membership_id: m.id, user_id: m.user_id, advertiser_user_id: m.advertiser_user_id,
          date: today, earned_today: 0, boost_granted: 0, amount_charged: 0,
          status: willLapse ? "lapsed" : "missed", created_at: new Date().toISOString(),
        }).catch(() => null);
        details.push({ member: m.id, status: willLapse ? "lapsed" : "missed" });
        continue;
      }

      // ACTIVE — grant the front-loaded, streak-multiplied boost, capped to the remaining ceiling.
      const newStreak = round2((m.streak ?? 0) + 1);
      const cap = dailyBoostCap(dayNum);
      const remaining = round2(Math.max(0, ceiling - priorPoints));
      const boost = round2(Math.min(cap * streakMultiplier(newStreak), remaining));

      if (boost > 0) {
        const urows = await base44.asServiceRole.entities.User.filter({ id: m.user_id });
        const bal = round2(Number((urows || [])[0]?.current_balance ?? 0));
        await base44.asServiceRole.entities.User.update(m.user_id, { current_balance: round2(bal + boost) }).catch(() => null);
      }

      // Advertiser pay-for-performance on active days (until they've doubled their investment).
      const advRows = await base44.asServiceRole.entities.User.filter({ id: m.advertiser_user_id });
      const adv = (advRows || [])[0] ?? {};
      const doubled = hasDoubled(Number(adv.ppc_orders_value_delivered ?? 0));
      const refund = round2(BUSINESS_REFUND_PER_DAY);
      const social = doubled ? 0 : round2(SOCIAL_CREDIT_PER_DAY);
      if (m.advertiser_user_id) {
        await base44.asServiceRole.entities.User.update(m.advertiser_user_id, {
          refund_credit_balance: round2(Number(adv.refund_credit_balance ?? 0) + refund),
          social_marketing_credit_balance: round2(Number(adv.social_marketing_credit_balance ?? 0) + social),
        }).catch(() => null);
      }

      const newPoints = round2(priorPoints + boost);
      boostedDays++;
      await base44.asServiceRole.entities.PremiumPPCMembership.update(m.id, {
        points_earned_total: newPoints,
        streak: newStreak,
        met_days: round2((m.met_days ?? 0) + 1),
        last_active_date: today,
        last_reconciled_date: today,
        business_refund_credit: round2((m.business_refund_credit ?? 0) + refund),
        social_credit_to_advertiser: round2((m.social_credit_to_advertiser ?? 0) + social),
        status: newPoints >= ceiling ? "ceiling_reached" : "active",
      }).catch(() => null);

      await base44.asServiceRole.entities.PremiumPPCCharge.create({
        membership_id: m.id, user_id: m.user_id, advertiser_user_id: m.advertiser_user_id,
        date: today, earned_today: earnedToday, boost_granted: boost, streak: newStreak, day_number: dayNum,
        business_refund_credit: refund, advertiser_social_credit: social, amount_charged: 0, status: "earned",
        created_at: new Date().toISOString(),
      }).catch(() => null);

      totalBoost = round2(totalBoost + boost);
      totalRefund = round2(totalRefund + refund);
      totalSocial = round2(totalSocial + social);
      details.push({ member: m.id, status: "earned", boost, streak: newStreak, day: dayNum });
    }

    return Response.json({
      success: true, date: today, model: "no-penalty-points-boost",
      processed, boosted_days: boostedDays, missed_days: missedDays, lapsed: lapsedCount, skipped,
      total_boost_granted: totalBoost, total_refunded_to_advertisers: totalRefund, total_social_credit_granted: totalSocial,
      note: "Boost is earned (front-loaded + streak); missed days cost nothing; status lapses (no debt).",
      details,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
