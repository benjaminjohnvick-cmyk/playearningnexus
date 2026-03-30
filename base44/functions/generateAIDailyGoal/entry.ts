import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user's historical earnings data
    const dailyEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({
      user_id: user.id
    }).catch(() => []);
    
    const last30Days = dailyEarnings.slice(-30);
    const avgDailyEarnings = last30Days.reduce((sum, d) => sum + (d.total_earned || 0), 0) / (last30Days.length || 1);
    const maxEarningsDay = Math.max(...last30Days.map(d => d.total_earned || 0), 0);

    // Get available tasks/surveys
    const surveys = await base44.asServiceRole.entities.PPCSurvey.list().catch(() => []);
    const gameEngagements = await base44.asServiceRole.entities.GameEngagement.filter({
      user_id: user.id
    }).catch(() => []);

    const completionRate = gameEngagements.filter(g => g.status === 'completed').length / (gameEngagements.length || 1);
    const preferredType = completionRate > 0.6 ? 'games' : 'surveys';

    // Use AI to generate personalized daily goal
    const goalAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI earnings optimizer. Generate a personalized daily earnings goal for this user.

USER PROFILE:
- Average Daily Earnings: $${avgDailyEarnings.toFixed(2)}
- Best Day Ever: $${maxDailyEarningsDay.toFixed(2)}
- Total Lifetime Earnings: $${user.total_earnings || 0}
- Completion Preference: ${preferredType}
- Completion Rate: ${(completionRate * 100).toFixed(0)}%

AVAILABLE TASKS:
${surveys.slice(0, 15).map(s => `- ${s.survey_title} ($${s.payout || 5}, ~${s.estimated_time || 5}min)`).join('\n')}

Create an optimal daily goal that:
1. Is achievable but motivating (120-150% of average)
2. Provides specific task recommendations
3. Includes milestone incentives
4. Matches user's work style

Return JSON:
{
  "daily_goal_amount": 15.50,
  "rationale": "Based on your pattern...",
  "recommended_tasks": [
    {
      "task_name": "Survey Title",
      "reward": 10,
      "time_estimate": 5,
      "priority": "high"
    }
  ],
  "milestone_incentives": [
    {
      "amount": 5,
      "incentive": "25% boost on next survey"
    },
    {
      "amount": 10,
      "incentive": "Unlock premium survey access"
    },
    {
      "amount": 15.50,
      "incentive": "10% jackpot bonus + streak multiplier"
    }
  ],
  "motivational_message": "You can do this!"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          daily_goal_amount: { type: 'number' },
          rationale: { type: 'string' },
          recommended_tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task_name: { type: 'string' },
                reward: { type: 'number' },
                time_estimate: { type: 'number' },
                priority: { type: 'string' }
              }
            }
          },
          milestone_incentives: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                amount: { type: 'number' },
                incentive: { type: 'string' }
              }
            }
          },
          motivational_message: { type: 'string' }
        }
      }
    });

    return Response.json({
      success: true,
      goal: goalAnalysis,
      generatedAt: new Date().toISOString(),
      validFor: 'today'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});