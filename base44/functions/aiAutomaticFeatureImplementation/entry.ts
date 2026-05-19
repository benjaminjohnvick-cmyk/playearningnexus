import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get latest competitive intelligence and UX analysis
    let competitiveData = {};
    let uxData = {};

    try {
      const competitiveReport = await base44.asServiceRole.entities.MarketTrendReport.filter({
        category: 'competitive_intelligence'
      }, '-created_date', 1);
      if (competitiveReport[0]) {
        competitiveData = competitiveReport[0].ai_insights || {};
      }
    } catch {
      // Entity or data not available
    }

    try {
      const uxAnalysis = await base44.asServiceRole.entities.AIEarningsMonitor?.filter({
        report_type: 'survey_ux_analysis'
      }, '-analysis_date', 1) || [];
      if (uxAnalysis[0]) {
        uxData = JSON.parse(uxAnalysis[0].data);
      }
    } catch {
      // Entity or data not available
    }

    // Prioritize implementation items
    const implementations = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate technical implementation tasks for competitive and UX improvements:

Competitive Priorities: ${competitiveData.critical_features?.join(', ') || 'none'}
UX Improvements: ${uxData.improvements?.platform_feature_improvements?.join(', ') || 'none'}
Threat Level: ${competitiveData.competitive_advantage || 'medium'}

Generate a prioritized implementation plan with:
1. High-priority tasks (implement this week)
2. Medium-priority tasks (implement this month)
3. Low-priority improvements (backlog)
4. Quick wins (can implement immediately)
5. Which improvements can be auto-deployed vs require manual review?`,
      response_json_schema: {
        type: 'object',
        properties: {
          high_priority: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          medium_priority: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          low_priority: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          quick_wins: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          auto_deploy_items: { type: 'array', items: { type: 'string' }, maxItems: 2 },
          manual_review_items: { type: 'array', items: { type: 'string' }, maxItems: 3 }
        }
      }
    });

    // Create implementation tasks in system
    const implData = implementations?.data || {};
    const highPriority = implData.high_priority || [];
    const mediumPriority = implData.medium_priority || [];
    const quickWins = implData.quick_wins || [];
    const autoDeployItems = implData.auto_deploy_items || [];
    const manualReviewItems = implData.manual_review_items || [];
    
    const implementationLog = {
      timestamp: new Date().toISOString(),
      source: 'ai_competitive_ux_analysis',
      tasks: {
        high_priority: highPriority.map(t => ({ task: t, status: 'queued', priority: 'high' })),
        medium_priority: mediumPriority.map(t => ({ task: t, status: 'queued', priority: 'medium' })),
        quick_wins: quickWins.map(t => ({ task: t, status: 'ready_for_deploy', priority: 'critical' }))
      },
      auto_deploy_ready: autoDeployItems.length,
      manual_review_needed: manualReviewItems.length,
      total_tasks: highPriority.length + mediumPriority.length + quickWins.length
    };

    // Store implementation plan
    await base44.asServiceRole.entities.AIEarningsMonitor?.create?.({
      analysis_date: new Date().toISOString(),
      report_type: 'implementation_plan',
      data: JSON.stringify(implementationLog)
    }).catch(() => null);

    // Alert admin about auto-deployable items
    if (quickWins.length > 0) {
      await base44.integrations.Core.SendEmail({
        to: 'admin@gamergain.com',
        subject: `🚀 AI: ${quickWins.length} Quick Win Feature Improvements Ready for Deploy`,
        body: `Quick wins ready for immediate implementation:\n${quickWins.map((q, i) => `${i+1}. ${q}`).join('\n')}\n\nHigh-priority competitive counters:\n${highPriority.slice(0, 3).map((h, i) => `${i+1}. ${h}`).join('\n')}`
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      implementation_plan_generated: true,
      timestamp: new Date().toISOString(),
      total_tasks: implementationLog.total_tasks,
      high_priority_count: highPriority.length,
      medium_priority_count: mediumPriority.length,
      quick_wins_ready: quickWins.length,
      auto_deploy_ready: autoDeployItems.length,
      manual_review_needed: manualReviewItems.length,
      implementation_plan: implData,
      next_review: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});