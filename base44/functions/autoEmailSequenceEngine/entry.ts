import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: welcome emails, referral emails, re-engagement, weekly reports, milestone emails, withdrawal notifications
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};

    // 1. Referral welcome emails for new referred users
    const recentReferrals = await base44.asServiceRole.entities.Referral.filter({ status: 'pending' }, '-created_date', 50);
    let welcomeEmailsSent = 0;
    for (const referral of recentReferrals) {
      const createdHoursAgo = (Date.now() - new Date(referral.created_date).getTime()) / 3600000;
      if (createdHoursAgo < 2) {
        await base44.asServiceRole.functions.invoke('referralWelcomeEmail', { referral_id: referral.id });
        welcomeEmailsSent++;
      }
    }
    results.welcome_emails_sent = welcomeEmailsSent;

    // 2. Re-engagement emails for inactive referrals
    await base44.asServiceRole.functions.invoke('referralReengagementEmail', {});
    results.reengagement_emails_sent = true;

    // 3. Milestone achievement emails
    await base44.asServiceRole.functions.invoke('referralMilestoneEmail', {});
    results.milestone_emails_sent = true;

    // 4. Referral share emails (follow-up nudges)
    await base44.asServiceRole.functions.invoke('sendReferralShareEmail', {});
    results.referral_share_emails_sent = true;

    // 5. Weekly ad performance reports for advertisers
    await base44.asServiceRole.functions.invoke('sendWeeklyAdReport', {});
    results.weekly_ad_reports_sent = true;

    // 6. Survey notification emails
    await base44.asServiceRole.functions.invoke('sendSurveyNotifications', {});
    results.survey_notifications_sent = true;

    // 7. Withdrawal confirmation notifications
    await base44.asServiceRole.functions.invoke('sendWithdrawalNotification', {});
    results.withdrawal_notifications_sent = true;

    // 8. AI referral email sequences
    await base44.asServiceRole.functions.invoke('aiReferralEmailNotifier', {});
    results.ai_referral_emails_sent = true;

    // 9. Email marketing automation flows
    await base44.asServiceRole.functions.invoke('emailMarketingAutomation', {});
    await base44.asServiceRole.functions.invoke('triggerEmailMarketing', {});
    results.email_marketing_flows_triggered = true;

    // 10. Comeback incentive emails for churned users
    await base44.asServiceRole.functions.invoke('sendComebackIncentive', {});
    results.comeback_incentives_sent = true;

    // 11. Referral email sequences
    const activeSequences = await base44.asServiceRole.entities.ReferralEmailSequence.filter({ status: 'active' });
    results.active_email_sequences = activeSequences.length;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});