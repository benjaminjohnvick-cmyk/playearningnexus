import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Churn Prediction Engine
 * Analyzes user engagement + UX event patterns + survey feedback
 * to identify at-risk users and trigger personalized retention campaigns
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [allUsers, allJourneyEvents, surveyResponses, uxMemories, existingRisks] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.UserJourneyEvent.list('-created_date', 5000),
      base44.asServiceRole.entities.FeedbackSurveyResponse.list('-created_date', 1000),
      base44.asServiceRole.entities.AgentLearningMemory.filter({ memory_type: 'ux_insight', is_active: true }),
      base44.asServiceRole.entities.RetentionRisk.filter({ status: 'active' }),
    ]);

    const results = { flagged: 0, campaigns_triggered: 0, skipped: 0, errors: [] };
    const existingRiskUserIds = new Set(existingRisks.map(r => r.user_id));

    for (const u of allUsers) {
      if (existingRiskUserIds.has(u.id)) { results.skipped++; continue; }

      const userEvents = allJourneyEvents.filter(e => e.user_id === u.id);
      const recentEvents = userEvents.filter(e => e.created_date >= sevenDaysAgo);
      const priorEvents = userEvents.filter(e => e.created_date >= thirtyDaysAgo && e.created_date < sevenDaysAgo);
      const userSurveyResponses = surveyResponses.filter(r => r.user_id === u.id);

      // Skip brand-new users
      const daysSinceSignup = (now - new Date(u.created_date)) / (1000 * 60 * 60 * 24);
      if (daysSinceSignup < 3) { results.skipped++; continue; }

      // --- Compute churn signals ---
      const signals = [];
      let churnScore = 0;

      const recentSurveys = recentEvents.filter(e => e.event_type === 'survey_complete').length;
      const priorSurveys = priorEvents.filter(e => e.event_type === 'survey_complete').length;
      const surveyDropPct = priorSurveys > 0 ? Math.round(((priorSurveys - recentSurveys) / priorSurveys) * 100) : 0;

      if (recentEvents.length === 0 && priorEvents.length > 0) {
        signals.push('No activity in last 7 days');
        churnScore += 35;
      }
      if (surveyDropPct > 50) {
        signals.push(`Survey completions dropped ${surveyDropPct}%`);
        churnScore += 20;
      }
      const abandonEvents = recentEvents.filter(e => ['form_abandon', 'survey_abandon'].includes(e.event_type));
      if (abandonEvents.length > 3) {
        signals.push(`High abandon rate: ${abandonEvents.length} abandons this week`);
        churnScore += 15;
      }
      const errorEvents = recentEvents.filter(e => e.event_type === 'error_encountered');
      if (errorEvents.length > 2) {
        signals.push(`${errorEvents.length} errors encountered`);
        churnScore += 10;
      }
      const daysSinceLastActivity = recentEvents.length > 0
        ? 0
        : priorEvents.length > 0
          ? Math.round((now - new Date(priorEvents[0]?.created_date)) / (1000 * 60 * 60 * 24))
          : Math.round(daysSinceSignup);
      if (daysSinceLastActivity > 10) {
        signals.push(`${daysSinceLastActivity} days since last activity`);
        churnScore += 20;
      }

      // Negative survey sentiment
      const negativeFeedback = userSurveyResponses.filter(r =>
        r.answers?.some(a => a.rating && a.rating <= 2)
      ).length;
      if (negativeFeedback > 0) {
        signals.push(`${negativeFeedback} low-rating survey responses`);
        churnScore += 10;
      }

      if (churnScore < 20 || signals.length === 0) { results.skipped++; continue; }

      const riskLevel = churnScore >= 60 ? 'critical' : churnScore >= 40 ? 'high' : 'medium';

      // --- Use LLM to generate personalized campaign ---
      const uxContextSnippets = uxMemories
        .filter(m => m.feature_area)
        .slice(0, 3)
        .map(m => m.content)
        .join('\n---\n');

      const campaignPrompt = `Generate a personalized retention campaign for this GamerGain user:

Name: ${u.full_name || 'User'}
Churn Risk: ${riskLevel} (score: ${churnScore}/100)
Churn Signals:
${signals.map(s => `- ${s}`).join('\n')}
Total Earnings: $${(u.total_earnings || 0).toFixed(2)}
Days on Platform: ${Math.round(daysSinceSignup)}

Recent UX Insights from other users:
${uxContextSnippets.slice(0, 1000) || 'No specific UX context available'}

Create a compelling retention campaign. Be personal, specific to their signals, and offer real value.

Return JSON:
{
  "email_subject": "string (personalized, max 60 chars)",
  "email_body": "string (HTML, 3-4 paragraphs, mention their earnings and specific churn signals, include a clear CTA)",
  "sms_message": "string (max 160 chars, direct and urgent)",
  "offer_type": "bonus_cash|double_earnings|exclusive_survey|vip_tier_boost|streak_reset",
  "offer_value": number,
  "campaign_type": "winback_email|sms_offer|bonus_credit|personalized_survey|all_channels"
}`;

      const campaign = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: campaignPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            email_subject: { type: 'string' },
            email_body: { type: 'string' },
            sms_message: { type: 'string' },
            offer_type: { type: 'string' },
            offer_value: { type: 'number' },
            campaign_type: { type: 'string' }
          }
        }
      });

      // Create RetentionRisk record
      const riskRecord = await base44.asServiceRole.entities.RetentionRisk.create({
        user_id: u.id,
        user_email: u.email,
        user_name: u.full_name,
        risk_level: riskLevel,
        churn_probability: Math.min(99, churnScore),
        lifetime_value: u.total_earnings || 0,
        days_since_last_survey: Math.round((now - new Date(priorEvents.find(e => e.event_type === 'survey_complete')?.created_date || u.created_date)) / (1000 * 60 * 60 * 24)),
        days_since_last_login: daysSinceLastActivity,
        survey_freq_drop_pct: surveyDropPct,
        risk_signals: signals,
        recommended_action: campaign?.campaign_type || 'winback_email',
        status: 'active',
      });

      // Create RetentionCampaign record
      const offerExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.RetentionCampaign.create({
        user_id: u.id,
        user_email: u.email,
        user_name: u.full_name,
        risk_level: riskLevel,
        churn_probability: Math.min(99, churnScore),
        campaign_type: campaign?.campaign_type || 'winback_email',
        email_subject: campaign?.email_subject || `We miss you, ${u.full_name?.split(' ')[0]}!`,
        email_body: campaign?.email_body || '',
        sms_message: campaign?.sms_message || '',
        offer_type: campaign?.offer_type || 'bonus_cash',
        offer_value: campaign?.offer_value || 2,
        offer_expires_at: offerExpiry,
        agent_log_id: riskRecord.id,
        status: 'pending',
      });

      // Send in-app notification
      await base44.asServiceRole.entities.Notification.create({
        user_id: u.id,
        type: 'points_earned',
        title: campaign?.email_subject || `We have a special offer for you! 🎁`,
        message: campaign?.sms_message || `We noticed you've been away. Come back and earn more rewards!`,
        status: 'unread',
        delivery_method: ['in_app'],
        action_url: '/PPCMarketplace',
        icon: 'gift',
      });

      // Send email
      if (campaign?.email_body) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: campaign.email_subject,
          body: campaign.email_body,
          from_name: 'GamerGain',
        });
        await base44.asServiceRole.entities.RetentionCampaign.update(riskRecord.id, {
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          status: 'sent',
        });
      }

      results.flagged++;
      results.campaigns_triggered++;
    }

    // Log run
    await base44.asServiceRole.entities.AgentPerformanceLog.create({
      agent_name: 'churn_predictor',
      action_type: 'churn_prediction_run',
      target_entity: 'User',
      output_data: results,
      predicted_outcome: `Flagged ${results.flagged} at-risk users and triggered ${results.campaigns_triggered} campaigns`,
      confidence_score: 75,
      tags: ['churn_prediction', 'retention_campaign'],
    });

    return Response.json({ success: true, ...results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});