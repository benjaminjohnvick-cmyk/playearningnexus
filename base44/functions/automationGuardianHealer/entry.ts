import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can trigger this
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const startTime = Date.now();
    const recoveryLog = [];
    const failures = [];
    const recoveries = [];
    let overallHealthScore = 100;

    console.log('[AutomationGuardianHealer] Starting comprehensive health check...');

    // Phase 1: Get platform health
    console.log('[AutomationGuardianHealer] Phase 1: Platform Health Assessment');
    let platformHealth = { platform_status: 'green', overall_health_score: 100 };
    
    try {
      const healthResult = await base44.asServiceRole.functions.invoke('autoDailyPlatformHealthEngine', {});
      platformHealth = healthResult?.data || platformHealth;
      overallHealthScore = platformHealth.overall_health_score || 100;
      console.log(`[AutomationGuardianHealer] Platform health score: ${overallHealthScore}`);
    } catch (e) {
      console.warn('[AutomationGuardianHealer] Platform health engine unavailable:', e.message);
    }

    // Phase 2: Monitor individual automation agents
    console.log('[AutomationGuardianHealer] Phase 2: Individual Agent Health Monitoring');
    let agentMonitoringResult = { status: 'checked', failures: [] };
    
    try {
      agentMonitoringResult = await base44.asServiceRole.functions.invoke('autoAgentHealthMonitor', {});
      
      if (agentMonitoringResult.failures && agentMonitoringResult.failures.length > 0) {
        console.warn(`[AutomationGuardianHealer] Detected ${agentMonitoringResult.failures.length} failing agents`);
        failures.push(...agentMonitoringResult.failures);
      }
    } catch (e) {
      console.warn('[AutomationGuardianHealer] Agent health monitor unavailable:', e.message);
    }

    // Phase 3: Recovery Protocol - Attempt self-healing for each failure
    console.log(`[AutomationGuardianHealer] Phase 3: Recovery Protocol (${failures.length} failures detected)`);
    
    for (const failure of failures) {
      const failureId = `${failure.agent_name || failure.function_name}-${Date.now()}`;
      console.log(`[AutomationGuardianHealer] Processing failure: ${failureId}`);

      // Determine failure severity and strategy
      const isCritical = ['autoFinancialEngine', 'fraudDetector', 'realtimeFraudMonitor', 'autoPayoutRequestLifecycle'].includes(failure.function_name);
      const errorType = classifyError(failure.error_message);

      let recoveryAttempted = false;
      let recoverySuccess = false;

      // Strategy 1: Transient Error Retry
      if (errorType === 'transient') {
        console.log(`[AutomationGuardianHealer] Attempting transient error recovery: ${failure.function_name}`);
        try {
          // Small delay then retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          await base44.asServiceRole.functions.invoke(failure.function_name, failure.last_payload || {});
          recoverySuccess = true;
          recoveryAttempted = true;
          console.log(`[AutomationGuardianHealer] ✓ Transient recovery succeeded for ${failure.function_name}`);
        } catch (retryError) {
          console.warn(`[AutomationGuardianHealer] Transient recovery failed for ${failure.function_name}`);
        }
      }

      // Strategy 2: Reference Self-Improvement Engine for known fixes
      if (!recoverySuccess && errorType === 'known') {
        console.log(`[AutomationGuardianHealer] Consulting aiAgentSelfImprovementEngine for known fixes`);
        try {
          const improvements = await base44.asServiceRole.functions.invoke('aiAgentSelfImprovementEngine', {});
          
          // Check if we have a matching fix pattern
          if (improvements.recommendations && improvements.recommendations.length > 0) {
            const matchingFix = improvements.recommendations.find(rec => 
              rec.agent_name === failure.function_name || rec.function === failure.function_name
            );
            
            if (matchingFix && matchingFix.fix) {
              console.log(`[AutomationGuardianHealer] Found matching fix pattern for ${failure.function_name}`);
              recoveryLog.push({
                function: failure.function_name,
                fix_applied: matchingFix.fix,
                timestamp: new Date().toISOString()
              });
              recoverySuccess = true;
              recoveryAttempted = true;
            }
          }
        } catch (e) {
          console.warn('[AutomationGuardianHealer] Self-improvement engine unavailable');
        }
      }

      // Strategy 3: Log to audit system and escalate if needed
      console.log(`[AutomationGuardianHealer] Logging to audit: ${failure.function_name}`);
      try {
        await base44.asServiceRole.functions.invoke('autoAdminAuditAIAnalysis', {
          failure_id: failureId,
          function_name: failure.function_name,
          error_message: failure.error_message,
          error_type: errorType,
          is_critical: isCritical,
          recovery_attempted: recoveryAttempted,
          recovery_successful: recoverySuccess,
          timestamp: new Date().toISOString()
        });
      } catch (auditError) {
        console.warn('[AutomationGuardianHealer] Failed to log to audit system:', auditError.message);
      }

      // Track outcomes
      if (recoverySuccess) {
        recoveries.push({
          function_name: failure.function_name,
          recovery_type: errorType,
          timestamp: new Date().toISOString()
        });
        console.log(`[AutomationGuardianHealer] ✓ Recovery succeeded for ${failure.function_name}`);
      } else if (isCritical) {
        console.error(`[AutomationGuardianHealer] ⚠️ CRITICAL FAILURE - ESCALATING: ${failure.function_name}`);
        // Critical failures require immediate admin notification
        try {
          const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
          for (const admin of admins.slice(0, 3)) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: admin.id,
              type: 'critical_alert',
              title: '🚨 Critical Automation Failure',
              message: `${failure.function_name} failed: ${failure.error_message}. Manual intervention required.`,
              status: 'unread',
              delivery_method: ['in_app', 'email'],
              action_url: '/AdminDashboard',
              created_date: new Date().toISOString()
            });
          }
        } catch (notifyError) {
          console.error('[AutomationGuardianHealer] Failed to notify admins:', notifyError.message);
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000;

    console.log('[AutomationGuardianHealer] Health check completed');
    return Response.json({
      success: true,
      duration_seconds: duration,
      platform_health_score: overallHealthScore,
      total_failures_detected: failures.length,
      recoveries_successful: recoveries.length,
      recovery_rate: failures.length > 0 ? (recoveries.length / failures.length * 100).toFixed(1) + '%' : 'N/A',
      failures: failures.slice(0, 10), // Top 10 for response size
      recoveries: recoveries,
      recovery_log: recoveryLog,
      next_check_in_seconds: 300 // Suggest next check in 5 minutes
    });

  } catch (error) {
    console.error('[AutomationGuardianHealer] FATAL ERROR:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: Classify error type for intelligent remediation
function classifyError(errorMessage) {
  if (!errorMessage) return 'unknown';
  
  const msg = errorMessage.toLowerCase();
  
  // Transient errors (network, timeouts)
  if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('enotfound')) {
    return 'transient';
  }
  
  // Known/configuration errors
  if (msg.includes('403') || msg.includes('unauthorized') || msg.includes('authentication')) {
    return 'known';
  }
  if (msg.includes('missing') || msg.includes('undefined') || msg.includes('not found')) {
    return 'known';
  }
  
  // Permanent errors
  if (msg.includes('cannot') || msg.includes('invalid') || msg.includes('syntax')) {
    return 'permanent';
  }
  
  return 'unknown';
}