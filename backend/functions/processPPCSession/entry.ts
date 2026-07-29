import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { allowedEarn } from "../../sdk/earn-cap.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tier, minutesCompleted, questionsAnswered } = await req.json();

    const today = new Date().toISOString().split('T')[0];

    // Earnings per tier
    const earningsPerMinute = tier === 3 ? 1.0 : tier === 2 ? 1.0 : 0;
    const requiredMinutes = tier === 3 ? 240 : tier === 2 ? 8 : 0;
    const earnings = minutesCompleted * earningsPerMinute;
    const goalMet = minutesCompleted >= requiredMinutes;

    // Create/update session record
    const existingSessions = await base44.asServiceRole.entities.PPCSession.filter({
      user_id: user.id,
      tier,
      session_date: today
    });

    let session;
    if (existingSessions.length > 0) {
      session = await base44.asServiceRole.entities.PPCSession.update(existingSessions[0].id, {
        questions_answered: (existingSessions[0].questions_answered || 0) + questionsAnswered,
        minutes_completed: Math.max(existingSessions[0].minutes_completed || 0, minutesCompleted),
        earnings: Math.max(existingSessions[0].earnings || 0, earnings),
        goal_met: goalMet
      });
    } else {
      session = await base44.asServiceRole.entities.PPCSession.create({
        user_id: user.id,
        tier,
        session_date: today,
        questions_answered: questionsAnswered,
        minutes_completed: minutesCompleted,
        earnings,
        required_minutes: requiredMinutes,
        goal_met: goalMet
      });
    }

    // IDEMPOTENCY: earnings, tier progress, and referral commission are credited ONCE per (user, tier,
    // day). A later same-day submission only updates the session record above (accumulating minutes/
    // questions) and the survey-commitment tracking below — it never re-credits. This blocks replaying
    // the same session to inflate balance / complete tiers early / repeat referral payouts.
    const firstToday = existingSessions.length === 0;
    if (!firstToday) {
      try {
        const { markSurveyDay, surveyMinutesPerDay } = await import("../../sdk/premium-ppc.ts");
        if (goalMet || Number(minutesCompleted) >= surveyMinutesPerDay()) await markSurveyDay(user.id, Number(minutesCompleted));
      } catch { /* best-effort */ }
      return Response.json({ success: true, already_recorded_today: true, session_id: session.id, goal_met: goalMet });
    }

    // 50/50 revenue split: user gets half, then 10% platform fee on their share
    const userShare = earnings * 0.50;
    const feeAmount = userShare * 0.10;
    const rawNet = userShare - feeAmount;
    // Per-user daily earnings backstop (DAILY_EARN_CAP_USD; 0 = no cap → no change). Clamp the credited
    // amount to what the user may still earn today, accumulated across all earning paths via DailyEarnings.
    const earnAllow = await allowedEarn(base44, user.id, rawNet);
    const netAmount = earnAllow.allowed;

    await base44.asServiceRole.entities.PPCTransaction.create({
      user_id: user.id,
      transaction_type: 'ppc_earning',
      tier,
      amount: userShare,
      fee_amount: feeAmount,
      net_amount: netAmount,
      related_session_id: session.id,
      description: `Tier ${tier} PPC session — ${minutesCompleted} min, ${questionsAnswered} questions (50% share after split)`,
      status: 'completed'
    });

    // Update user balance — atomic compare-and-set so a double-submitted session can't double-credit.
    await adjustUserBalance(user.id, netAmount, { field: "current_balance" }).catch(() => null);

    // Record into DailyEarnings so the per-user daily cap accumulates across every earning path.
    if (netAmount > 0) {
      const earnDay = new Date().toISOString().slice(0, 10);
      const deRows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: user.id, date: earnDay }).catch(() => []);
      if ((deRows || []).length) {
        await base44.asServiceRole.entities.DailyEarnings.update(deRows[0].id, {
          total_earned: (deRows[0].total_earned || 0) + netAmount,
        }).catch(() => null);
      } else {
        await base44.asServiceRole.entities.DailyEarnings.create({
          user_id: user.id, date: earnDay, total_earned: netAmount,
        }).catch(() => null);
      }
    }

    // Premium up-front members: if they met today's survey quota, count it toward the year's commitment.
    try {
      const { markSurveyDay, surveyMinutesPerDay } = await import("../../sdk/premium-ppc.ts");
      // Pass today's cumulative minutes so extra minutes credit make-up sessions for missed days.
      if (goalMet || Number(minutesCompleted) >= surveyMinutesPerDay()) await markSurveyDay(user.id, Number(minutesCompleted));
    } catch { /* premium commitment tracking is best-effort */ }

    // Update PPCUserTier record
    const tierRecords = await base44.asServiceRole.entities.PPCUserTier.filter({ user_id: user.id });
    if (tierRecords.length > 0) {
      const tr = tierRecords[0];
      const updates = { total_ppc_earnings: (tr.total_ppc_earnings || 0) + netAmount };
      if (goalMet) {
        if (tier === 2) updates.tier2_days_active = (tr.tier2_days_active || 0) + 1;
        if (tier === 3) updates.tier3_days_active = (tr.tier3_days_active || 0) + 1;
        // Check tier 2 completion (365 days)
        if (tier === 2 && (tr.tier2_days_active || 0) + 1 >= 365) {
          updates.tier2_completed = true;
          updates.current_tier = 3;
          updates.tier3_start_date = today;
        }
      }
      await base44.asServiceRole.entities.PPCUserTier.update(tr.id, updates);
    } else {
      await base44.asServiceRole.entities.PPCUserTier.create({
        user_id: user.id,
        current_tier: tier,
        tier2_days_active: tier === 2 && goalMet ? 1 : 0,
        tier3_days_active: tier === 3 && goalMet ? 1 : 0,
        total_ppc_earnings: netAmount
      });
    }

    // Pay referral commission (10%) to referrer if exists
    if (goalMet && netAmount > 0) {
      const referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: user.id });
      if (referrals.length > 0) {
        const referral = referrals[0];
        const commission = netAmount * 0.10;
        const referrerRecords = await base44.asServiceRole.entities.PPCUserTier.filter({ user_id: referral.referrer_user_id });
        
        await base44.asServiceRole.entities.PPCTransaction.create({
          user_id: referral.referrer_user_id,
          transaction_type: 'referral_commission',
          tier,
          amount: commission,
          fee_amount: 0,
          net_amount: commission,
          related_user_id: user.id,
          description: `10% referral commission from ${user.full_name} Tier ${tier} session`,
          status: 'completed'
        });

        // Credit referrer balance atomically (compare-and-set) so concurrent sessions can't race.
        await adjustUserBalance(referral.referrer_user_id, commission, { field: "current_balance" }).catch(() => null);

        if (referrerRecords.length > 0) {
          await base44.asServiceRole.entities.PPCUserTier.update(referrerRecords[0].id, {
            total_referral_commissions: (referrerRecords[0].total_referral_commissions || 0) + commission
          });
        }
      }
    }

    return Response.json({
      success: true,
      gross_earnings: earnings,
      user_share: userShare,
      net_amount: netAmount,
      fee_amount: feeAmount,
      goal_met: goalMet,
      earnings_capped: earnAllow.capped,
      daily_cap: earnAllow.cap || 0,
      session_id: session.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});