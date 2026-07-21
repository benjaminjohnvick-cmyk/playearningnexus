import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * AI Payout Insight
 * Analyzes a user's earning history, payout method, and platform schedules
 * to forecast the optimal next payout date + amount.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { notify_me } = await req.json().catch(() => ({}));

    // Fetch user data
    const [payouts, dailyEarnings, payoutPrefs] = await Promise.all([
      base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 20),
      base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 30),
      base44.entities.PayoutPreference.filter({ user_id: user.id })
    ]);

    const pref = payoutPrefs[0];
    const balance = user.current_balance || 0;
    const totalEarned = user.total_earnings || 0;

    // Compute avg daily earnings
    const recentEarnings = dailyEarnings.slice(0, 14);
    const avgDailyEarning = recentEarnings.length > 0
      ? recentEarnings.reduce((s, d) => s + (d.amount || 0), 0) / recentEarnings.length
      : 0;

    const lastPayout = payouts[0];
    const completedPayouts = payouts.filter(p => p.status === 'completed');
    const avgPayoutAmount = completedPayouts.length > 0
      ? completedPayouts.reduce((s, p) => s + p.amount, 0) / completedPayouts.length : 0;

    const insight = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a financial AI advisor analyzing a user's payout history for GamerGain, a survey rewards platform.

User Financial Data:
- Current Balance: $${balance.toFixed(2)}
- Total Earned All-Time: $${totalEarned.toFixed(2)}
- Avg Daily Earning (last 14 days): $${avgDailyEarning.toFixed(2)}
- Payout Method: ${pref?.payout_method || 'paypal'}
- Auto-Payout Enabled: ${pref?.auto_payout_enabled || false}
- Minimum Payout Threshold: $${pref?.minimum_payout_threshold || 50}
- Payout Frequency Setting: ${pref?.payout_frequency || 'net_90'}
- Last Payout Date: ${lastPayout?.created_date ? new Date(lastPayout.created_date).toLocaleDateString() : 'Never'}
- Last Payout Amount: $${lastPayout?.amount?.toFixed(2) || '0'}
- Average Historical Payout: $${avgPayoutAmount.toFixed(2)}
- Total Payouts Made: ${completedPayouts.length}
- Today: ${new Date().toISOString().split('T')[0]}

Payment Method Processing Times (approximate):
- PayPal: 1-3 business days
- Bank Transfer (ACH): 3-5 business days  
- Venmo: 1-2 business days
- CashApp: 1-2 business days

Platform fee schedules:
- Net-30: payout 30 days after period ends
- Net-60: payout 60 days after period ends
- Net-90: payout 90 days after period ends (default)
- Weekly: processed every Friday

Based on all of the above, provide:
1. recommended_payout_date — the single best date to request a payout (YYYY-MM-DD), balancing balance buildup, processing times, and fee windows
2. days_until_recommended — number of days from today
3. forecasted_balance_at_payout — estimated balance on that date based on avg daily earnings
4. reasoning — 2-3 sentence explanation of why this date is optimal
5. best_payout_method — which method is best for this user right now
6. estimated_arrival_date — when funds would actually arrive after processing (YYYY-MM-DD)
7. tips — array of 2-3 actionable tips to maximize payout value
8. optimization_score — 0-100 rating of how well optimized the current payout setup is
9. potential_savings — estimated amount they could save/gain by following recommendation`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommended_payout_date: { type: 'string' },
          days_until_recommended: { type: 'number' },
          forecasted_balance_at_payout: { type: 'number' },
          reasoning: { type: 'string' },
          best_payout_method: { type: 'string' },
          estimated_arrival_date: { type: 'string' },
          tips: { type: 'array', items: { type: 'string' } },
          optimization_score: { type: 'number' },
          potential_savings: { type: 'number' }
        }
      }
    });

    // Handle "Notify Me" — save preference to user and send confirmation
    if (notify_me && insight?.recommended_payout_date) {
      await base44.auth.updateMe({
        payout_insight_notify_date: insight.recommended_payout_date,
        payout_insight_notify_enabled: true
      });
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '📅 Payout Reminder Set — GamerGain',
        body: `Your payout reminder has been set!\n\n` +
          `<strong>Recommended Payout Date:</strong> ${insight.recommended_payout_date}\n` +
          `<strong>Forecasted Balance:</strong> $${insight.forecasted_balance_at_payout?.toFixed(2)}\n` +
          `<strong>Est. Arrival:</strong> ${insight.estimated_arrival_date}\n\n` +
          `<strong>Why this date?</strong> ${insight.reasoning}\n\n` +
          `We'll remind you when it's time. <a href="/UserProfile">View your profile</a>.`
      });
    }

    return Response.json({ success: true, insight, balance, avg_daily: avgDailyEarning });

  } catch (error) {
    console.error('aiPayoutInsight error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});