import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 5: Admin & Operations Automation
// Handles: Game rotation, order fulfillment, user management, audit logging, dispute resolution
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};
    const errors = [];

    const invoke = async (fn, payload = {}) => {
      try {
        await base44.asServiceRole.functions.invoke(fn, payload);
        return true;
      } catch (e) {
        errors.push(`${fn}: ${e.message}`);
        return false;
      }
    };

  // 1. Featured Game Rotation
  await invoke('autoFeaturedGameRotation');
  results.game_rotation_run = true;

  // 2. Order Fulfillment — place external orders and track shipping
  await invoke('autoOrderFulfillmentAndFundsRelease');
  await invoke('aiOrderFulfillment');
  await invoke('aiOrderVetting');
  results.orders_fulfilled = true;

  // 3. User Onboarding & Management
  await invoke('autoProfileSetup');
  await invoke('autoProfileCompletion');
  await invoke('autoVIPUserManagement');
  await invoke('dailyTierCheck');
  await invoke('updateUserTiers');
  results.user_management_run = true;

  // 4. Audit Logging & Monitoring
  await invoke('autoAuditLogMonitoring');
  await invoke('adminAuditLogAnalyzer');
  results.audit_monitoring_run = true;

  // 5. Dispute Resolution
  await invoke('autoDisputeLifecycle');
  await invoke('autoDisputeResolution');
  await invoke('aiDisputeResolver');
  results.disputes_processed = true;

  // 6. Live Event Management
  await invoke('autoLiveEventManagement');
  results.events_managed = true;

  // 7. Partner Tier & Settings Sync
  await invoke('autoPartnerTierAndSettings');
  results.partner_tiers_synced = true;

  // 8. Business Client Auto-registration & verification
  await invoke('verifyBusinessClient', { batch: true });
  await invoke('autoRegisterBusinessClient');
  results.business_clients_verified = true;

  // 9. Compliance Monitoring
  await invoke('autoComplianceMonitoring');
  results.compliance_checked = true;

    try {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        action_type: 'other',
        actor_email: 'system@gamergain.com',
        details: `auto_admin_ops_engine_run: ${JSON.stringify(results)}`
      });
    } catch (e) {
      errors.push(`audit_log: ${e.message}`);
    }

    return Response.json({ success: true, results, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});