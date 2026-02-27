import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// BitLabs calls this URL when a survey is completed
// Set the postback URL in BitLabs dashboard to: {your_function_url}/bitlabsPostback
// With params: ?uid=[USER_ID]&reward=[REWARD]&survey_id=[SURVEY_ID]
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);

    // BitLabs sends these as query params
    const uid = url.searchParams.get('uid');
    const reward = parseFloat(url.searchParams.get('reward') || '0');
    const surveyId = url.searchParams.get('survey_id') || '';

    if (!uid || !reward) {
      return Response.json({ error: 'Missing uid or reward' }, { status: 400 });
    }

    // Validate request is from BitLabs using API key
    const apiKey = Deno.env.get('BITLABS_API_KEY');
    const token = url.searchParams.get('token') || req.headers.get('x-api-key');
    if (token && token !== apiKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all users and find by ID (uid = user.id)
    const users = await base44.asServiceRole.entities.User.list();
    const user = users.find(u => u.id === uid);
    if (!user) {
      return new Response('OK', { status: 200 }); // Return OK to prevent retries
    }

    // 50/50 split: user gets half the reward
    const userEarnings = reward / 2;
    const today = new Date().toISOString().split('T')[0];

    // Update or create DailyEarnings
    const dailyEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({
      user_id: uid,
      date: today
    });

    if (dailyEarnings.length > 0) {
      const current = dailyEarnings[0];
      await base44.asServiceRole.entities.DailyEarnings.update(current.id, {
        total_earned: (current.total_earned || 0) + userEarnings,
        total_surveys_completed: (current.total_surveys_completed || 0) + 1
      });
    } else {
      await base44.asServiceRole.entities.DailyEarnings.create({
        user_id: uid,
        date: today,
        total_earned: userEarnings,
        total_surveys_completed: 1
      });
    }

    // Update user's total balance
    await base44.asServiceRole.auth.updateUser(uid, {
      current_balance: (user.current_balance || 0) + userEarnings,
      total_earnings: (user.total_earnings || 0) + userEarnings
    });

    // Create transaction record
    await base44.asServiceRole.entities.Transaction.create({
      user_id: uid,
      amount: userEarnings,
      transaction_type: 'survey_completion',
      status: 'completed',
      description: `Survey completed (50% of $${reward.toFixed(2)} reward)`,
      payment_intent_id: surveyId
    });

    // Send in-app notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: uid,
      type: 'points_earned',
      title: '✅ Survey Completed!',
      message: `You earned $${userEarnings.toFixed(2)} from a survey. Keep going to reach your $3 daily goal!`,
      status: 'unread',
      delivery_method: ['in_app']
    });

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('BitLabs postback error:', error.message);
    return new Response('OK', { status: 200 }); // Always return OK to BitLabs
  }
});