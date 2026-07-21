import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch {
      isAdmin = true; // scheduler
    }
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const allUsers = await base44.asServiceRole.entities.User.list();
    const allPrefs = await base44.asServiceRole.entities.PayoutPreference.list();
    const allPayouts = await base44.asServiceRole.entities.Payout.list('-created_date', 500);
    const allDailyEarnings = await base44.asServiceRole.entities.DailyEarnings.list('-date', 1000);

    const predictions = [];

    for (const user of allUsers) {
      const pending = user.pending_earnings || 0;
      if (pending <= 0) continue;

      const pref = allPrefs.find(p => p.user_id === user.id);
      const userPayouts = allPayouts.filter(p => p.user_id === user.id && p.status === 'completed');
      const userEarnings = allDailyEarnings.filter(e => e.user_id === user.id).slice(0, 30);

      // Build context for AI
      const avgDailyEarning = userEarnings.length > 0
        ? userEarnings.reduce((s, e) => s + (e.total_earned || 0), 0) / userEarnings.length
        : 0;

      const payoutIntervals = [];
      for (let i = 1; i < userPayouts.length; i++) {
        const days = (new Date(userPayouts[i - 1].created_date) - new Date(userPayouts[i].created_date)) / (1000 * 60 * 60 * 24);
        if (days > 0) payoutIntervals.push(Math.round(days));
      }
      const avgInterval = payoutIntervals.length > 0
        ? payoutIntervals.reduce((a, b) => a + b, 0) / payoutIntervals.length
        : null;

      const lastPayout = userPayouts[0];
      const daysSinceLast = lastPayout
        ? Math.floor((Date.now() - new Date(lastPayout.created_date)) / (1000 * 60 * 60 * 24))
        : null;

      const prompt = `You are a payout optimization AI for GamerGain, a gaming rewards platform.

Analyze this user's payout profile and predict the optimal next payout date and reasoning:

User data:
- Current pending earnings: $${pending.toFixed(2)}
- Configured payout method: ${pref?.payout_method || 'not configured'}
- Configured frequency: ${pref?.payout_frequency || 'net_90'}
- Minimum threshold: $${pref?.minimum_payout_threshold || 50}
- Auto-payout enabled: ${pref?.auto_payout_enabled ?? false}
- Average daily earnings (last 30 days): $${avgDailyEarning.toFixed(2)}/day
- Past payouts count: ${userPayouts.length}
- Average days between payouts: ${avgInterval ? avgInterval.toFixed(0) + ' days' : 'no history'}
- Days since last payout: ${daysSinceLast !== null ? daysSinceLast + ' days' : 'never paid'}
- Account verified: ${pref?.is_verified ?? false}
- Today's date: ${new Date().toISOString().split('T')[0]}

Based on this data, determine:
1. Whether a payout should be triggered now or in the future
2. The optimal number of days from today to process the payout
3. The projected balance at that time
4. A brief reason (1 sentence)
5. A priority score (1-10, 10 = should pay immediately)`;

      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            should_pay_now: { type: 'boolean' },
            optimal_days_from_now: { type: 'number' },
            projected_balance: { type: 'number' },
            reason: { type: 'string' },
            priority_score: { type: 'number' },
            optimal_date: { type: 'string' }
          }
        }
      });

      predictions.push({
        user_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        pending_earnings: pending,
        avg_daily_earning: avgDailyEarning,
        days_since_last_payout: daysSinceLast,
        pref_frequency: pref?.payout_frequency || 'not_set',
        pref_threshold: pref?.minimum_payout_threshold || 50,
        pref_method: pref?.payout_method || 'not_set',
        ai_recommendation: aiResult
      });
    }

    // Sort by priority
    predictions.sort((a, b) => (b.ai_recommendation?.priority_score || 0) - (a.ai_recommendation?.priority_score || 0));

    return Response.json({ ok: true, predictions, analyzed_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});