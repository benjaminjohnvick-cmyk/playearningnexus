import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all inactive referred users (invited but not converted in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const referrals = await base44.asServiceRole.entities.Referral.filter({
      status: 'pending',
      created_date: { $lt: sevenDaysAgo }
    });

    const results = [];
    
    for (const referral of referrals) {
      // Check if email already sent in last 7 days
      const recentEmail = await base44.asServiceRole.entities.ReferralEmailLog.filter({
        referred_email: referral.referred_email,
        sent_at: { $gt: sevenDaysAgo }
      });

      if (recentEmail.length > 0) continue; // Skip if already sent recently

      // Get referrer info for personalization
      const referrers = await base44.asServiceRole.entities.User.filter({ id: referral.referrer_id });
      const referrer = referrers[0];

      if (!referrer) continue;

      // Generate personalized AI email
      const emailResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate a personalized, friendly re-engagement email for someone who was referred by ${referrer.full_name} to our platform but hasn't joined yet. 
        
The email should:
- Address them by first name (or just "Friend" if unknown)
- Mention that they were invited by ${referrer.full_name}
- Highlight the opportunity to earn money through surveys and games
- Mention they're missing out on real earnings
- Include a call-to-action to join now
- Keep it under 200 words
- Use a friendly, conversational tone
- Make it feel personal and not robotic

Return ONLY the email body text, no subject line needed.`,
      });

      // Send the email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: referral.referred_email,
        subject: `${referrer.full_name} thinks you should check out GamerGain 💰`,
        body: emailResponse,
        from_name: 'GamerGain Team'
      });

      // Log the email send
      await base44.asServiceRole.entities.ReferralEmailLog.create({
        referred_email: referral.referred_email,
        referrer_id: referral.referrer_id,
        referral_id: referral.id,
        sent_at: new Date().toISOString(),
        email_type: 'missing_earnings'
      });

      results.push({ email: referral.referred_email, status: 'sent' });
    }

    return Response.json({
      success: true,
      emailsSent: results.length,
      results
    });

  } catch (error) {
    console.error('Error in aiReferralEmailNotifier:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});