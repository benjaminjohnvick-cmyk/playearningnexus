import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Batch Daily Goal Generator
 * Scheduled daily: for each active user, generates and persists a personalized AI daily goal.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const allUsers = await base44.asServiceRole.entities.User.list('-updated_date', 300);
    const allSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' });
    const allEarnings = await base44.asServiceRole.entities.DailyEarnings.list('-date', 5000);

    let generated = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const user of allUsers) {
      // Only process users active in last 14 days
      const daysSinceActive = (Date.now() - new Date(user.updated_date)) / (1000 * 60 * 60 * 24);
      if (daysSinceActive > 14) continue;

      const userEarnings = allEarnings.filter(e => e.user_id === user.id).slice(0, 30);
      const avgDaily = userEarnings.reduce((s, e) => s + (e.total_earned || 0), 0) / (userEarnings.length || 1);
      const maxDay = Math.max(...userEarnings.map(e => e.total_earned || 0), 0);

      const goalAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate a personalized daily earning goal for a GamerGain user.
User: ${user.full_name || 'User'}
Avg daily earnings (last 30 days): $${avgDaily.toFixed(2)}
Best day: $${maxDay.toFixed(2)}
Total lifetime: $${(user.total_earnings || 0).toFixed(2)}

Available surveys: ${allSurveys.slice(0, 10).map(s => `${s.survey_title} ($${s.payout || 1})`).join(', ')}

Set a goal that is 120-150% of average and achievable today.

Return JSON: { "daily_goal_amount": number, "motivational_message": "string", "top_task": "string" }`,
        response_json_schema: {
          type: 'object',
          properties: {
            daily_goal_amount: { type: 'number' },
            motivational_message: { type: 'string' },
            top_task: { type: 'string' }
          }
        }
      });

      // Notify user
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id,
        type: 'daily_goal',
        title: `🎯 Today's Goal: $${(goalAnalysis.daily_goal_amount || 3).toFixed(2)}`,
        message: goalAnalysis.motivational_message || 'Complete surveys today to hit your goal!',
        status: 'unread',
        delivery_method: ['in_app'],
        action_url: '/UserDashboard',
        icon: 'target',
        metadata: { goal_amount: goalAnalysis.daily_goal_amount, top_task: goalAnalysis.top_task, date: today }
      });

      generated++;
    }

    return Response.json({ success: true, goals_generated: generated, date: today });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});