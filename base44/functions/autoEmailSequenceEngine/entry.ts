import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: welcome emails, referral emails, re-engagement, weekly reports, milestone emails, withdrawal notifications
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];

  const invoke = async (fn, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(fn, payload);
      return true;
    } catch (e) {
      errors.push({ fn, error: e.message });
      return false;
    }
  };

  // 1. Referral welcome emails for new referred users
  let welcomeEmailsSent = 0;
  try {
    const recentReferrals = await base44.asServiceRole.entities.Referral.filter({ status: 'pending' }, '-created_date', 50);
    for (const referral of recentReferrals) {
      const createdHoursAgo = (Date.now() - new Date(referral.created_date).getTime()) / 3600000;
      if (createdHoursAgo < 2) {
        await invoke('referralWelcomeEmail', { referral_id: referral.id });
        welcomeEmailsSent++;
      }
    }
  } catch (e) {
    errors.push({ fn: 'fetch_referrals', error: e.message });
  }
  results.welcome_emails_sent = welcomeEmailsSent;

  // 2. Re-engagement emails for inactive referrals
  await invoke('referralReengagementEmail', {});
  results.reengagement_emails_sent = true;

  // 3. Milestone achievement emails
  await invoke('referralMilestoneEmail', {});
  results.milestone_emails_sent = true;

  // 4. Referral share emails (follow-up nudges)
  await invoke('sendReferralShareEmail', {});
  results.referral_share_emails_sent = true;

  // 5. Weekly ad performance reports for advertisers
  await invoke('sendWeeklyAdReport', {});
  results.weekly_ad_reports_sent = true;

  // 6. Survey notification emails
  await invoke('sendSurveyNotifications', {});
  results.survey_notifications_sent = true;

  // 7. Withdrawal confirmation notifications
  await invoke('sendWithdrawalNotification', {});
  results.withdrawal_notifications_sent = true;

  // 8. AI referral email sequences
  await invoke('aiReferralEmailNotifier', {});
  results.ai_referral_emails_sent = true;

  // 9. Email marketing automation flows
  await invoke('emailMarketingAutomation', {});
  await invoke('triggerEmailMarketing', {});
  results.email_marketing_flows_triggered = true;

  // 10. Comeback incentive emails for churned users
  await invoke('sendComebackIncentive', {});
  results.comeback_incentives_sent = true;

  // 11. Referral email sequences count
  try {
    const activeSequences = await base44.asServiceRole.entities.ReferralEmailSequence.filter({ is_active: true });
    results.active_email_sequences = activeSequences.length;
  } catch (e) {
    errors.push({ fn: 'fetch_email_sequences', error: e.message });
    results.active_email_sequences = 0;
  }

  return Response.json({ success: true, results, errors });
});