import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: push notifications, email reminders, survey alerts, payout alerts, streak reminders, weekly top earners
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      errors.push({ fn: name, error: e.message });
    }
  };

  // 1. Daily reminders for users who haven't completed any survey today
  try {
    const today = new Date().toISOString().split('T')[0];
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 50);
    let reminders = 0;
    for (const u of allUsers) {
      try {
        const earnings = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: u.id, date: today });
        if (!earnings || earnings.length === 0 || earnings[0].total_surveys_completed === 0) {
          await base44.asServiceRole.functions.invoke('sendDailyReminder', { user_id: u.id });
          reminders++;
        }
      } catch (e) {
        errors.push({ fn: 'sendDailyReminder', id: u.id, error: e.message });
      }
    }
    results.daily_reminders_sent = reminders;
  } catch (e) {
    errors.push({ fn: 'daily_reminders', error: e.message });
  }

  // 2. Survey match notifications
  await invoke('notifyNewSurveyMatch');
  results.survey_match_notifications = true;

  // 3. Streak reminders
  await invoke('surveyStreakReminder');
  results.streak_reminders_sent = true;

  // 4. PPC ad notifications
  await invoke('sendPPCAdNotification');
  results.ppc_ad_notifications_sent = true;

  // 5. Weekly top earners announcement
  await invoke('notifyWeeklyTopEarners');
  results.weekly_top_earners_notified = true;

  // 6. Survey demand alerts
  await invoke('surveyAlertEngine');
  results.survey_alerts_processed = true;

  // 7. Milestone alerts
  await invoke('milestoneAlertChecker');
  results.milestone_alerts_checked = true;

  // 8. Price drop alerts
  await invoke('priceAlertChecker');
  results.price_alerts_sent = true;

  // 9. Smart notification rules engine
  try {
    const notifRules = await base44.asServiceRole.entities.SmartNotificationRule.filter({ is_active: true });
    results.smart_notification_rules_active = notifRules.length;
  } catch (e) {
    errors.push({ fn: 'smart_notification_rules', error: e.message });
  }

  return Response.json({ success: true, results, errors });
});