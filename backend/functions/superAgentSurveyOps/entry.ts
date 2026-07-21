import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Super Agent 1: GamerGain Survey Operations Agent
 * Orchestrates all survey lifecycle functions:
 * surveyHealthMonitor, surveyQualityAutoScan, surveyQualityMonitor,
 * dailyAISurveyGenerator, processSurveySchedules, scheduleSurveyDistribution,
 * surveyAlertEngine, surveyABTestOptimizer
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { mode = 'full' } = body; // 'full' | 'health_only' | 'distribution_only'

    const results = {};
    const errors = {};
    const start = Date.now();

    const run = async (name, fn, payload = {}) => {
      try {
        console.log(`[SurveyOps] Running ${name}...`);
        results[name] = await base44.asServiceRole.functions.invoke(fn, payload);
        console.log(`[SurveyOps] ✓ ${name}`);
      } catch (e) {
        errors[name] = e.message;
        console.error(`[SurveyOps] ✗ ${name}: ${e.message}`);
      }
    };

    // === HEALTH & QUALITY ===
    await run('survey_health_monitor', 'surveyHealthMonitor', {});
    await run('survey_quality_auto_scan', 'surveyQualityAutoScan', { lookback_hours: 24 });
    await run('survey_quality_monitor', 'surveyQualityMonitor', {});

    if (mode === 'full') {
      // === GENERATION & DISTRIBUTION ===
      await run('daily_ai_survey_generator', 'dailyAISurveyGenerator', {});
      await run('process_survey_schedules', 'processSurveySchedules', {});
      await run('schedule_survey_distribution', 'scheduleSurveyDistribution', {});
      await run('survey_alert_engine', 'surveyAlertEngine', {});

      // === OPTIMIZATION ===
      await run('survey_ab_test_optimizer', 'surveyABTestOptimizer', {});
      await run('run_survey_intelligence', 'runSurveyIntelligence', { trigger: 'survey_ops_agent' });

      // === AI INSIGHTS ===
      await run('survey_analytics_ai', 'surveyAnalyticsAI', {});
    }

    // AI health assessment
    const hasAlerts = Object.keys(errors).length > 0;
    const assessment = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are the GamerGain Survey Operations Super Agent. Analyze this run result and determine if any escalation is needed.

Steps completed: ${Object.keys(results).join(', ')}
Steps failed: ${Object.keys(errors).join(', ') || 'none'}
Errors: ${JSON.stringify(errors)}

Assess: should any survey be paused, any admin alerted, or any action taken?
Return JSON: { "status": "healthy|warning|critical", "action_needed": true|false, "action": "string or null", "summary": "1 sentence" }`,
      response_json_schema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          action_needed: { type: 'boolean' },
          action: { type: 'string' },
          summary: { type: 'string' }
        }
      }
    });

    // Log performance
    await base44.asServiceRole.entities.AgentPerformanceLog.create({
      agent_name: 'survey_ops_superagent',
      action_type: 'full_pipeline_run',
      target_entity: 'PPCSurvey',
      output_data: { results_keys: Object.keys(results), errors, duration_ms: Date.now() - start, ai_status: assessment.status },
      predicted_outcome: assessment.summary,
      confidence_score: assessment.status === 'healthy' ? 95 : assessment.status === 'warning' ? 65 : 40,
      tags: ['survey_ops', assessment.status, mode]
    });

    // Alert admins if critical
    if (assessment.status === 'critical' || (assessment.action_needed && assessment.action)) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'system',
          title: `🚨 Survey Ops Agent: ${assessment.status?.toUpperCase()}`,
          message: assessment.summary,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/SurveyAdminDashboard',
        });
      }
    }

    return Response.json({
      success: true,
      agent: 'survey_ops_superagent',
      duration_ms: Date.now() - start,
      steps_ok: Object.keys(results).length,
      steps_failed: Object.keys(errors).length,
      ai_assessment: assessment,
      errors: Object.keys(errors).length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[SurveyOps] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});