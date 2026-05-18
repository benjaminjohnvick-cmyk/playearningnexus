import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Hourly: evaluate SmartNotificationRules and batch-deliver filtered survey notifications
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const currentHour = now.getHours();
    const results = [];

    // Get all enabled notification rules
    const rules = await base44.asServiceRole.entities.SmartNotificationRule.filter({ enabled: true });

    // Get surveys that went live in the last hour
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const newSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' });
    const recentSurveys = newSurveys.filter(s => s.created_date >= oneHourAgo);

    if (recentSurveys.length === 0) return Response.json({ ok: true, message: 'no_new_surveys' });

    for (const rule of rules) {
      // Check quiet hours (simple check based on UTC hour — a full tz-aware check would require more data)
      const quietStart = parseInt((rule.quiet_hours_start || '22:00').split(':')[0]);
      const quietEnd = parseInt((rule.quiet_hours_end || '08:00').split(':')[0]);
      const inQuietHours = quietStart > quietEnd
        ? (currentHour >= quietStart || currentHour < quietEnd)
        : (currentHour >= quietStart && currentHour < quietEnd);

      if (inQuietHours) continue;

      // Check notify_frequency
      if (rule.notify_frequency === 'daily') {
        const lastNotified = rule.last_notified_at ? new Date(rule.last_notified_at) : null;
        if (lastNotified && (now - lastNotified) < 23 * 60 * 60 * 1000) continue;
      }

      // Filter surveys by rule preferences
      const matchingSurveys = recentSurveys.filter(s => {
        const meetsThreshold = !rule.min_payout_threshold || (s.reward_amount || s.payout || 0) >= rule.min_payout_threshold;
        const meetsCategory = !rule.preferred_categories?.length ||
          rule.preferred_categories.includes(s.category);
        return meetsThreshold && meetsCategory;
      });

      if (matchingSurveys.length === 0) continue;

      const topSurvey = matchingSurveys[0];

      // Send notification via preferred channels
      if ((rule.notify_channels || ['push']).includes('push')) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: rule.user_id,
          type: 'smart_survey_match',
          title: `🎯 ${matchingSurveys.length} Survey${matchingSurveys.length > 1 ? 's' : ''} Match Your Preferences!`,
          message: `Top match: "${topSurvey.title || 'Survey'}" paying $${topSurvey.reward_amount || topSurvey.payout || '?'}. ${matchingSurveys.length > 1 ? `+${matchingSurveys.length - 1} more.` : ''}`,
          is_read: false
        });
      }

      // Update rule stats
      await base44.asServiceRole.entities.SmartNotificationRule.update(rule.id, {
        total_notifications_sent: (rule.total_notifications_sent || 0) + 1,
        last_notified_at: now.toISOString()
      });

      results.push(rule.user_id);
    }

    return Response.json({ ok: true, notified_users: results.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});