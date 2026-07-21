import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Find inactive affiliates (no activity in 14+ days)
    const onboardings = await base44.entities.AffiliateOnboarding.filter({}, '-created_at', 200);
    
    const winBackTargets = [];

    for (const onboarding of onboardings) {
      const recentReferrals = await base44.entities.Referral.filter(
        { referrer_user_id: onboarding.affiliate_user_id },
        '-created_date',
        1
      );

      const daysSinceLastActivity = recentReferrals.length > 0
        ? (Date.now() - new Date(recentReferrals[0].created_date).getTime()) / (1000 * 60 * 60 * 24)
        : (Date.now() - new Date(onboarding.created_at).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLastActivity >= 14 && daysSinceLastActivity < 60) { // Don't re-engage very old users yet
        winBackTargets.push({
          affiliate_id: onboarding.affiliate_user_id,
          email: onboarding.affiliate_email,
          tier: onboarding.assigned_tier,
          days_inactive: Math.floor(daysSinceLastActivity)
        });
      }
    }

    // Send personalized win-back emails
    const emailsSent = [];
    for (const target of winBackTargets) {
      const emailSubject = `We Miss You! 🎯 New ${target.tier.toUpperCase()} Tier Opportunities`;
      const emailBody = `Hi there! You've been quiet for ${target.days_inactive} days.\n\nWe've prepared new high-paying campaigns tailored to your ${target.tier} tier. Don't miss out!\n\nLog in now to see exclusive opportunities: https://gamergain.app/dashboard\n\nBest,\nGamerGain Team`;

      try {
        await base44.integrations.Core.SendEmail({
          to: target.email,
          subject: emailSubject,
          body: emailBody,
          from_name: 'GamerGain Affiliates'
        });
        emailsSent.push(target.affiliate_id);
      } catch (e) {
        console.error(`Failed to send email to ${target.email}:`, e.message);
      }
    }

    return Response.json({
      success: true,
      targets_identified: winBackTargets.length,
      emails_sent: emailsSent.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});