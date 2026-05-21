import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get referral data for the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weeklyReferrals = await base44.entities.Referral.filter(
      { referrer_user_id: user.id },
      '-created_date',
      100
    );

    const weeklyData = weeklyReferrals.filter(r => new Date(r.created_date) >= new Date(sevenDaysAgo));

    const stats = {
      total_referrals: weeklyData.length,
      conversions: weeklyData.filter(r => r.status === 'converted').length,
      total_revenue: weeklyData.reduce((sum, r) => sum + (r.amount_earned || 0), 0),
      avg_conversion_rate: weeklyData.length > 0 
        ? ((weeklyData.filter(r => r.status === 'converted').length / weeklyData.length) * 100).toFixed(2)
        : 0
    };

    // Generate report summary using AI
    const reportPrompt = `Create a brief, motivational weekly performance summary for an affiliate:\n\n- Total Referrals: ${stats.total_referrals}\n- Conversions: ${stats.conversions}\n- Revenue Generated: $${stats.total_revenue.toFixed(2)}\n- Conversion Rate: ${stats.avg_conversion_rate}%\n\nInclude: 1) Performance highlights, 2) One actionable tip, 3) Motivational closing.`;

    const reportSummary = await base44.integrations.Core.InvokeLLM({
      prompt: reportPrompt
    });

    // Email the report
    const emailBody = `Your Weekly Performance Report\n\n${reportSummary}\n\nView detailed analytics: https://gamergain.app/dashboard\n\nKeep crushing it!`;

    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `Your Weekly Report: ${stats.total_referrals} Referrals, $${stats.total_revenue.toFixed(2)} Earned`,
      body: emailBody,
      from_name: 'GamerGain'
    });

    return Response.json({
      success: true,
      stats,
      report_sent: true
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});