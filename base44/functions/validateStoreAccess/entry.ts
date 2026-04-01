import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's daily earnings for today
    const today = new Date().toISOString().split('T')[0];
    const dailyEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({
      user_id: user.id,
      date: today
    });

    const todayEarnings = dailyEarnings.length > 0 ? dailyEarnings[0].amount_earned : 0;
    const minimumRequired = 3; // $3 minimum to access store

    const canAccess = todayEarnings >= minimumRequired;

    return Response.json({
      success: true,
      can_access: canAccess,
      today_earnings: todayEarnings,
      minimum_required: minimumRequired,
      earnings_needed: Math.max(0, minimumRequired - todayEarnings),
      message: canAccess 
        ? 'Store access granted' 
        : `Earn $${(minimumRequired - todayEarnings).toFixed(2)} more today to access the store`
    });

  } catch (error) {
    console.error('Error in validateStoreAccess:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});