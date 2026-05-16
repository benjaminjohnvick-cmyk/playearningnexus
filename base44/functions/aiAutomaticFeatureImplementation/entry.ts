import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get latest competitive intelligence and UX analysis
    const competitiveReport = await base44.asServiceRole.entities.MarketTrendReport?.filter({
      report_type: 'competitive_intelligence'
    }, '-report_date', 1) || [];

    const uxAnalysis = await base44.asServiceRole.entities.AIEarningsMonitor?.filter({
      report_type: 'survey_ux_analysis'
    }, '-analysis_date', 1) || [];

    const competitiveData = competitiveReport[0] ? JSON.parse(competitiveReport[0].strategic_recommendations) : {};
    const uxData = uxAnalysis[0] ? JSON.parse(uxAnalysis[0].data) : {};

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
    const implementationLog = {
      timestamp: new Date().toISOString(),
      source: 'ai_competitive_ux_analysis',
      tasks: {
        high_priority: implementations.data.high_priority.map(t => ({ task: t, status: 'queued', priority: 'high' })),
        medium_priority: implementations.data.medium_priority.map(t => ({ task: t, status: 'queued', priority: 'medium' })),
        quick_wins: implementations.data.quick_wins.map(t => ({ task: t, status: 'ready_for_deploy', priority: 'critical' }))
      },
      auto_deploy_ready: implementations.data.auto_deploy_items.length,
      manual_review_needed: implementations.data.manual_review_items.length,
      total_tasks: implementations.data.high_priority.length + implementations.data.medium_priority.length + implementations.data.quick_wins.length
    };

    // Store implementation plan
    await base44.asServiceRole.entities.AIEarningsMonitor?.create?.({
      analysis_date: new Date().toISOString(),
      report_type: 'implementation_plan',
      data: JSON.stringify(implementationLog)
    }).catch(() => null);

    // Alert admin about auto-deployable items
    if (implementations.data.quick_wins.length > 0) {
      await base44.integrations.Core.SendEmail({
        to: 'admin@gamergain.com',
        subject: `🚀 AI: ${implementations.data.quick_wins.length} Quick Win Feature Improvements Ready for Deploy`,
        body: `Quick wins ready for immediate implementation:\n${implementations.data.quick_wins.map((q, i) => `${i+1}. ${q}`).join('\n')}\n\nHigh-priority competitive counters:\n${implementations.data.high_priority.slice(0, 3).map((h, i) => `${i+1}. ${h}`).join('\n')}`
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      implementation_plan_generated: true,
      timestamp: new Date().toISOString(),
      total_tasks: implementationLog.total_tasks,
      high_priority_count: implementations.data.high_priority.length,
      medium_priority_count: implementations.data.medium_priority.length,
      quick_wins_ready: implementations.data.quick_wins.length,
      auto_deploy_ready: implementations.data.auto_deploy_items.length,
      manual_review_needed: implementations.data.manual_review_items.length,
      implementation_plan: implementations.data,
      next_review: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});