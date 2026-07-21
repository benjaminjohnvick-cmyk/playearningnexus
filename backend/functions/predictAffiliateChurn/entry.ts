import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { affiliate_user_id, check_all } = await req.json();

    // Fetch affiliates to analyze
    let affiliates = [];
    if (check_all) {
      affiliates = await base44.asServiceRole.entities.User.filter({ role: 'affiliate' }, '-created_date', 500);
    } else if (affiliate_user_id) {
      const user = await base44.asServiceRole.entities.User.filter({ id: affiliate_user_id });
      affiliates = user;
    } else {
      return Response.json({ error: 'Provide affiliate_user_id or check_all=true' }, { status: 400 });
    }

    const predictions = [];
    const now = new Date();

    for (const affiliate of affiliates) {
      try {
        // Get engagement metrics
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

        // Last login (from activity logs)
        const activities = await base44.asServiceRole.entities.UserActivity.filter(
          { user_id: affiliate.id }, '-created_date', 1
        );
        const lastActivity = activities[0];
        const daysLastLogin = lastActivity
          ? Math.floor((now - new Date(lastActivity.created_date)) / (24 * 60 * 60 * 1000))
          : 999;

        // Referrals
        const referralsLast30 = await base44.asServiceRole.entities.Referral.filter(
          { referrer_user_id: affiliate.id, created_date: { $gte: thirtyDaysAgo } }, '-created_date', 1000
        );
        const referralVelocity = referralsLast30.length;
        const daysLastReferral = referralsLast30.length > 0
          ? Math.floor((now - new Date(referralsLast30[0].created_date)) / (24 * 60 * 60 * 1000))
          : 999;

        // Social posts
        const postsLast30 = await base44.asServiceRole.entities.SocialMediaPost.filter(
          { created_by: affiliate.email, created_date: { $gte: thirtyDaysAgo } }, '-created_date', 100
        );
        const postingFrequency = postsLast30.length;
        const daysLastPost = postsLast30.length > 0
          ? Math.floor((now - new Date(postsLast30[0].created_date)) / (24 * 60 * 60 * 1000))
          : 999;

        // Historical earnings
        const payouts = await base44.asServiceRole.entities.PayoutRequest.filter(
          { affiliate_user_id: affiliate.id, status: 'completed' }, '-created_date', 4
        );
        const lastPayoutAmount = payouts[0]?.net_payout_amount || 0;
        const avg3mPayouts = payouts.length > 0
          ? payouts.slice(0, 3).reduce((sum, p) => sum + (p.net_payout_amount || 0), 0) / Math.min(3, payouts.length)
          : 0;

        // AI churn scoring
        const churnAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a churn prediction AI for an affiliate marketing platform.

AFFILIATE ACTIVITY:
- Days since last login: ${daysLastLogin}
- Days since last referral: ${daysLastReferral}
- Referrals (last 30 days): ${referralVelocity}
- Days since last social post: ${daysLastPost}
- Social posts (last 30 days): ${postingFrequency}
- Last payout: $${lastPayoutAmount}
- Avg payout (3 months): $${avg3mPayouts.toFixed(2)}

Predict churn risk and suggest win-back incentives.

Return JSON with:
1. churn_risk_score (0-100)
2. risk_level (low/medium/high/critical)
3. top_3_indicators (array of strings)
4. ai_insights (1-2 sentences)
5. suggested_incentive_type (bonus_offer/feature_unlock/personal_outreach)
6. suggested_incentive_amount (dollar amount if applicable)`,
          response_json_schema: {
            type: 'object',
            properties: {
              churn_risk_score: { type: 'number' },
              risk_level: { type: 'string' },
              top_3_indicators: { type: 'array', items: { type: 'string' } },
              ai_insights: { type: 'string' },
              suggested_incentive_type: { type: 'string' },
              suggested_incentive_amount: { type: 'number' }
            }
          }
        });

        // Determine if we should alert
        const shouldAlert = churnAnalysis.churn_risk_score > 60;
        const nextCheckDays = churnAnalysis.churn_risk_score > 80 ? 3 : 7;
        const nextCheckDate = new Date(now.getTime() + nextCheckDays * 24 * 60 * 60 * 1000);

        // Create or update prediction record
        const existingPredictions = await base44.asServiceRole.entities.AffiliateChurnPrediction.filter(
          { affiliate_user_id: affiliate.id }, '-prediction_date', 1
        );

        const predictionData = {
          affiliate_user_id: affiliate.id,
          affiliate_email: affiliate.email,
          churn_risk_score: churnAnalysis.churn_risk_score,
          risk_level: churnAnalysis.risk_level,
          prediction_date: now.toISOString(),
          next_check_date: nextCheckDate.toISOString(),
          engagement_metrics: {
            days_since_last_login: daysLastLogin,
            days_since_last_referral: daysLastReferral,
            days_since_last_social_post: daysLastPost,
            referral_velocity_30d: referralVelocity,
            posting_frequency_30d: postingFrequency,
            last_payout_amount: lastPayoutAmount,
            avg_payout_previous_3m: avg3mPayouts
          },
          churn_indicators: churnAnalysis.top_3_indicators,
          ai_insights: churnAnalysis.ai_insights,
          status: shouldAlert ? 'alerted' : 'monitoring'
        };

        let prediction;
        if (existingPredictions.length > 0) {
          await base44.asServiceRole.entities.AffiliateChurnPrediction.update(
            existingPredictions[0].id,
            predictionData
          );
          prediction = { ...existingPredictions[0], ...predictionData };
        } else {
          prediction = await base44.asServiceRole.entities.AffiliateChurnPrediction.create(predictionData);
        }

        // Send alert to account managers if high risk
        if (shouldAlert && !prediction.alert_sent_to?.includes('ops@gamergain.app')) {
          const alertEmails = ['ops@gamergain.app'];
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: alertEmails.join(','),
            from_name: 'GamerGain Churn Alert',
            subject: `⚠️ HIGH CHURN RISK: ${affiliate.full_name} (Score: ${churnAnalysis.churn_risk_score}/100)`,
            body: `An affiliate is showing signs of inactivity.\n\nAffiliate: ${affiliate.full_name} (${affiliate.email})\nRisk Level: ${churnAnalysis.risk_level}\nChurn Score: ${churnAnalysis.churn_risk_score}/100\n\nTop Indicators:\n${churnAnalysis.top_3_indicators.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}\n\nAI Insights: ${churnAnalysis.ai_insights}\n\nSuggested Action: ${churnAnalysis.suggested_incentive_type}${churnAnalysis.suggested_incentive_amount ? ` - $${churnAnalysis.suggested_incentive_amount}` : ''}\n\nView Details: https://gamergain.app/AffiliateChurnMonitor\n\n— Churn Prediction System`
          }).catch(() => null);

          await base44.asServiceRole.entities.AffiliateChurnPrediction.update(
            prediction.id,
            { alert_sent_to: alertEmails }
          );
        }

        predictions.push(prediction);
      } catch (e) {
        console.error(`Error analyzing ${affiliate.id}:`, e.message);
      }
    }

    const highRisk = predictions.filter(p => p.risk_level === 'critical' || p.risk_level === 'high');

    return Response.json({
      success: true,
      total_analyzed: affiliates.length,
      high_risk_count: highRisk.length,
      high_risk_affiliates: highRisk.map(p => ({ id: p.affiliate_user_id, email: p.affiliate_email, score: p.churn_risk_score }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});