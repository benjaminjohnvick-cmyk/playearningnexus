import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Auto Learning Data Collector
 * 
 * Wraps every major engine invocation and records execution telemetry.
 * Called by masterOrchestrator after each engine run to build the learning dataset.
 * Also runs as a standalone scheduled function to analyze collected data.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // List of all major engine functions to collect data from
    const ENGINE_FUNCTIONS = [
      'masterOrchestrator', 'autoFinancialEngine', 'autoSocialAndAffiliateEngine',
      'autoSupportAndDisputeEngine', 'autoGrowthAndOnboardingEngine', 'autoDataAnalyticsEngine',
      'autoEngagementEngine', 'autoMarketingAutomationEngine', 'autoTransactionReconciliation',
      'autoAffiliateAndStreamerEngine', 'autoDeveloperManagementEngine', 'autoWeeklyScheduledOps',
      'autoWeeklyReportsEngine', 'autoDailyPlatformHealthEngine', 'autoStreamingAndContentEngine',
      'autoStreakAndGamificationEngine', 'autoRewardRedemptionEngine', 'autoSupportTicketEngine',
      'autoCreatorEconomyEngine', 'autoNotificationEngine', 'autoTournamentEngine',
      'autoTournamentLifecycleEngine', 'autoCommunityEngine', 'autoTransferAndGiftEngine',
      'autoFraudSecurityEngine', 'autoCRMAndLeadEngine', 'autoMarketingCampaignEngine',
      'autoUserOnboardingEngine', 'autoDailyOperationsEngine', 'autoDailyScheduledOps',
      'autoHourlyPlatformOptimizer', 'autoOrderLifecycleEngine', 'autoSubscriptionEngine',
    ];

    if (body.action === 'collect_all') {
      // Invoke all engines with instrumentation wrappers
      const results = {};
      const errors = [];

      for (const fnName of ENGINE_FUNCTIONS) {
        const start = Date.now();
        try {
          const res = await base44.asServiceRole.functions.invoke(fnName, {});
          const duration = Date.now() - start;
          const resData = res?.data || res || {};
          const itemsProcessed = extractItemCount(resData);

          // Record the run
          await base44.asServiceRole.functions.invoke('aiAutomationLearningEngine', {
            action: 'record_run',
            function_name: fnName,
            success: true,
            duration_ms: duration,
            items_processed: itemsProcessed,
            results_summary: resData,
            triggered_by: 'autoLearningDataCollector'
          }).catch(() => {});

          results[fnName] = { success: true, duration_ms: duration, items: itemsProcessed };
        } catch (err) {
          const duration = Date.now() - start;
          errors.push({ fn: fnName, error: err.message });

          await base44.asServiceRole.functions.invoke('aiAutomationLearningEngine', {
            action: 'record_run',
            function_name: fnName,
            success: false,
            duration_ms: duration,
            error_message: err.message.slice(0, 500),
            triggered_by: 'autoLearningDataCollector'
          }).catch(() => {});

          results[fnName] = { success: false, error: err.message.slice(0, 200) };
        }
      }

      // After collecting, trigger pattern analysis
      const analysis = await base44.asServiceRole.functions.invoke('aiAutomationLearningEngine', {
        action: 'analyze_patterns',
        lookback_days: 7
      }).catch(e => ({ error: e.message }));

      // Apply safe learnings automatically
      await base44.asServiceRole.functions.invoke('aiAutomationLearningEngine', {
        action: 'apply_learnings'
      }).catch(() => {});

      return Response.json({
        success: true,
        engines_run: ENGINE_FUNCTIONS.length,
        engine_results: results,
        errors,
        analysis_triggered: true,
        analysis_summary: analysis?.data?.key_finding || analysis?.key_finding || 'Analysis queued'
      });
    }

    if (body.action === 'analyze_only') {
      const result = await base44.asServiceRole.functions.invoke('aiAutomationLearningEngine', {
        action: 'analyze_patterns',
        lookback_days: body.lookback_days || 7
      });
      return Response.json(result?.data || result);
    }

    if (body.action === 'get_dashboard') {
      const result = await base44.asServiceRole.functions.invoke('aiAutomationLearningEngine', {
        action: 'get_dashboard'
      });
      return Response.json(result?.data || result);
    }

    // Default: run analysis on existing data
    const result = await base44.asServiceRole.functions.invoke('aiAutomationLearningEngine', {
      action: 'analyze_patterns',
      lookback_days: 7
    });
    return Response.json(result?.data || result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: extract total item count from an engine result object
function extractItemCount(data) {
  if (!data || typeof data !== 'object') return 0;
  let count = 0;
  const results = data.results || data;
  for (const val of Object.values(results)) {
    if (typeof val === 'number' && val > 0 && val < 100000) count += val;
  }
  return count;
}