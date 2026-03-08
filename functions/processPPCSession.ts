import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
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

    // Record PPC earning transaction with 10% fee deducted
    const feeAmount = earnings * 0.10;
    const netAmount = earnings - feeAmount;

    await base44.asServiceRole.entities.PPCTransaction.create({
      user_id: user.id,
      transaction_type: 'ppc_earning',
      tier,
      amount: earnings,
      fee_amount: feeAmount,
      net_amount: netAmount,
      related_session_id: session.id,
      description: `Tier ${tier} PPC session — ${minutesCompleted} min, ${questionsAnswered} questions`,
      status: 'completed'
    });

    // Update user balance
    const currentBalance = user.current_balance || 0;
    await base44.auth.updateMe({ current_balance: currentBalance + netAmount });

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

        // Credit referrer balance
        const referrerUser = await base44.asServiceRole.entities.User.filter({ id: referral.referrer_user_id });
        if (referrerUser.length > 0) {
          const ru = referrerUser[0];
          await base44.asServiceRole.entities.User.update(ru.id, {
            current_balance: (ru.current_balance || 0) + commission
          });
        }

        if (referrerRecords.length > 0) {
          await base44.asServiceRole.entities.PPCUserTier.update(referrerRecords[0].id, {
            total_referral_commissions: (referrerRecords[0].total_referral_commissions || 0) + commission
          });
        }
      }
    }

    return Response.json({
      success: true,
      earnings,
      net_amount: netAmount,
      fee_amount: feeAmount,
      goal_met: goalMet,
      session_id: session.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});