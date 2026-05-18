import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 5: Admin & Operations Automation
// Handles: Game rotation, order fulfillment, user management, audit logging, dispute resolution
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};

    // 1. Featured Game Rotation
    await base44.asServiceRole.functions.invoke('autoFeaturedGameRotation', {});
    results.game_rotation_run = true;

    // 2. Order Fulfillment — place external orders and track shipping
    await base44.asServiceRole.functions.invoke('autoOrderFulfillmentAndFundsRelease', {});
    await base44.asServiceRole.functions.invoke('aiOrderFulfillment', {});
    await base44.asServiceRole.functions.invoke('aiOrderVetting', {});
    results.orders_fulfilled = true;

    // 3. User Onboarding & Management
    await base44.asServiceRole.functions.invoke('autoProfileSetup', {});
    await base44.asServiceRole.functions.invoke('autoProfileCompletion', {});
    await base44.asServiceRole.functions.invoke('autoVIPUserManagement', {});
    await base44.asServiceRole.functions.invoke('dailyTierCheck', {});
    await base44.asServiceRole.functions.invoke('updateUserTiers', {});
    results.user_management_run = true;

    // 4. Audit Logging & Monitoring
    await base44.asServiceRole.functions.invoke('autoAuditLogMonitoring', {});
    await base44.asServiceRole.functions.invoke('adminAuditLogAnalyzer', {});
    results.audit_monitoring_run = true;

    // 5. Dispute Resolution
    await base44.asServiceRole.functions.invoke('autoDisputeLifecycle', {});
    await base44.asServiceRole.functions.invoke('autoDisputeResolution', {});
    await base44.asServiceRole.functions.invoke('aiDisputeResolver', {});
    results.disputes_processed = true;

    // 6. Live Event Management
    await base44.asServiceRole.functions.invoke('autoLiveEventManagement', {});
    results.events_managed = true;

    // 7. Partner Tier & Settings Sync
    await base44.asServiceRole.functions.invoke('autoPartnerTierAndSettings', {});
    results.partner_tiers_synced = true;

    // 8. Business Client Auto-registration & verification
    await base44.asServiceRole.functions.invoke('verifyBusinessClient', { batch: true });
    await base44.asServiceRole.functions.invoke('autoRegisterBusinessClient', {});
    results.business_clients_verified = true;

    // 9. Compliance Monitoring
    await base44.asServiceRole.functions.invoke('autoComplianceMonitoring', {});
    results.compliance_checked = true;

    await base44.asServiceRole.entities.AdminAuditLog.create({
      action: 'auto_admin_ops_engine_run',
      details: JSON.stringify(results),
      timestamp: new Date().toISOString()
    });

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});