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
      isAdmin = true;
    }
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // If a specific payout_id is passed, analyze just that one. Otherwise scan recent pending.
    const targetPayoutId = body.payout_id || null;

    const allPayouts = targetPayoutId
      ? await base44.asServiceRole.entities.Payout.filter({ id: targetPayoutId })
      : await base44.asServiceRole.entities.Payout.list('-created_date', 200);

    const payoutsToAnalyze = targetPayoutId
      ? allPayouts
      : allPayouts.filter(p => p.status === 'pending' || p.status === 'processing');

    if (payoutsToAnalyze.length === 0) {
      return Response.json({ ok: true, results: [], message: 'No payouts to analyze' });
    }

    const allUsers = await base44.asServiceRole.entities.User.list();
    const allPrefs = await base44.asServiceRole.entities.PayoutPreference.list();
    const allDailyEarnings = await base44.asServiceRole.entities.DailyEarnings.list('-date', 2000);
    const allReferrals = await base44.asServiceRole.entities.Referral.list();
    const allUserPayouts = await base44.asServiceRole.entities.Payout.list('-created_date', 1000);

    const results = [];

    for (const payout of payoutsToAnalyze) {
      const user = allUsers.find(u => u.id === payout.user_id);
      const pref = allPrefs.find(p => p.user_id === payout.user_id);
      const userEarnings = allDailyEarnings.filter(e => e.user_id === payout.user_id).slice(0, 60);
      const userPayoutHistory = allUserPayouts
        .filter(p => p.user_id === payout.user_id && p.id !== payout.id)
        .slice(0, 20);
      const userReferrals = allReferrals.filter(r => r.referrer_user_id === payout.user_id);

      // Build fraud signals for the prompt
      const avgDailyEarning = userEarnings.length > 0
        ? userEarnings.reduce((s, e) => s + (e.total_earned || 0), 0) / userEarnings.length
        : 0;

      const earningsLast7Days = userEarnings.slice(0, 7).reduce((s, e) => s + (e.total_earned || 0), 0);
      const earningsLast30Days = userEarnings.slice(0, 30).reduce((s, e) => s + (e.total_earned || 0), 0);

      const recentPayouts24h = userPayoutHistory.filter(p => {
        const diff = (new Date(payout.created_date) - new Date(p.created_date)) / (1000 * 60 * 60);
        return diff >= 0 && diff <= 24;
      }).length;

      const accountAgeDays = user?.created_date
        ? Math.floor((Date.now() - new Date(user.created_date)) / (1000 * 60 * 60 * 24))
        : null;

      const failedPayoutCount = userPayoutHistory.filter(p => p.status === 'failed').length;
      const changedEmailRecently = false; // placeholder, can be enriched

      const prompt = `You are a financial fraud detection AI for GamerGain, a gaming rewards platform where users earn money by completing surveys and referring friends.

Analyze this payout transaction for fraud signals and return a risk assessment:

PAYOUT DETAILS:
- Payout ID: ${payout.id}
- Amount: $${(payout.amount || 0).toFixed(2)}
- Method: ${payout.method}
- Type: ${payout.payout_type || 'unknown'}
- Recipient email: ${payout.recipient_email || 'not set'}
- Created: ${payout.created_date}

USER PROFILE:
- Account age: ${accountAgeDays !== null ? accountAgeDays + ' days' : 'unknown'}
- Account verified: ${pref?.is_verified ?? false}
- Total earnings (user record): $${(user?.total_earnings || 0).toFixed(2)}
- Pending earnings: $${(user?.pending_earnings || 0).toFixed(2)}
- Total referrals made: ${userReferrals.length}

EARNING BEHAVIOR:
- Average daily earnings (all time): $${avgDailyEarning.toFixed(4)}
- Earnings last 7 days: $${earningsLast7Days.toFixed(2)}
- Earnings last 30 days: $${earningsLast30Days.toFixed(2)}
- Active earning days in data: ${userEarnings.length}

TRANSACTION HISTORY:
- Total past payouts: ${userPayoutHistory.length}
- Failed payouts: ${failedPayoutCount}
- Payouts in last 24h (excluding this): ${recentPayouts24h}
- This payout vs avg daily: ${avgDailyEarning > 0 ? ((payout.amount || 0) / (avgDailyEarning * 30)).toFixed(1) + 'x monthly avg' : 'no earning history'}

FLAG if any of these are present:
- Payout is >10x the user's typical monthly earnings
- Multiple payouts requested within 24 hours
- Very new account (<7 days) requesting large payout (>$20)
- No earning history but requesting payout
- Earnings pattern is suspicious (e.g., all earned in 1-2 days)
- High failure rate on past payouts

Return your analysis with a risk_score (0-100), risk_level (low/medium/high/critical), whether to block/flag/approve, and specific fraud signals detected.`;

      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            risk_score: { type: 'number' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            recommendation: { type: 'string', enum: ['approve', 'flag_for_review', 'block'] },
            fraud_signals: { type: 'array', items: { type: 'string' } },
            explanation: { type: 'string' },
            confidence: { type: 'number' }
          }
        }
      });

      const result = {
        payout_id: payout.id,
        user_id: payout.user_id,
        user_name: user?.full_name || 'Unknown',
        user_email: user?.email || payout.recipient_email,
        amount: payout.amount,
        method: payout.method,
        payout_status: payout.status,
        ai_fraud_analysis: aiResult,
        analyzed_at: new Date().toISOString()
      };

      results.push(result);

      // If flagged or blocked, update the payout with a note and create admin notification
      if (aiResult.recommendation !== 'approve' && aiResult.risk_score >= 40) {
        const flagNote = `[AI FRAUD FLAG] Risk: ${aiResult.risk_level} (${aiResult.risk_score}/100). ${aiResult.explanation}. Signals: ${(aiResult.fraud_signals || []).join('; ')}`;

        await base44.asServiceRole.entities.Payout.update(payout.id, {
          notes: flagNote,
          status: aiResult.recommendation === 'block' ? 'failed' : payout.status,
          error_message: aiResult.recommendation === 'block' ? `Blocked by AI fraud detection: ${aiResult.explanation}` : payout.error_message
        });
      }
    }

    const flagged = results.filter(r => r.ai_fraud_analysis?.recommendation === 'flag_for_review');
    const blocked = results.filter(r => r.ai_fraud_analysis?.recommendation === 'block');

    return Response.json({
      ok: true,
      analyzed: results.length,
      flagged: flagged.length,
      blocked: blocked.length,
      results,
      analyzed_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});