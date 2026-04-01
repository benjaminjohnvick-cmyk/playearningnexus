import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body; // 'check_daily_earnings' or 'request_withdrawal'

    // Check today's earnings
    const today = new Date().toISOString().split('T')[0];
    const dailyEarnings = await base44.entities.DailyEarnings.filter({
      user_id: user.id,
      created_date: { $gte: `${today}T00:00:00Z` }
    });

    const totalToday = dailyEarnings.reduce((sum, d) => sum + (d.amount || 0), 0);
    const mandatoryAmount = 3; // $3/day mandatory

    if (action === 'check_daily_earnings') {
      return Response.json({
        earned_today: totalToday,
        mandatory_requirement: mandatoryAmount,
        requirement_met: totalToday >= mandatoryAmount,
        can_withdraw: totalToday >= mandatoryAmount
      });
    }

    if (action === 'request_withdrawal') {
      if (totalToday < mandatoryAmount) {
        return Response.json({
          success: false,
          error: `You must earn $${mandatoryAmount} today. Current: $${totalToday.toFixed(2)}`
        }, { status: 403 });
      }

      // Proceed with withdrawal
      const withdrawalAmount = body.amount;
      if (user.total_earnings < withdrawalAmount) {
        return Response.json({
          success: false,
          error: 'Insufficient earnings'
        }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: `Withdrawal of $${withdrawalAmount} approved`,
        processed_at: new Date().toISOString()
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});