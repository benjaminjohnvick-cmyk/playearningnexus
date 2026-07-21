import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data, changed_fields } = body;

  try {
    if (event?.type !== 'update') return Response.json({ ok: true });
    const settings = data;
    const changedKeys = changed_fields || [];

    const impacts = [];

    // Maintenance mode toggle
    if (changedKeys.includes('maintenance_mode')) {
      if (settings.maintenance_mode) {
        // Notify all users of maintenance
        await base44.asServiceRole.entities.Notification.create({
          user_id: 'broadcast',
          type: 'maintenance',
          title: `🔧 Scheduled Maintenance in Progress`,
          message: settings.maintenance_message || 'GamerGain is undergoing brief maintenance. We\'ll be back shortly!',
          is_read: false
        });
      }
      impacts.push('maintenance_mode_toggled');
    }

    // Payout threshold change
    if (changedKeys.includes('min_payout_threshold')) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: 'broadcast',
        type: 'payout_threshold_update',
        title: `💰 Payout Threshold Updated to $${settings.min_payout_threshold}`,
        message: `The minimum payout threshold has been updated. Check your withdrawal settings for details.`,
        is_read: false
      });
      impacts.push('payout_threshold_updated');
    }

    // Survey reward rate change
    if (changedKeys.includes('survey_reward_multiplier') || changedKeys.includes('base_survey_reward')) {
      impacts.push('survey_rewards_updated');
    }

    // Log the change to AdminAuditLog
    await base44.asServiceRole.entities.AdminAuditLog.create({
      action: 'global_settings_updated',
      changed_fields: changedKeys,
      old_values: old_data,
      new_values: settings,
      timestamp: new Date().toISOString(),
      source: 'auto_broadcast'
    });

    return Response.json({ ok: true, impacts });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});