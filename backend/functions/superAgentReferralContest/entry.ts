import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Super Agent 2: GamerGain Referral & Contest Engine
 * Orchestrates: processReferralDailyBonus, flagSuspiciousReferrals,
 * referralReengagementEmail, awardReferralJackpotEntries,
 * weeklyContestWinner, headToHeadContestMatchmaker,
 * referralContestLeaderboard, notifyWeeklyTopEarners,
 * awardSocialMediaJackpotEntries, sendReferralShareEmail
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { mode = 'daily' } = body; // 'daily' | 'weekly' | 'full'

    const results = {};
    const errors = {};
    const start = Date.now();

    const run = async (name, fn, payload = {}) => {
      try {
        console.log(`[ReferralContest] Running ${name}...`);
        results[name] = await base44.asServiceRole.functions.invoke(fn, payload);
        console.log(`[ReferralContest] ✓ ${name}`);
      } catch (e) {
        errors[name] = e.message;
        console.error(`[ReferralContest] ✗ ${name}: ${e.message}`);
      }
    };

    // === DAILY OPERATIONS (always run) ===
    await run('flag_suspicious_referrals', 'flagSuspiciousReferrals', {});
    await run('referral_reengagement_email', 'referralReengagementEmail', {});
    await run('award_referral_jackpot_entries', 'awardReferralJackpotEntries', {});
    await run('award_social_media_jackpot_entries', 'awardSocialMediaJackpotEntries', {});
    await run('head_to_head_contest_matchmaker', 'headToHeadContestMatchmaker', {});
    await run('referral_contest_leaderboard', 'referralContestLeaderboard', {});

    // === WEEKLY OPERATIONS ===
    const isMonday = new Date().getDay() === 1;
    if (mode === 'weekly' || isMonday || mode === 'full') {
      await run('weekly_contest_winner', 'weeklyContestWinner', {});
      await run('notify_weekly_top_earners', 'notifyWeeklyTopEarners', {});
      await run('send_referral_share_email', 'sendReferralShareEmail', {});
    }

    // === FRAUD CHECK on referrals ===
    // AI analysis of flagged referrals
    const recentReferrals = await base44.asServiceRole.entities.Referral.list('-created_date', 100);
    const suspicious = recentReferrals.filter(r => r.status === 'flagged' || r.is_suspicious);

    let fraudAction = null;
    if (suspicious.length > 5) {
      const aiDecision = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `GamerGain Referral Fraud Assessment:
${suspicious.length} suspicious referrals detected today.
Sample: ${JSON.stringify(suspicious.slice(0, 5).map(r => ({ referrer: r.referrer_user_id, referred: r.referred_user_id, status: r.status })))}

Should these be auto-suspended or just flagged for admin review?
Return JSON: { "auto_suspend": true|false, "reason": "string", "urgency": "low|medium|high" }`,
        response_json_schema: {
          type: 'object',
          properties: {
            auto_suspend: { type: 'boolean' },
            reason: { type: 'string' },
            urgency: { type: 'string' }
          }
        }
      });

      fraudAction = aiDecision;

      if (aiDecision.urgency === 'high') {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of admins.slice(0, 2)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'security_alert',
            title: `🚨 Referral Fraud: ${suspicious.length} suspicious referrals`,
            message: aiDecision.reason,
            status: 'unread',
            delivery_method: ['in_app'],
            action_url: '/ReferralAnalytics',
          });
        }
      }
    }

    // Log performance
    await base44.asServiceRole.entities.AgentPerformanceLog.create({
      agent_name: 'referral_contest_superagent',
      action_type: 'full_pipeline_run',
      target_entity: 'Referral',
      output_data: { results_keys: Object.keys(results), errors, suspicious_referrals: suspicious.length, fraud_action: fraudAction },
      predicted_outcome: `Processed referral pipeline: ${Object.keys(results).length} steps, ${suspicious.length} suspicious referrals reviewed`,
      confidence_score: 85,
      tags: ['referral_ops', mode, isMonday ? 'weekly' : 'daily']
    });

    return Response.json({
      success: true,
      agent: 'referral_contest_superagent',
      duration_ms: Date.now() - start,
      steps_ok: Object.keys(results).length,
      steps_failed: Object.keys(errors).length,
      suspicious_referrals_reviewed: suspicious.length,
      fraud_action: fraudAction,
      errors: Object.keys(errors).length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[ReferralContest] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});