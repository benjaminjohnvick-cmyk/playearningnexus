import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, user_id } = body;
    const targetUserId = user_id || user.id;

    // Fetch user context data
    const [payouts, dailyEarnings, referrals, purchases, users] = await Promise.all([
      base44.entities.Payout.filter({ user_id: targetUserId }),
      base44.entities.DailyEarnings.filter({ user_id: targetUserId }),
      base44.entities.Referral.filter({ referrer_user_id: targetUserId }),
      base44.entities.InAppPurchase.filter({ user_id: targetUserId }),
      base44.entities.User.filter({ id: targetUserId }),
    ]);

    const targetUser = users[0] || user;
    const totalEarnings = targetUser.total_earnings || 0;
    const totalSurveys = dailyEarnings.reduce((s, d) => s + (d.total_surveys_completed || 0), 0);
    const daysGoalMet = dailyEarnings.filter(d => d.goal_met).length;
    const activeReferrals = referrals.filter(r => r.status === 'active').length;
    const commissionEarned = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
    const memberDays = targetUser.created_date
      ? Math.floor((Date.now() - new Date(targetUser.created_date)) / (1000 * 60 * 60 * 24))
      : 0;

    // Last activity: most recent daily earnings date
    const sortedEarnings = [...dailyEarnings].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastActivityDate = sortedEarnings[0]?.date || null;
    const daysSinceActivity = lastActivityDate
      ? Math.floor((Date.now() - new Date(lastActivityDate)) / (1000 * 60 * 60 * 24))
      : 999;

    const userContext = {
      total_earnings: totalEarnings,
      total_surveys: totalSurveys,
      days_goal_met: daysGoalMet,
      active_referrals: activeReferrals,
      commission_earned: commissionEarned,
      member_days: memberDays,
      days_since_last_activity: daysSinceActivity,
      purchases: purchases.length,
    };

    if (action === 'suggest_tier') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a gamification expert for GamerGain, a survey & gaming rewards platform.

User stats:
- Total earnings: $${userContext.total_earnings}
- Surveys completed: ${userContext.total_surveys}
- Days hit $3 goal: ${userContext.days_goal_met}
- Active referrals: ${userContext.active_referrals}
- Commission earned: $${userContext.commission_earned}
- Member for ${userContext.member_days} days
- Days since last activity: ${userContext.days_since_last_activity}
- In-app purchases: ${userContext.purchases}

Current tiers available: Bronze (0 ref / $0), Silver (3 ref / $5), Gold (10 ref / $25), Platinum (25 ref / $75), Diamond (50 ref / $200).

Based on this user's activity pattern, suggest:
1. Their ideal personalized reward tier with a custom multiplier (e.g. 1.15x for someone between Bronze and Silver)
2. Exactly what actions they should take next to level up
3. A personalized motivational message (2 sentences max)
4. An estimated "days to next tier" based on their activity pace`,
        response_json_schema: {
          type: 'object',
          properties: {
            suggested_tier: { type: 'string' },
            custom_multiplier: { type: 'number' },
            current_position: { type: 'string', description: 'e.g. Upper Bronze, Lower Silver' },
            next_tier: { type: 'string' },
            actions_to_level_up: { type: 'array', items: { type: 'string' } },
            motivational_message: { type: 'string' },
            days_to_next_tier: { type: 'number' },
            confidence: { type: 'number', description: '0-100' },
          },
        },
      });
      return Response.json({ ok: true, action: 'suggest_tier', data: result });
    }

    if (action === 'churn_prediction') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a churn prediction specialist for GamerGain.

User activity:
- Days since last activity: ${userContext.days_since_last_activity}
- Total earnings: $${userContext.total_earnings}
- Surveys completed: ${userContext.total_surveys}
- Days goal met: ${userContext.days_goal_met}
- Member days: ${userContext.member_days}
- Active referrals: ${userContext.active_referrals}

Predict:
1. Churn risk score (0-100, 100 = will definitely churn)
2. Risk level: low / medium / high / critical
3. Top 3 churn signals detected
4. A personalized re-engagement reward offer to prevent churn (e.g. "Double XP for next 7 days", "Unlock Silver tier early with 1 more referral", "$0.50 bonus on next survey completed")
5. Best re-engagement channel: email / in_app / sms
6. Urgency: days before likely permanent churn`,
        response_json_schema: {
          type: 'object',
          properties: {
            churn_risk_score: { type: 'number' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            churn_signals: { type: 'array', items: { type: 'string' } },
            reward_offer: { type: 'string' },
            offer_value: { type: 'string' },
            re_engagement_channel: { type: 'string' },
            urgency_days: { type: 'number' },
            action_message: { type: 'string' },
          },
        },
      });
      return Response.json({ ok: true, action: 'churn_prediction', data: result });
    }

    if (action === 'generate_campaign') {
      // Admin only for campaign generation
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }

      const allUsers = await base44.asServiceRole.entities.User.list();
      const allEarnings = await base44.asServiceRole.entities.DailyEarnings.list('-date', 200);

      const activeUsers = allUsers.filter(u => u.total_earnings > 0).length;
      const avgEarnings = allUsers.reduce((s, u) => s + (u.total_earnings || 0), 0) / (allUsers.length || 1);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a growth marketing expert for GamerGain, a gaming survey rewards platform.

Platform stats:
- Total users: ${allUsers.length}
- Active earners: ${activeUsers}
- Average earnings per user: $${avgEarnings.toFixed(2)}
- Current date: ${new Date().toISOString().split('T')[0]}

Generate 3 creative, high-impact reward campaign ideas that will:
1. Boost user engagement and daily active users
2. Reward loyal users while re-engaging dormant ones
3. Encourage referrals and social sharing

For each campaign provide a specific rollout plan.`,
        response_json_schema: {
          type: 'object',
          properties: {
            campaigns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  tagline: { type: 'string' },
                  description: { type: 'string' },
                  campaign_type: { type: 'string', enum: ['survey_bonus', 'referral_boost', 'streak_reward', 'tier_accelerator', 'comeback_bonus'] },
                  target_segment: { type: 'string' },
                  reward_offer: { type: 'string' },
                  duration_days: { type: 'number' },
                  estimated_engagement_boost: { type: 'string' },
                  rollout_steps: { type: 'array', items: { type: 'string' } },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
              },
            },
          },
        },
      });
      return Response.json({ ok: true, action: 'generate_campaign', data: result });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});