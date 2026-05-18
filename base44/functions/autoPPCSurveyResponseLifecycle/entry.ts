import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const response = data;
    if (!response?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Credit earnings to respondent
      if (response.user_id && response.reward_amount) {
        const user = (await base44.asServiceRole.entities.User.filter({ id: response.user_id }))[0];
        if (user) {
          await base44.asServiceRole.entities.User.update(response.user_id, {
            total_earnings: (user.total_earnings || 0) + response.reward_amount
          });
          await base44.asServiceRole.entities.Notification.create({
            user_id: response.user_id,
            type: 'survey_completed',
            title: `💰 +$${response.reward_amount.toFixed(2)} Earned!`,
            message: `You completed a survey and earned $${response.reward_amount.toFixed(2)}. Keep going!`,
            is_read: false
          });
        }
        // Award XP
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: response.user_id,
          activity_type: 'survey_completed',
          points_earned: Math.floor((response.reward_amount || 0) * 20),
          metadata: { survey_id: response.survey_id }
        });
        // Record transaction
        await base44.asServiceRole.entities.PPCTransaction.create({
          user_id: response.user_id,
          survey_id: response.survey_id,
          amount: response.reward_amount,
          type: 'survey_earning',
          status: 'completed'
        });
      }

      // Update survey response count
      if (response.survey_id) {
        const survey = (await base44.asServiceRole.entities.PPCSurvey.filter({ id: response.survey_id }))[0];
        if (survey) {
          const newCount = (survey.response_count || 0) + 1;
          await base44.asServiceRole.entities.PPCSurvey.update(response.survey_id, {
            response_count: newCount
          });
          // Auto-close survey if target reached
          if (survey.target_responses && newCount >= survey.target_responses) {
            await base44.asServiceRole.entities.PPCSurvey.update(response.survey_id, { status: 'completed' });
          }
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});