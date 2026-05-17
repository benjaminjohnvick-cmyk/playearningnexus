import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
    let campaignsCreated = 0;
    let emailsSent = 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const user of users) {
      // Skip users with recent campaigns
      const existingCampaigns = await base44.asServiceRole.entities.RetentionCampaign.filter({ user_id: user.id, status: 'triggered' });
      if (existingCampaigns.length > 0) continue;

      // Identify at-risk: no activity in 30 days but was active before
      const lastActive = user.updated_date || user.created_date;
      if (lastActive > thirtyDaysAgo) continue; // Still active

      // Calculate churn score
      const earnings = user.total_earnings || 0;
      let churnScore = 70; // Base churn score for inactive users
      if (earnings > 50) churnScore -= 20; // High earners less likely to churn fully
      if (earnings > 100) churnScore -= 10;

      // Determine incentive tier
      let incentiveType = 'standard';
      let bonusAmount = 1.0;
      if (churnScore >= 80) { incentiveType = 'premium'; bonusAmount = 5.0; }
      else if (churnScore >= 70) { incentiveType = 'enhanced'; bonusAmount = 2.5; }

      const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      await base44.asServiceRole.entities.RetentionCampaign.create({
        user_id: user.id,
        campaign_type: 'churn_comeback',
        incentive_type: incentiveType,
        bonus_amount: bonusAmount,
        churn_score: churnScore,
        status: 'triggered',
        expiry_date: expiry
      });
      campaignsCreated++;

      // Send comeback email
      if (user.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: `We miss you, ${user.full_name || 'Gamer'}! Here's a $${bonusAmount} comeback bonus 🎮`,
          body: `Hey ${user.full_name || 'there'},\n\nWe noticed you haven't been on GamerGain lately. We'd love to have you back!\n\nAs a special comeback offer, we're giving you a $${bonusAmount} bonus when you complete your next survey.\n\nThis offer expires in 14 days. Come back and start earning again!\n\nhttps://gamergain.com\n\nThe GamerGain Team`
        });
        await base44.asServiceRole.entities.RetentionCampaign.update(
          (await base44.asServiceRole.entities.RetentionCampaign.filter({ user_id: user.id, status: 'triggered' }))[0]?.id,
          { status: 'email_sent' }
        );
        emailsSent++;
      }
    }

    return Response.json({ success: true, campaignsCreated, emailsSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});