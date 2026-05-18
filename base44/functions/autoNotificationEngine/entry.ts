import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: push notifications, email reminders, survey alerts, payout alerts, streak reminders, weekly top earners
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};

    // 1. Daily reminders for users who haven't completed any survey today
    const today = new Date().toISOString().split('T')[0];
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);
    let reminders = 0;
    for (const u of allUsers.slice(0, 50)) {
      const earnings = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: u.id, date: today });
      if (!earnings || earnings.length === 0 || earnings[0].total_surveys_completed === 0) {
        await base44.asServiceRole.functions.invoke('sendDailyReminder', { user_id: u.id });
        reminders++;
      }
    }
    results.daily_reminders_sent = reminders;

    // 2. Survey match notifications — notify users of new matching surveys
    await base44.asServiceRole.functions.invoke('notifyNewSurveyMatch', {});
    results.survey_match_notifications = true;

    // 3. Streak reminders — users about to lose their streak
    await base44.asServiceRole.functions.invoke('surveyStreakReminder', {});
    results.streak_reminders_sent = true;

    // 4. Payout notification for completed payouts
    await base44.asServiceRole.functions.invoke('sendPPCAdNotification', {});
    results.ppc_ad_notifications_sent = true;

    // 5. Weekly top earners announcement
    await base44.asServiceRole.functions.invoke('notifyWeeklyTopEarners', {});
    results.weekly_top_earners_notified = true;

    // 6. Survey demand alerts
    await base44.asServiceRole.functions.invoke('surveyAlertEngine', {});
    results.survey_alerts_processed = true;

    // 7. Milestone alerts for users approaching earning thresholds
    await base44.asServiceRole.functions.invoke('milestoneAlertChecker', {});
    results.milestone_alerts_checked = true;

    // 8. Price drop alerts for wishlist items
    await base44.asServiceRole.functions.invoke('priceAlertChecker', {});
    results.price_alerts_sent = true;

    // 9. Smart notification rules engine
    const notifRules = await base44.asServiceRole.entities.SmartNotificationRule.filter({ is_active: true });
    results.smart_notification_rules_active = notifRules.length;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});