import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * AI-driven churn prediction: scans high-value users for activity drops,
 * flags them in RetentionRisk, and triggers personalized re-engagement notifications.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let callerIsAdmin = false;
    try { const u = await base44.auth.me(); callerIsAdmin = u?.role === 'admin'; } catch (_) { callerIsAdmin = true; }
    if (!callerIsAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { send_notifications = false } = body;

    const users = await base44.asServiceRole.entities.User.list();
    const now = Date.now();
    const day = 86400000;

    let flagged = 0;
    let notified = 0;
    const flaggedUsers = [];

    for (const user of users) {
      if (!user.id) continue;

      // Fetch user activity data
      const [responses, sessions, referrals, prestige] = await Promise.all([
        base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 200),
        base44.asServiceRole.entities.PPCSession.filter({ user_id: user.id }, '-created_date', 60),
        base44.asServiceRole.entities.Referral.filter({ referrer_id: user.id }, '-created_date', 30),
        base44.asServiceRole.entities.GlobalPrestige.filter({ user_id: user.id }),
      ]);

      const lifetimeValue = user.total_earnings || 0;
      // Only analyze users with some value
      if (lifetimeValue < 5 && responses.length < 5) continue;

      const prestigeScore = prestige[0]?.prestige_score || 0;

      // Time windows
      const last30Responses = responses.filter(r => now - new Date(r.created_date) < 30 * day);
      const prev30Responses = responses.filter(r => {
        const age = now - new Date(r.created_date);
        return age >= 30 * day && age < 60 * day;
      });

      const last30Sessions = sessions.filter(s => now - new Date(s.created_date) < 30 * day);
      const prev30Sessions = sessions.filter(s => {
        const age = now - new Date(s.created_date);
        return age >= 30 * day && age < 60 * day;
      });

      const last30Referrals = referrals.filter(r => now - new Date(r.created_date) < 30 * day);
      const prev30Referrals = referrals.filter(r => {
        const age = now - new Date(r.created_date);
        return age >= 30 * day && age < 60 * day;
      });

      const lastResponse = responses[0];
      const daysSinceLastSurvey = lastResponse
        ? Math.floor((now - new Date(lastResponse.created_date)) / day)
        : 999;

      const lastSession = sessions[0];
      const daysSinceLastLogin = lastSession
        ? Math.floor((now - new Date(lastSession.created_date)) / day)
        : 999;

      // Calculate drops (avoid div by zero)
      const surveyDrop = prev30Responses.length > 0
        ? Math.max(0, ((prev30Responses.length - last30Responses.length) / prev30Responses.length) * 100)
        : (last30Responses.length === 0 ? 100 : 0);

      const sessionDrop = prev30Sessions.length > 0
        ? Math.max(0, ((prev30Sessions.length - last30Sessions.length) / prev30Sessions.length) * 100)
        : 0;

      const referralDrop = prev30Referrals.length > 0
        ? Math.max(0, ((prev30Referrals.length - last30Referrals.length) / prev30Referrals.length) * 100)
        : 0;

      // Risk signals
      const signals = [];
      let churnScore = 0;

      if (daysSinceLastSurvey > 14) { signals.push(`no_survey_${daysSinceLastSurvey}d`); churnScore += 25; }
      else if (daysSinceLastSurvey > 7) { signals.push(`inactive_survey_7d`); churnScore += 12; }

      if (daysSinceLastLogin > 7) { signals.push(`no_login_${daysSinceLastLogin}d`); churnScore += 20; }

      if (surveyDrop > 60) { signals.push(`survey_drop_${Math.round(surveyDrop)}pct`); churnScore += 25; }
      else if (surveyDrop > 30) { signals.push(`survey_slow_${Math.round(surveyDrop)}pct`); churnScore += 12; }

      if (sessionDrop > 60) { signals.push(`session_drop_${Math.round(sessionDrop)}pct`); churnScore += 15; }
      if (referralDrop > 60) { signals.push(`referral_drop_${Math.round(referralDrop)}pct`); churnScore += 10; }
      if (lifetimeValue > 50 && daysSinceLastSurvey > 7) { signals.push('high_value_at_risk'); churnScore += 20; }
      if (prestigeScore >= 400 && surveyDrop > 30) { signals.push('prestige_user_declining'); churnScore += 15; }

      churnScore = Math.min(100, churnScore);

      const riskLevel =
        churnScore >= 75 ? 'critical' :
        churnScore >= 50 ? 'high' :
        churnScore >= 25 ? 'medium' : 'low';

      // Only flag medium+ risk
      if (riskLevel === 'low' || signals.length === 0) continue;

      // AI analysis
      let aiAnalysis = '';
      let recommendedAction = '';
      try {
        const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `User churn analysis:
- Lifetime value: $${lifetimeValue.toFixed(2)}
- Days since last survey: ${daysSinceLastSurvey}
- Survey frequency drop: ${surveyDrop.toFixed(0)}%
- Session drop: ${sessionDrop.toFixed(0)}%
- Referral drop: ${referralDrop.toFixed(0)}%
- Risk signals: ${signals.join(', ')}
- Prestige score: ${prestigeScore}/1000
Write: 1) A 1-sentence churn analysis. 2) A specific re-engagement action to take (email subject + 1 sentence body).
Format as JSON: { "analysis": "...", "email_subject": "...", "email_body": "...", "push_message": "..." }`,
          response_json_schema: {
            type: 'object',
            properties: {
              analysis: { type: 'string' },
              email_subject: { type: 'string' },
              email_body: { type: 'string' },
              push_message: { type: 'string' },
            }
          }
        });
        aiAnalysis = aiResult.analysis || '';
        recommendedAction = aiResult.email_subject || 'We miss you! Come back and earn.';

        // Send notifications if requested
        if (send_notifications && (riskLevel === 'high' || riskLevel === 'critical')) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: aiResult.email_subject || "We miss you on GamerGain!",
            body: `<p>Hi ${user.full_name},</p><p>${aiResult.email_body || 'Come back and earn rewards!'}</p><p>Your current balance is $${lifetimeValue.toFixed(2)}. New surveys are waiting for you!</p><p>Best,<br/>The GamerGain Team</p>`,
          });

          await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'survey_available',
            title: '🎯 New opportunities waiting for you!',
            message: aiResult.push_message || 'You have new high-paying surveys available. Come back and earn!',
            status: 'unread',
            delivery_method: ['in_app', 'email'],
          });
          notified++;
        }
      } catch (_) {
        aiAnalysis = `User shows ${riskLevel} churn risk with ${signals.length} warning signals.`;
        recommendedAction = 'Send personalized re-engagement email with bonus offer.';
      }

      // Upsert RetentionRisk record
      const existing = await base44.asServiceRole.entities.RetentionRisk.filter({ user_id: user.id });
      const riskData = {
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        risk_level: riskLevel,
        churn_probability: churnScore,
        lifetime_value: lifetimeValue,
        days_since_last_survey: daysSinceLastSurvey,
        days_since_last_login: daysSinceLastLogin,
        survey_freq_drop_pct: Math.round(surveyDrop),
        referral_drop_pct: Math.round(referralDrop),
        session_length_drop_pct: Math.round(sessionDrop),
        risk_signals: signals,
        ai_analysis: aiAnalysis,
        recommended_action: recommendedAction,
        notification_sent: send_notifications && (riskLevel === 'high' || riskLevel === 'critical'),
        notification_sent_at: send_notifications ? new Date().toISOString() : undefined,
        status: existing[0]?.status === 'recovered' ? 'recovered' : 'active',
      };

      if (existing[0]) {
        await base44.asServiceRole.entities.RetentionRisk.update(existing[0].id, riskData);
      } else {
        await base44.asServiceRole.entities.RetentionRisk.create(riskData);
      }

      flagged++;
      flaggedUsers.push({ user_id: user.id, email: user.email, risk_level: riskLevel, churn_probability: churnScore });
    }

    return Response.json({
      success: true,
      users_analyzed: users.length,
      flagged,
      notified,
      flagged_users: flaggedUsers,
    });
  } catch (error) {
    console.error('churnPredictionEngine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});