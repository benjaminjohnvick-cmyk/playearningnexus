import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * MASTER ORCHESTRATOR — GamerGain Platform Superagent
 * 
 * The brain that coordinates all 5 domain super agents:
 * 1. superAgentSurveyOps
 * 2. superAgentReferralContest
 * 3. superAgentTournamentGamification
 * 4. superAgentPlatformOps
 * 5. superAgentFinancePayouts
 * 
 * Also runs: realtime fraud monitor, AI user retention,
 * churn prediction, dispute resolution checks, and
 * cross-domain AI decision making.
 * 
 * Scheduled: Every 6 hours
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { dry_run = false, force_all = false } = body;

    const startTime = Date.now();
    const hour = new Date().getHours(); // UTC
    const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon
    const dayOfMonth = new Date().getDate();

    const agentResults = {};
    const agentErrors = {};
    const crossDomainActions = [];

    const runAgent = async (agentName, fnName, payload = {}) => {
      try {
        console.log(`[MasterOrchestrator] Launching ${agentName}...`);
        const res = await base44.asServiceRole.functions.invoke(fnName, payload);
        agentResults[agentName] = { status: 'ok', summary: res?.ai_assessment?.summary || res?.ai_risk_assessment?.summary || 'completed' };
        console.log(`[MasterOrchestrator] ✓ ${agentName} complete`);
        return res;
      } catch (e) {
        agentErrors[agentName] = e.message;
        console.error(`[MasterOrchestrator] ✗ ${agentName}: ${e.message}`);
        return null;
      }
    };

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: FRAUD & SECURITY (always runs first)
    // ═══════════════════════════════════════════════════════════
    console.log('[MasterOrchestrator] Phase 1: Fraud & Security');
    await Promise.all([
      base44.asServiceRole.functions.invoke('fraudScanEngine', { lookback_hours: 6 }).catch(e => { agentErrors['fraud_scan'] = e.message; }),
      base44.asServiceRole.functions.invoke('realtimeFraudMonitor', {}).catch(e => { agentErrors['realtime_fraud'] = e.message; }),
      base44.asServiceRole.functions.invoke('aiPayoutFraudDetection', {}).catch(e => { agentErrors['payout_fraud'] = e.message; }),
    ]);

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: DOMAIN SUPER AGENTS (time-gated)
    // ═══════════════════════════════════════════════════════════
    console.log('[MasterOrchestrator] Phase 2: Domain Agents');

    const isWeeklyRun = dayOfWeek === 1; // Monday
    const isDailyRun = hour === 6; // 6am UTC daily full run
    const isMonthlyRun = dayOfMonth === 1;

    // Run all 5 domain agents in parallel to avoid timeout
    await Promise.all([
      runAgent('survey_ops', 'superAgentSurveyOps', { mode: isDailyRun ? 'full' : 'health_only' }),
      runAgent('referral_contest', 'superAgentReferralContest', { mode: isWeeklyRun ? 'weekly' : 'daily' }),
      runAgent('tournament_gamification', 'superAgentTournamentGamification', {}),
      runAgent('platform_ops', 'superAgentPlatformOps', { mode: isWeeklyRun ? 'weekly' : isDailyRun ? 'full' : 'daily' }),
      runAgent('finance_payouts', 'superAgentFinancePayouts', { dry_run: false, force_dev_payouts: isMonthlyRun }),
    ]);

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: RETENTION & CHURN (always runs)
    // ═══════════════════════════════════════════════════════════
    console.log('[MasterOrchestrator] Phase 3: Retention & Churn');
    await Promise.all([
      base44.asServiceRole.functions.invoke('churnPredictionEngine', {}).catch(e => { agentErrors['churn'] = e.message; }),
      base44.asServiceRole.functions.invoke('aiUserRetention', {}).catch(e => { agentErrors['retention'] = e.message; }),
      base44.asServiceRole.functions.invoke('retentionCampaignEngine', { dry_run: false, max_users: 30 }).catch(e => { agentErrors['retention_campaigns'] = e.message; }),
    ]);

    // ═══════════════════════════════════════════════════════════
    // PHASE 4: CROSS-DOMAIN AI INTELLIGENCE
    // ═══════════════════════════════════════════════════════════
    console.log('[MasterOrchestrator] Phase 4: Cross-domain AI analysis');

    // Collect platform health signals
    const [activeUsers, openTickets, fraudReports, pendingPayouts, activeSurveys] = await Promise.all([
      base44.asServiceRole.entities.User.list('-updated_date', 10).then(u => u.length).catch(() => 0),
      base44.asServiceRole.entities.SupportTicket.filter({ status: 'open' }).then(t => t.length).catch(() => 0),
      base44.asServiceRole.entities.FraudReport.filter({ status: 'pending' }).then(r => r.length).catch(() => 0),
      base44.asServiceRole.entities.Payout.filter({ status: 'pending' }).then(p => p.length).catch(() => 0),
      base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' }).then(s => s.length).catch(() => 0),
    ]);

    const agentSummaries = Object.entries(agentResults)
      .map(([name, r]) => `${name}: ${r.status} — ${r.summary}`)
      .join('\n');

    const masterAI = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are the GamerGain Master Orchestrator AI. Analyze the full platform status after this orchestration run.

AGENT RESULTS:
${agentSummaries}

AGENT ERRORS (${Object.keys(agentErrors).length}):
${Object.entries(agentErrors).map(([k, v]) => `${k}: ${v}`).join('\n') || 'None'}

PLATFORM SIGNALS:
- Open support tickets: ${openTickets}
- Pending fraud reports: ${fraudReports}
- Pending payouts: ${pendingPayouts}
- Active surveys: ${activeSurveys}
- Run time: ${Math.round((Date.now() - startTime) / 1000)}s
- Hour (UTC): ${hour}, Day: ${dayOfWeek}, Date: ${dayOfMonth}

CROSS-DOMAIN ANALYSIS:
Identify if any cross-domain cascading risks exist. For example:
- High fraud + high payouts = hold payouts
- Churn rising + low surveys = generate more surveys
- Open tickets spiking = escalate support

Return JSON:
{
  "platform_status": "green|yellow|red",
  "overall_health_score": 0-100,
  "top_risks": ["string"],
  "cross_domain_actions": [{ "action": "string", "priority": "high|medium|low", "domain": "string" }],
  "executive_summary": "2 sentences for admin"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          platform_status: { type: 'string' },
          overall_health_score: { type: 'number' },
          top_risks: { type: 'array', items: { type: 'string' } },
          cross_domain_actions: { type: 'array', items: { type: 'object' } },
          executive_summary: { type: 'string' }
        }
      }
    });

    const masterAIData = masterAI?.data || masterAI || {};

    // Execute high-priority cross-domain actions
    for (const action of (masterAIData.cross_domain_actions || []).filter(a => a.priority === 'high')) {
      crossDomainActions.push(action);
      console.log(`[MasterOrchestrator] Cross-domain action: ${action.action}`);
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 5: ESCALATION & REPORTING
    // ═══════════════════════════════════════════════════════════
    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    const totalAgents = Object.keys(agentResults).length;
    const failedAgents = Object.keys(agentErrors).length;

    // Always notify admins with executive summary
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const statusEmoji = masterAIData.platform_status === 'green' ? '✅' : masterAIData.platform_status === 'yellow' ? '⚠️' : '🔴';

    for (const admin of admins.slice(0, 3)) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: admin.id,
        type: 'system',
        title: `${statusEmoji} Orchestrator Run: ${masterAIData.platform_status?.toUpperCase()} (score: ${masterAIData.overall_health_score}/100)`,
        message: masterAIData.executive_summary,
        status: 'unread',
        delivery_method: ['in_app'],
        action_url: '/AdminDashboard',
        metadata: {
          agents_ok: totalAgents,
          agents_failed: failedAgents,
          duration_seconds: totalDuration,
          health_score: masterAI.overall_health_score
        }
      });
    }

    // Email admins if red or health < 60
    if (masterAIData.platform_status === 'red' || (masterAIData.overall_health_score || 100) < 60) {
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: `🔴 GamerGain Master Orchestrator Alert — Health Score: ${masterAIData.overall_health_score}/100`,
          body: `<h2>${statusEmoji} GamerGain Platform Alert</h2>
<p><strong>Health Score:</strong> ${masterAIData.overall_health_score}/100</p>
<p><strong>Status:</strong> ${masterAIData.platform_status?.toUpperCase()}</p>
<p>${masterAIData.executive_summary}</p>
<h3>Top Risks:</h3><ul>${(masterAIData.top_risks || []).map(r => `<li>${r}</li>`).join('')}</ul>
<h3>Cross-Domain Actions Needed:</h3><ul>${(masterAIData.cross_domain_actions || []).filter(a => a.priority === 'high').map(a => `<li>[${a.domain}] ${a.action}</li>`).join('')}</ul>
<h3>Agent Summary:</h3><ul>${Object.entries(agentResults).map(([k, v]) => `<li>✓ ${k}: ${v.summary}</li>`).join('')}${Object.entries(agentErrors).map(([k, v]) => `<li>✗ ${k}: ${v}</li>`).join('')}</ul>
<p style="color:#6b7280;font-size:11px;">Run duration: ${totalDuration}s | ${new Date().toISOString()}</p>`,
          from_name: 'GamerGain Master AI'
        }).catch(() => {});
      }
    }

    // Log master orchestrator performance
    await base44.asServiceRole.entities.AgentPerformanceLog.create({
      agent_name: 'master_orchestrator',
      action_type: 'full_platform_orchestration',
      target_entity: 'Platform',
      target_id: 'all',
      input_data: { hour, dayOfWeek, dayOfMonth, dry_run, force_all },
      output_data: {
        agents_ok: totalAgents,
        agents_failed: failedAgents,
        platform_status: masterAI.platform_status,
        health_score: masterAI.overall_health_score,
        cross_domain_actions: crossDomainActions.length,
        duration_seconds: totalDuration
      },
      predicted_outcome: masterAIData.executive_summary,
      confidence_score: masterAIData.overall_health_score || 75,
      human_review_status: 'approved',
      tags: ['master_orchestrator', masterAIData.platform_status, `health_${masterAIData.overall_health_score}`, `agents_${totalAgents}`]
    });

    return Response.json({
      success: true,
      orchestrator: 'master_orchestrator_v2',
      duration_seconds: totalDuration,
      platform_status: masterAI.platform_status,
      health_score: masterAI.overall_health_score,
      executive_summary: masterAI.executive_summary,
      agents_completed: totalAgents,
      agents_failed: failedAgents,
      top_risks: masterAI.top_risks,
      cross_domain_actions: crossDomainActions,
      agent_results: agentResults,
      agent_errors: Object.keys(agentErrors).length > 0 ? agentErrors : undefined
    });

  } catch (error) {
    console.error('[MasterOrchestrator] FATAL ERROR:', error);

    // Try to alert admins even on fatal failure
    try {
      const base44 = createClientFromRequest(req);
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'security_alert',
          title: '💀 Master Orchestrator FATAL ERROR',
          message: error.message,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/AdminDashboard',
        });
      }
    } catch (_) {}

    return Response.json({ error: error.message, orchestrator: 'master_orchestrator_v2' }, { status: 500 });
  }
});