import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Automated Retention Campaign Engine
 * - Analyzes inactivity patterns
 * - Categorizes users by churn risk
 * - Generates personalized win-back offers
 * - Sends SMS (Twilio) + Email campaigns
 * - Logs all actions for agent self-learning
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let callerIsAdmin = false;
    try { const u = await base44.auth.me(); callerIsAdmin = u?.role === 'admin'; } catch (_) { callerIsAdmin = true; }
    if (!callerIsAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { dry_run = false, risk_levels = ['high', 'critical'], max_users = 50 } = body;

    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE = Deno.env.get('TWILIO_PHONE_NUMBER');

    // Get all active retention risks at the target levels
    const allRisks = await base44.asServiceRole.entities.RetentionRisk.list('-churn_probability', max_users * 3);
    const targetRisks = allRisks.filter(r =>
      risk_levels.includes(r.risk_level) &&
      r.status === 'active' &&
      r.user_id
    ).slice(0, max_users);

    // Get learning memory for churn_predictor to improve messaging
    const memories = await base44.asServiceRole.entities.AgentLearningMemory.filter({
      agent_name: 'churn_predictor',
      is_active: true,
      admin_approved: true
    });
    const learnedInsights = memories.map(m => m.content).join('\n');

    let campaignsSent = 0;
    let emailsSent = 0;
    let smsSent = 0;
    const results = [];

    for (const risk of targetRisks) {
      // Skip if we already sent a campaign recently (within 7 days)
      const recentCampaigns = await base44.asServiceRole.entities.RetentionCampaign.filter({
        user_id: risk.user_id,
        status: 'sent'
      });
      const sentWithin7Days = recentCampaigns.some(c => {
        const daysSince = (Date.now() - new Date(c.created_date)) / 86400000;
        return daysSince < 7;
      });
      if (sentWithin7Days) continue;

      // Fetch user data for personalization
      const users = await base44.asServiceRole.entities.User.filter({ id: risk.user_id });
      const user = users[0];
      if (!user?.email) continue;

      // AI-generate a personalized win-back offer
      let campaignData;
      try {
        campaignData = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a retention specialist for GamerGain, a survey-earning platform for gamers.

USER PROFILE:
- Name: ${risk.user_name || user.full_name}
- Lifetime earnings: $${(risk.lifetime_value || 0).toFixed(2)}
- Days since last survey: ${risk.days_since_last_survey}
- Days since last login: ${risk.days_since_last_login}
- Risk level: ${risk.risk_level}
- Churn probability: ${risk.churn_probability}%
- Risk signals: ${(risk.risk_signals || []).join(', ')}
- AI analysis: ${risk.ai_analysis || 'User showing signs of disengagement'}

LEARNED BEST PRACTICES FROM PAST CAMPAIGNS:
${learnedInsights || 'No prior learning data yet — use best judgment.'}

Generate a personalized win-back campaign. The offer should match the risk level:
- medium: gentle nudge with bonus survey opportunity
- high: 2x earnings multiplier for next 48 hours
- critical: $5 bonus credit + urgent personalized message

Return JSON with:
{
  "email_subject": "compelling subject line (max 60 chars)",
  "email_body": "HTML email body (2-3 paragraphs, personal, warm, with clear CTA)",
  "sms_message": "SMS text (max 160 chars, includes offer and urgency)",
  "offer_type": one of ["bonus_cash","double_earnings","exclusive_survey","vip_tier_boost","streak_reset"],
  "offer_value": dollar amount of offer (number),
  "predicted_outcome": "will/won't return within 7 days"
}`,
          response_json_schema: {
            type: 'object',
            properties: {
              email_subject: { type: 'string' },
              email_body: { type: 'string' },
              sms_message: { type: 'string' },
              offer_type: { type: 'string' },
              offer_value: { type: 'number' },
              predicted_outcome: { type: 'string' }
            }
          }
        });
      } catch (_) {
        campaignData = {
          email_subject: `${risk.user_name || user.full_name}, we have a special offer for you!`,
          email_body: `<p>Hi ${risk.user_name || user.full_name},</p><p>We noticed you haven't been active lately. Come back and earn — new high-paying surveys are waiting for you!</p><p>Your GamerGain balance: $${(risk.lifetime_value || 0).toFixed(2)}</p>`,
          sms_message: `GamerGain: New surveys available! Earn up to $5 today. Login now: gamergain.app`,
          offer_type: 'double_earnings',
          offer_value: risk.risk_level === 'critical' ? 5 : 2,
          predicted_outcome: 'uncertain'
        };
      }

      const offerExpiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

      // Create agent performance log BEFORE sending (to capture prediction)
      const logRecord = await base44.asServiceRole.entities.AgentPerformanceLog.create({
        agent_name: 'churn_predictor',
        action_type: 'retention_campaign',
        target_entity: 'User',
        target_id: risk.user_id,
        input_data: {
          risk_level: risk.risk_level,
          churn_probability: risk.churn_probability,
          days_since_last_survey: risk.days_since_last_survey,
          risk_signals: risk.risk_signals,
          lifetime_value: risk.lifetime_value
        },
        output_data: {
          offer_type: campaignData.offer_type,
          offer_value: campaignData.offer_value,
          email_subject: campaignData.email_subject,
          sms_message: campaignData.sms_message
        },
        predicted_outcome: campaignData.predicted_outcome,
        confidence_score: risk.churn_probability,
        human_review_status: 'pending',
        tags: [risk.risk_level, campaignData.offer_type]
      });

      if (!dry_run) {
        let emailOk = false;
        let smsOk = false;

        // Send Email
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: campaignData.email_subject,
            body: campaignData.email_body,
            from_name: 'GamerGain Team'
          });
          emailOk = true;
          emailsSent++;
        } catch (e) {
          console.error('Email failed for', user.email, e.message);
        }

        // Send SMS via Twilio if user has phone
        if (TWILIO_ACCOUNT_SID && user.phone_number) {
          try {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
            const smsBody = new URLSearchParams({
              To: user.phone_number,
              From: TWILIO_PHONE,
              Body: campaignData.sms_message
            });
            const smsResp = await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: smsBody
            });
            if (smsResp.ok) { smsOk = true; smsSent++; }
          } catch (e) {
            console.error('SMS failed for', user.email, e.message);
          }
        }

        // Save campaign record
        const campaign = await base44.asServiceRole.entities.RetentionCampaign.create({
          user_id: risk.user_id,
          user_email: user.email,
          user_name: risk.user_name || user.full_name,
          risk_level: risk.risk_level,
          churn_probability: risk.churn_probability,
          campaign_type: 'all_channels',
          email_subject: campaignData.email_subject,
          email_body: campaignData.email_body,
          sms_message: campaignData.sms_message,
          offer_type: campaignData.offer_type,
          offer_value: campaignData.offer_value,
          offer_expires_at: offerExpiresAt,
          email_sent: emailOk,
          sms_sent: smsOk,
          email_sent_at: emailOk ? new Date().toISOString() : undefined,
          sms_sent_at: smsOk ? new Date().toISOString() : undefined,
          agent_log_id: logRecord.id,
          status: emailOk || smsOk ? 'sent' : 'failed'
        });

        // Update retention risk record
        await base44.asServiceRole.entities.RetentionRisk.update(risk.id, {
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
          status: 'contacted'
        });

        campaignsSent++;
        results.push({
          user_id: risk.user_id,
          email: user.email,
          risk_level: risk.risk_level,
          email_sent: emailOk,
          sms_sent: smsOk,
          offer: campaignData.offer_type,
          campaign_id: campaign.id
        });
      } else {
        results.push({
          dry_run: true,
          user_id: risk.user_id,
          email: user.email,
          risk_level: risk.risk_level,
          would_send: { email: true, sms: !!user.phone_number },
          preview: { subject: campaignData.email_subject, sms: campaignData.sms_message, offer: campaignData.offer_type }
        });
      }
    }

    return Response.json({
      success: true,
      dry_run,
      users_analyzed: targetRisks.length,
      campaigns_sent: dry_run ? 0 : campaignsSent,
      emails_sent: emailsSent,
      sms_sent: smsSent,
      results
    });
  } catch (error) {
    console.error('retentionCampaignEngine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});