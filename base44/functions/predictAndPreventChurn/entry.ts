import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch users with subscription data
    const users = await base44.entities.User.list('-created_date', 200);
    let interventionsTriggered = 0;
    const atRiskUsers = [];

    for (const appUser of users) {
      try {
        // Get subscription status
        const subscriptions = await base44.entities.UserSubscription.filter({
          user_id: appUser.id
        });

        if (!subscriptions || subscriptions.length === 0) continue;

        const subscription = subscriptions[0];
        const daysSinceSignup = Math.floor(
          (new Date() - new Date(appUser.created_date)) / (1000 * 60 * 60 * 24)
        );
        const daysSinceLastActivity = appUser.last_activity_date 
          ? Math.floor((new Date() - new Date(appUser.last_activity_date)) / (1000 * 60 * 60 * 24))
          : daysSinceSignup;

        // Use AI to assess churn risk
        const churnAssessment = await base44.integrations.Core.InvokeLLM({
          prompt: `Assess churn risk for this user and recommend intervention strategy.

User Profile:
- Days as Customer: ${daysSinceSignup}
- Days Since Last Activity: ${daysSinceLastActivity}
- Subscription Tier: ${subscription.tier || 'free'}
- Status: ${subscription.status}
- Credits Remaining: ${subscription.ai_credits_remaining || 0}

Return JSON with:
1. churn_risk: 0-100 (0=no risk, 100=immediate churn)
2. risk_factors: array of issues identified
3. intervention_type: "none", "discount_offer", "reengagement_email", "feature_unlock", "personalized_goal"
4. confidence: 0-100`,
          response_json_schema: {
            type: 'object',
            properties: {
              churn_risk: { type: 'number' },
              risk_factors: { type: 'array', items: { type: 'string' } },
              intervention_type: { type: 'string' },
              confidence: { type: 'number' }
            },
            required: ['churn_risk', 'risk_factors', 'intervention_type', 'confidence']
          }
        });

        if (churnAssessment.churn_risk >= 65 && churnAssessment.confidence >= 70) {
          // Auto-trigger intervention
          let interventionExecuted = false;

          if (churnAssessment.intervention_type === 'discount_offer') {
            await base44.integrations.Core.SendEmail({
              to: appUser.email,
              subject: '🎁 Exclusive Offer: 30% Off Your Next Month',
              body: `We noticed you haven't been active recently. Here's an exclusive offer to get you back in action!\n\nUse code: COMEBACK30 for 30% off your next subscription month.\n\nWe miss you!`,
              from_name: 'GamerGain Team'
            });
            interventionExecuted = true;
          } else if (churnAssessment.intervention_type === 'reengagement_email') {
            await base44.integrations.Core.SendEmail({
              to: appUser.email,
              subject: '👋 We Created Something New Just For You',
              body: `Hi ${appUser.full_name}! New surveys and challenges are waiting. Come back and see what\'s changed.\n\nClick here to jump back in: [app_link]`,
              from_name: 'GamerGain Team'
            });
            interventionExecuted = true;
          }

          if (interventionExecuted) {
            interventionsTriggered++;
          }

          atRiskUsers.push({
            user_id: appUser.id,
            user_email: appUser.email,
            churn_risk: churnAssessment.churn_risk,
            risk_factors: churnAssessment.risk_factors,
            intervention: churnAssessment.intervention_type,
            executed: interventionExecuted,
            awaiting_review: !interventionExecuted
          });
        }
      } catch (error) {
        console.error(`Churn assessment failed for user ${appUser.id}:`, error);
      }
    }

    return Response.json({
      users_analyzed: users.length,
      at_risk_users: atRiskUsers.length,
      interventions_triggered: interventionsTriggered,
      at_risk_details: atRiskUsers.slice(0, 50),
      requires_review: atRiskUsers.some(u => u.awaiting_review)
    });
  } catch (error) {
    console.error('Churn prediction error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});