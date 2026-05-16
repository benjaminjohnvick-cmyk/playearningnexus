import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Super Agent 4: GamerGain Platform Operations Superagent
 * Orchestrates: sendDailyReminder, sendPPCAdNotification, surveyStreakReminder,
 * notifyHighQualityResponse, gameSentimentReport, adCampaignHealthDigest,
 * sendWeeklyAdReport, verifyCampaignOutcomes, aiCampaignAutomation,
 * appStoreEarningsValidator, evaluateAgentPerformance, applyApprovedLearnings,
 * aiPlatformInsights, youtubeAutoEmbed, mosaicAutoShareSocialMedia, postGamerGainAds,
 * sendSurveyNotifications, triggerEmailMarketing, autoEnrollUserInSocialPosting
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { mode = 'daily' } = body; // 'daily' | 'weekly' | 'full'
    const start = Date.now();
    const results = {};
    const errors = {};

    const run = async (name, fn, payload = {}) => {
      try {
        console.log(`[PlatformOps] Running ${name}...`);
        results[name] = await base44.asServiceRole.functions.invoke(fn, payload);
        console.log(`[PlatformOps] ✓ ${name}`);
      } catch (e) {
        errors[name] = e.message;
        console.error(`[PlatformOps] ✗ ${name}: ${e.message}`);
      }
    };

    // === DAILY NOTIFICATIONS ===
    await run('send_daily_reminder', 'sendDailyReminder', {});
    await run('send_ppc_ad_notification', 'sendPPCAdNotification', {});
    await run('survey_streak_reminder', 'surveyStreakReminder', {});
    await run('send_survey_notifications', 'sendSurveyNotifications', {});

    // === AD & CAMPAIGN OPS ===
    await run('ad_campaign_health_digest', 'adCampaignHealthDigest', {});
    await run('ai_campaign_automation', 'aiCampaignAutomation', {});
    await run('verify_campaign_outcomes', 'verifyCampaignOutcomes', {});

    // === PLATFORM VALIDATION ===
    await run('app_store_earnings_validator', 'appStoreEarningsValidator', {});

    // === SOCIAL & CONTENT ===
    await run('auto_enroll_social_posting', 'autoEnrollUserInSocialPosting', {});
    await run('mosaic_auto_share', 'mosaicAutoShareSocialMedia', {});
    await run('post_gamergain_ads', 'postGamerGainAds', {});
    await run('youtube_auto_embed', 'youtubeAutoEmbed', {});

    // === WEEKLY OPERATIONS ===
    const isMonday = new Date().getDay() === 1;
    if (mode === 'weekly' || isMonday || mode === 'full') {
      await run('send_weekly_ad_report', 'sendWeeklyAdReport', {});
      await run('game_sentiment_report', 'gameSentimentReport', {});
      await run('ai_platform_insights', 'aiPlatformInsights', {});
      await run('trigger_email_marketing', 'triggerEmailMarketing', { campaign_type: 'weekly_summary' });
    }

    // === AGENT LEARNING (run weekly on Sunday) ===
    const isSunday = new Date().getDay() === 0;
    if (mode === 'full' || isSunday) {
      await run('evaluate_agent_performance', 'evaluateAgentPerformance', {
        agent_names: ['churn_predictor', 'fraud_detection', 'survey_intelligence_agent', 'survey_quality_monitor', 'survey_ops_superagent', 'referral_contest_superagent']
      });
      await run('apply_approved_learnings', 'applyApprovedLearnings', {});
    }

    // AI assessment
    const totalSteps = Object.keys(results).length + Object.keys(errors).length;
    const successRate = totalSteps > 0 ? Math.round((Object.keys(results).length / totalSteps) * 100) : 100;

    const assessment = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `GamerGain Platform Operations Super Agent completed a run.
Success rate: ${successRate}%
Steps completed: ${Object.keys(results).join(', ')}
Steps failed: ${Object.keys(errors).join(', ') || 'none'}
Mode: ${mode}

What is the overall platform operational health? Any immediate concern?
Return JSON: { "ops_health": "green|yellow|red", "top_concern": "string or null", "recommendation": "string" }`,
      response_json_schema: {
        type: 'object',
        properties: {
          ops_health: { type: 'string' },
          top_concern: { type: 'string' },
          recommendation: { type: 'string' }
        }
      }
    });

    // Alert if red
    if (assessment.ops_health === 'red') {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'system',
          title: `🔴 Platform Ops Agent: RED status`,
          message: assessment.top_concern || 'Multiple platform operations failed',
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/AdminDashboard',
        });
      }
    }

    await base44.asServiceRole.entities.AgentPerformanceLog.create({
      agent_name: 'platform_ops_superagent',
      action_type: 'full_pipeline_run',
      target_entity: 'Platform',
      output_data: { success_rate: successRate, results_keys: Object.keys(results), errors, ops_health: assessment.ops_health },
      predicted_outcome: assessment.recommendation,
      confidence_score: successRate,
      tags: ['platform_ops', assessment.ops_health, mode]
    });

    return Response.json({
      success: true,
      agent: 'platform_ops_superagent',
      duration_ms: Date.now() - start,
      steps_ok: Object.keys(results).length,
      steps_failed: Object.keys(errors).length,
      success_rate: successRate,
      ai_assessment: assessment,
      errors: Object.keys(errors).length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[PlatformOps] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});