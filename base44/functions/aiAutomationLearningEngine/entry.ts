import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AI Automation Learning Engine
 * 
 * Collects execution data from all automation runs, correlates patterns across
 * functions, and generates improvement insights that are fed back into the system.
 * 
 * Actions:
 *  - record_run: Save a single automation execution record
 *  - analyze_patterns: Cross-correlate all automation data to find improvements
 *  - apply_learnings: Write approved insights back to AgentLearningMemory
 *  - get_dashboard: Return aggregated stats for the learning dashboard
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'analyze_patterns';
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // ── 1. RECORD a single automation run ──────────────────────────────
    if (action === 'record_run') {
      const {
        function_name, success, duration_ms, error_message,
        results_summary, items_processed, triggered_by
      } = body;

      if (!function_name) return Response.json({ error: 'function_name required' }, { status: 400 });

      // Upsert daily stats in AgentPerformanceLog
      const existing = await base44.asServiceRole.entities.AgentPerformanceLog.filter({
        agent_name: function_name,
        log_date: today
      });

      if (existing.length > 0) {
        const log = existing[0];
        // Parse existing summary data
        const prev = log.input_data || {};
        const totalRuns = (prev.total_runs || 0) + 1;
        const successRuns = (prev.successful_runs || 0) + (success ? 1 : 0);
        const totalDuration = (prev.total_duration_ms || 0) + (duration_ms || 0);
        const totalItems = (prev.total_items_processed || 0) + (items_processed || 0);
        await base44.asServiceRole.entities.AgentPerformanceLog.update(log.id, {
          action_type: 'engine_run',
          confidence_score: Math.round((successRuns / totalRuns) * 100),
          outcome_verified: success,
          actual_outcome: success ? 'success' : `failure: ${(error_message || '').slice(0, 200)}`,
          input_data: {
            total_runs: totalRuns,
            successful_runs: successRuns,
            failed_runs: totalRuns - successRuns,
            total_duration_ms: totalDuration,
            total_items_processed: totalItems,
            log_date: today,
            last_run_at: now,
            last_run_status: success ? 'success' : 'failure',
            last_error: error_message || null,
          },
          output_data: results_summary || {},
        });
      } else {
        await base44.asServiceRole.entities.AgentPerformanceLog.create({
          agent_name: function_name,
          action_type: 'engine_run',
          target_entity: 'automation_engine',
          confidence_score: success ? 100 : 0,
          outcome_verified: success,
          actual_outcome: success ? 'success' : `failure: ${(error_message || '').slice(0, 200)}`,
          predicted_outcome: 'success',
          input_data: {
            total_runs: 1,
            successful_runs: success ? 1 : 0,
            failed_runs: success ? 0 : 1,
            total_duration_ms: duration_ms || 0,
            total_items_processed: items_processed || 0,
            log_date: today,
            last_run_at: now,
            last_run_status: success ? 'success' : 'failure',
            last_error: error_message || null,
            triggered_by: triggered_by || 'scheduled',
          },
          output_data: results_summary ? { summary: JSON.stringify(results_summary).slice(0, 2000) } : {},
          human_review_status: 'pending',
        });
      }

      return Response.json({ success: true, recorded: function_name });
    }

    // ── 2. ANALYZE PATTERNS across all automation data ─────────────────
    if (action === 'analyze_patterns') {
      const lookbackDays = body.lookback_days || 7;
      const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString().split('T')[0];

      // Pull all recent performance logs
      const allLogs = await base44.asServiceRole.entities.AgentPerformanceLog.filter({ action_type: 'engine_run' }, '-created_date', 500);
      const recentLogs = allLogs.filter(l => {
        const logDate = (l.input_data?.log_date) || l.created_date?.split('T')[0] || '';
        return logDate >= cutoff;
      });

      if (recentLogs.length === 0) {
        return Response.json({ success: true, insights: [], message: 'No data yet' });
      }

      // Aggregate by function name
      const byFunction = {};
      for (const log of recentLogs) {
        const fn = log.agent_name || 'unknown';
        if (!byFunction[fn]) {
          byFunction[fn] = { runs: 0, successes: 0, failures: 0, totalDuration: 0, totalItems: 0, errors: [] };
        }
        const d = log.input_data || {};
        byFunction[fn].runs += d.total_runs || 1;
        byFunction[fn].successes += d.successful_runs || (log.outcome_verified ? 1 : 0);
        byFunction[fn].failures += d.failed_runs || (log.outcome_verified ? 0 : 1);
        byFunction[fn].totalDuration += d.total_duration_ms || 0;
        byFunction[fn].totalItems += d.total_items_processed || 0;
        if (d.last_error) byFunction[fn].errors.push(d.last_error);
      }

      // Pull recent learning memories for context
      const existingMemories = await base44.asServiceRole.entities.AgentLearningMemory.list('-created_date', 20);

      // Build analysis summary
      const topFailures = Object.entries(byFunction)
        .filter(([, d]) => d.failures > 0)
        .sort(([, a], [, b]) => (b.failures / Math.max(b.runs, 1)) - (a.failures / Math.max(a.runs, 1)))
        .slice(0, 15)
        .map(([fn, d]) => ({
          function: fn,
          failure_rate_pct: Math.round((d.failures / Math.max(d.runs, 1)) * 100),
          total_failures: d.failures,
          common_errors: [...new Set(d.errors)].slice(0, 3)
        }));

      const topPerformers = Object.entries(byFunction)
        .filter(([, d]) => d.runs >= 3 && d.successes / Math.max(d.runs, 1) >= 0.95)
        .sort(([, a], [, b]) => b.totalItems - a.totalItems)
        .slice(0, 10)
        .map(([fn, d]) => ({
          function: fn,
          success_rate_pct: Math.round((d.successes / Math.max(d.runs, 1)) * 100),
          items_processed: d.totalItems
        }));

      const totalRuns = Object.values(byFunction).reduce((s, d) => s + d.runs, 0);
      const totalSuccess = Object.values(byFunction).reduce((s, d) => s + d.successes, 0);
      const overallSuccessRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0;

      // Use AI to generate cross-function improvement insights
      const aiAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an AI automation performance analyst for GamerGain platform.

Analyze this automation execution data from the last ${lookbackDays} days:

OVERALL: ${totalRuns} total runs, ${overallSuccessRate}% success rate across ${Object.keys(byFunction).length} functions

TOP FAILURES (by failure rate):
${JSON.stringify(topFailures, null, 2)}

TOP PERFORMERS:
${JSON.stringify(topPerformers, null, 2)}

EXISTING MEMORIES (recent learnings already applied):
${existingMemories.slice(0, 5).map(m => m.insight || m.learning || '').join('\n')}

Generate specific, actionable improvements. Focus on:
1. Pattern correlations between failing functions (shared root causes)
2. Best practices from top performers that can be applied to failures
3. Scheduling/sequencing optimizations (e.g., run A before B)
4. Data quality issues causing repeated failures
5. Functions that should be merged, split, or reordered

Return exactly 5 high-impact insights.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_health_score: { type: 'number', description: '0-100 platform automation health' },
            key_finding: { type: 'string', description: 'Single most important finding' },
            insights: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  insight_id: { type: 'string' },
                  category: { type: 'string', enum: ['error_fix', 'performance', 'scheduling', 'data_quality', 'architecture'] },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  affected_functions: { type: 'array', items: { type: 'string' } },
                  priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                  estimated_improvement_pct: { type: 'number' },
                  action_steps: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            correlation_patterns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  pattern: { type: 'string' },
                  functions_involved: { type: 'array', items: { type: 'string' } },
                  impact: { type: 'string' }
                }
              }
            }
          }
        }
      });

      // Save insights to AgentLearningMemory using correct entity schema
      let savedInsights = 0;
      for (const insight of (aiAnalysis.insights || [])) {
        // Avoid duplicates by checking content
        const duplicate = existingMemories.find(m =>
          m.content && m.content.includes(insight.title)
        );
        if (!duplicate) {
          await base44.asServiceRole.entities.AgentLearningMemory.create({
            agent_name: 'aiAutomationLearningEngine',
            memory_type: insight.category === 'error_fix' ? 'failure_pattern' :
                          insight.category === 'performance' ? 'success_pattern' :
                          insight.category === 'architecture' ? 'refined_instruction' : 'learned_pattern',
            content: `[${insight.category?.toUpperCase()}] ${insight.title}\n\n${insight.description}\n\nAffected: ${(insight.affected_functions || []).join(', ')}\n\nSteps: ${(insight.action_steps || []).join(' | ')}`,
            recommended_action: (insight.action_steps || []).join(' → '),
            feature_area: insight.category || 'automation',
            ux_friction_score: 100 - (insight.estimated_improvement_pct || 0),
            admin_approved: false,
            is_active: true,
            // Store extra metadata in admin_notes
            admin_notes: JSON.stringify({
              priority: insight.priority,
              estimated_improvement_pct: insight.estimated_improvement_pct,
              affected_functions: insight.affected_functions,
              data_points_analyzed: recentLogs.length,
              health_score: aiAnalysis.overall_health_score
            })
          });
          savedInsights++;
        }
      }

      return Response.json({
        success: true,
        overall_health_score: aiAnalysis.overall_health_score || overallSuccessRate,
        key_finding: aiAnalysis.key_finding,
        total_runs_analyzed: totalRuns,
        functions_analyzed: Object.keys(byFunction).length,
        top_failures: topFailures,
        top_performers: topPerformers,
        insights_generated: savedInsights,
        correlation_patterns: aiAnalysis.correlation_patterns || [],
      });
    }

    // ── 3. APPLY LEARNINGS — push approved insights into live functions ─
    if (action === 'apply_learnings') {
      const pendingMemories = await base44.asServiceRole.entities.AgentLearningMemory.filter({
        admin_approved: false,
        is_active: true
      });

      // Auto-approve low-risk improvements
      let applied = 0;
      for (const memory of pendingMemories) {
        // Extract metadata from admin_notes
        let meta = {};
        try { meta = JSON.parse(memory.admin_notes || '{}'); } catch {}
        const category = memory.feature_area || '';
        const priority = meta.priority || 'medium';
        const autoApprovable = ['scheduling', 'data_quality', 'performance', 'learned_pattern'].includes(category);

        if (autoApprovable && (priority === 'low' || priority === 'medium')) {
          await base44.asServiceRole.entities.AgentLearningMemory.update(memory.id, {
            admin_approved: true,
            evaluated_at: now,
            times_applied: (memory.times_applied || 0) + 1
          });
          applied++;
        }
      }

      return Response.json({ success: true, learnings_applied: applied, pending: pendingMemories.length });
    }

    // ── 4. GET DASHBOARD — aggregated learning stats ───────────────────
    if (action === 'get_dashboard') {
      const [allLogs, memories] = await Promise.all([
        base44.asServiceRole.entities.AgentPerformanceLog.filter({ action_type: 'engine_run' }, '-created_date', 200),
        base44.asServiceRole.entities.AgentLearningMemory.list('-created_date', 50)
      ]);

      const cutoff7d = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const recentLogs = allLogs.filter(l => {
        const d = l.input_data || {};
        return (d.log_date || l.created_date?.split('T')[0] || '') >= cutoff7d;
      });

      const totalRuns = recentLogs.reduce((s, l) => s + ((l.input_data?.total_runs) || 1), 0);
      const totalSuccess = recentLogs.reduce((s, l) => s + ((l.input_data?.successful_runs) || (l.outcome_verified ? 1 : 0)), 0);
      const totalItems = recentLogs.reduce((s, l) => s + ((l.input_data?.total_items_processed) || 0), 0);
      const overallRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0;

      const byFunction = {};
      for (const log of recentLogs) {
        const fn = log.agent_name;
        if (!byFunction[fn]) byFunction[fn] = { runs: 0, successes: 0, items: 0 };
        const d = log.input_data || {};
        byFunction[fn].runs += d.total_runs || 1;
        byFunction[fn].successes += d.successful_runs || (log.outcome_verified ? 1 : 0);
        byFunction[fn].items += d.total_items_processed || 0;
      }

      return Response.json({
        success: true,
        summary: {
          total_runs_7d: totalRuns,
          overall_success_rate: overallRate,
          total_items_processed: totalItems,
          functions_tracked: Object.keys(byFunction).length,
          insights_generated: memories.length,
          insights_applied: memories.filter(m => m.admin_approved).length,
          insights_pending: memories.filter(m => !m.admin_approved && m.is_active).length,
        },
        top_functions: Object.entries(byFunction)
          .sort(([, a], [, b]) => b.items - a.items)
          .slice(0, 10)
          .map(([fn, d]) => ({
            function: fn,
            success_rate: Math.round((d.successes / Math.max(d.runs, 1)) * 100),
            items_processed: d.items,
            runs: d.runs
          })),
        recent_insights: memories.slice(0, 10).map(m => ({
          title: m.title,
          category: m.category,
          priority: m.priority,
          status: m.status,
          estimated_improvement: m.estimated_improvement_pct
        }))
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});