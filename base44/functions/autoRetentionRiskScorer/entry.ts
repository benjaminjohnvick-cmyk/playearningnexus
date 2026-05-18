import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Daily: AI-score users for retention risk and auto-trigger RetentionCampaigns
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const results = { scored: 0, campaigns_triggered: 0 };

    const users = await base44.asServiceRole.entities.User.list('-created_date', 80);

    for (const user of users) {
      // Check recent activity
      const recentActivity = await base44.asServiceRole.entities.UserActivity.filter({ user_id: user.id });
      const recentEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: user.id });
      const lastActivity = recentActivity.length > 0
        ? recentActivity.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0]
        : null;

      const daysSinceActivity = lastActivity
        ? (now - new Date(lastActivity.created_date)) / (1000 * 60 * 60 * 24)
        : 30;

      const riskScore = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate churn risk score for gaming platform user:
Days since last activity: ${Math.floor(daysSinceActivity)}
Total earnings: $${(user.total_earnings || 0).toFixed(2)}
Activity count (lifetime): ${recentActivity.length}
Account age days: ${Math.floor((now - new Date(user.created_date)) / (1000 * 60 * 60 * 24))}

Return: risk_score (0-100, higher = more likely to churn), risk_tier (low/medium/high/critical), trigger_campaign (true/false)`,
        response_json_schema: {
          type: 'object',
          properties: {
            risk_score: { type: 'number' },
            risk_tier: { type: 'string' },
            trigger_campaign: { type: 'boolean' }
          }
        }
      });

      // Upsert RetentionRisk
      const existing = await base44.asServiceRole.entities.RetentionRisk.filter({ user_id: user.id });
      const riskData = {
        user_id: user.id,
        risk_score: riskScore.risk_score,
        risk_tier: riskScore.risk_tier,
        days_since_activity: Math.floor(daysSinceActivity),
        last_assessed_at: now.toISOString()
      };
      if (existing.length > 0) {
        await base44.asServiceRole.entities.RetentionRisk.update(existing[0].id, riskData);
      } else {
        await base44.asServiceRole.entities.RetentionRisk.create(riskData);
      }

      results.scored++;

      // Trigger campaign for high/critical risk users
      if (riskScore.trigger_campaign && riskScore.risk_score >= 70) {
        const existingCampaign = await base44.asServiceRole.entities.RetentionCampaign.filter({
          user_id: user.id, status: 'triggered'
        });
        if (existingCampaign.length === 0) {
          await base44.asServiceRole.entities.RetentionCampaign.create({
            user_id: user.id,
            campaign_type: 'churn_comeback',
            incentive_type: riskScore.risk_tier === 'critical' ? 'premium' : 'enhanced',
            bonus_amount: riskScore.risk_tier === 'critical' ? 3.00 : 1.50,
            churn_score: riskScore.risk_score,
            status: 'triggered',
            expiry_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
          await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'retention_offer',
            title: `🎮 Special Offer Just for You!`,
            message: `We've noticed you haven't been around lately. Here's an exclusive bonus to welcome you back — valid for 7 days only!`,
            is_read: false
          });
          results.campaigns_triggered++;
        }
      }
    }

    return Response.json({ ok: true, ...results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});