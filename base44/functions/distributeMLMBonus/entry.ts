import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * distributeMLMBonus
 *
 * Called whenever a user earns from PPC ads or BitLabs surveys.
 * Logic:
 *  - Tracks cumulative PPC+BitLabs earnings for this user in their Referral record.
 *  - Every $8 earned (net to the user = $4, meaning $8 gross at 50/50 split),
 *    pays $0.25 website credit to each of the 3 upline referrers.
 *  - Also handles the one-time $5 direct referral website credit when a referred user
 *    first hits the $8 gross milestone.
 *
 * Payload:
 *  { user_id, amount, source: "ppc" | "bitlabs" }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id, amount, source } = await req.json();

    if (!user_id || !amount || !["ppc", "bitlabs"].includes(source)) {
      return Response.json({ error: 'Invalid payload. Required: user_id, amount, source (ppc|bitlabs)' }, { status: 400 });
    }

    // 1. Find the MLM node for this user
    const nodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id });
    if (!nodes.length) {
      return Response.json({ message: 'No MLM node for user — skipping', user_id });
    }
    const node = nodes[0];

    // 2. Find the Referral record where this user is the referred party
    const referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: user_id });
    if (!referrals.length) {
      return Response.json({ message: 'User has no referrer — skipping MLM bonus', user_id });
    }
    const referral = referrals[0];

    // 3. Update cumulative PPC+BitLabs earnings
    const newTotal = (referral.ppc_bitlabs_earnings || 0) + amount;
    const previousMilestone = referral.last_mlm_milestone || 0;
    const newMilestone = Math.floor(newTotal / 8) * 8; // nearest lower multiple of 8

    const bonusesToPay = (newMilestone - previousMilestone) / 8; // number of new $8 milestones crossed

    const payoutsLog = referral.mlm_payouts_log || [];
    let mlmBonusesPaid = referral.mlm_bonuses_paid || 0;

    const uplineIds = [
      referral.level_1_referrer_id,
      referral.level_2_referrer_id,
      referral.level_3_referrer_id
    ].filter(Boolean);

    const notificationPromises = [];

    // 4. For each new $8 milestone crossed, pay $0.25 to each upline (up to 3 levels)
    for (let i = 0; i < bonusesToPay; i++) {
      const milestoneCrossed = previousMilestone + (i + 1) * 8;
      const logEntry = { milestone: milestoneCrossed, paid_at: new Date().toISOString(), level_1_paid: false, level_2_paid: false, level_3_paid: false };

      for (let lvl = 0; lvl < uplineIds.length; lvl++) {
        const uplineUserId = uplineIds[lvl];
        // Get or create MLM node for upline user
        const uplineNodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id: uplineUserId });
        if (uplineNodes.length) {
          const uplineNode = uplineNodes[0];
          const newCredit = (uplineNode.website_credit_balance || 0) + 0.25;
          const newBonuses = (uplineNode.total_mlm_bonuses_received || 0) + 0.25;
          await base44.asServiceRole.entities.MLMNode.update(uplineNode.id, {
            website_credit_balance: newCredit,
            total_mlm_bonuses_received: newBonuses
          });
          if (lvl === 0) logEntry.level_1_paid = true;
          if (lvl === 1) logEntry.level_2_paid = true;
          if (lvl === 2) logEntry.level_3_paid = true;

          // Notify upline user
          notificationPromises.push(
            base44.asServiceRole.entities.Notification.create({
              user_id: uplineUserId,
              type: 'mlm_bonus',
              title: '💰 MLM Bonus Earned!',
              message: `You earned $0.25 website credit — your Level ${lvl + 1} downline member just hit a $8 earning milestone on GamerGain!`,
              is_read: false
            }).catch(() => {})
          );
        }
      }

      payoutsLog.push(logEntry);
      mlmBonusesPaid += 1;

      // 5. First $8 milestone: also pay the direct referrer the $5 direct referral credit
      if (milestoneCrossed === 8 && !referral.milestone_4_paid && uplineIds[0]) {
        const level1Nodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id: uplineIds[0] });
        if (level1Nodes.length) {
          const l1 = level1Nodes[0];
          await base44.asServiceRole.entities.MLMNode.update(l1.id, {
            website_credit_balance: (l1.website_credit_balance || 0) + 5,
            direct_referral_credits_earned: (l1.direct_referral_credits_earned || 0) + 5,
            total_referrals_converted: (l1.total_referrals_converted || 0) + 1
          });
          notificationPromises.push(
            base44.asServiceRole.entities.Notification.create({
              user_id: uplineIds[0],
              type: 'referral_bonus',
              title: '🎉 $5 Referral Credit Earned!',
              message: `Your referred user just hit their first $8 milestone on GamerGain! You've earned $5 website credit.`,
              is_read: false
            }).catch(() => {})
          );
        }
      }
    }

    // 6. Update the Referral record
    await base44.asServiceRole.entities.Referral.update(referral.id, {
      ppc_bitlabs_earnings: newTotal,
      last_mlm_milestone: newMilestone,
      mlm_bonuses_paid: mlmBonusesPaid,
      mlm_payouts_log: payoutsLog,
      milestone_4_paid: newMilestone >= 8 ? true : referral.milestone_4_paid
    });

    // 7. Update node's total downline earnings
    await base44.asServiceRole.entities.MLMNode.update(node.id, {
      total_downline_ppc_bitlabs_earnings: (node.total_downline_ppc_bitlabs_earnings || 0) + amount
    });

    await Promise.all(notificationPromises);

    return Response.json({
      success: true,
      user_id,
      new_total: newTotal,
      milestones_crossed: bonusesToPay,
      bonuses_distributed: bonusesToPay * uplineIds.length * 0.25
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});