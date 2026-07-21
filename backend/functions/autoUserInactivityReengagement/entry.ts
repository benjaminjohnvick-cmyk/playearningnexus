import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: identify 30-day inactive users and trigger personalized RetentionCampaigns
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const results = [];

    // Get recent activity to find active user IDs
    const recentActivity = await base44.asServiceRole.entities.UserActivity.list('-created_date', 200);
    const activeUserIds = new Set(
      recentActivity.filter(a => a.created_date >= thirtyDaysAgo).map(a => a.user_id).filter(Boolean)
    );

    // Get users who haven't been active
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 100);
    const inactiveUsers = allUsers.filter(u => {
      const isInactive = !activeUserIds.has(u.id);
      const accountOldEnough = new Date(u.created_date) < new Date(now - 35 * 24 * 60 * 60 * 1000);
      return isInactive && accountOldEnough;
    });

    for (const user of inactiveUsers.slice(0, 20)) {
      // Check if already in an active retention campaign
      const existing = await base44.asServiceRole.entities.RetentionCampaign.filter({
        user_id: user.id, status: 'triggered'
      });
      if (existing.length > 0) continue;

      // AI-generate personalized comeback message
      const aiMsg = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a short, personalized re-engagement message for a gaming platform user who hasn't logged in for 30+ days.
User: ${user.full_name || 'Gamer'}
Earnings so far: $${(user.total_earnings || 0).toFixed(2)}
Keep it warm, exciting, mention they may have missed earnings and new games. Max 2 sentences.`,
      });

      const bonusAmount = (user.total_earnings || 0) > 10 ? 2.00 : 1.00;

      const campaign = await base44.asServiceRole.entities.RetentionCampaign.create({
        user_id: user.id,
        campaign_type: 'churn_comeback',
        incentive_type: 'standard',
        bonus_amount: bonusAmount,
        churn_score: 80,
        status: 'triggered',
        expiry_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });

      // Send notification
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id,
        type: 'comeback_bonus',
        title: `🎮 We Miss You! $${bonusAmount} Comeback Bonus`,
        message: aiMsg + ` Claim your $${bonusAmount} comeback bonus — expires in 7 days!`,
        is_read: false
      });

      // Send email if available
      if (user.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `🎮 GamerGain misses you — $${bonusAmount} waiting for you!`,
          body: `${aiMsg}\n\nWe've reserved a $${bonusAmount} comeback bonus just for you — but it expires in 7 days!\n\nLog back in at gamergain.com to claim it and see what's new.`
        });
      }

      // Update campaign status to email_sent
      await base44.asServiceRole.entities.RetentionCampaign.update(campaign.id, { status: 'email_sent' });
      results.push(user.id);
    }

    return Response.json({ ok: true, reengaged: results.length, user_ids: results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});