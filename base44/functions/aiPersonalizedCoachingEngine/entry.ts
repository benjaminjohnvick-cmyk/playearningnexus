import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get affiliate's performance data
    const onboarding = await base44.entities.AffiliateOnboarding.filter(
      { affiliate_user_id: user.id },
      '-created_at',
      1
    );

    if (!onboarding.length) {
      return Response.json({ error: 'No affiliate data found' }, { status: 400 });
    }

    const affiliate = onboarding[0];
    const referrals = await base44.entities.Referral.filter(
      { referrer_user_id: user.id },
      '-created_date',
      100
    );

    // Generate personalized coaching
    const coachingPrompt = `Create a personalized coaching plan for this affiliate:
- Tier: ${affiliate.assigned_tier}
- Total followers: ${affiliate.social_media_reach?.total_reach}
- Referrals: ${referrals.length}
- Conversion rate: ${((referrals.filter(r => r.status === 'converted').length / Math.max(referrals.length, 1)) * 100).toFixed(2)}%

Provide: 1) Strengths to leverage, 2) Top 3 specific improvements, 3) Weekly action plan, 4) Motivation.`;

    const coaching = await base44.integrations.Core.InvokeLLM({
      prompt: coachingPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          strengths: { type: 'array', items: { type: 'string' } },
          improvements: { type: 'array', items: { type: 'string' } },
          weekly_actions: { type: 'array', items: { type: 'string' } },
          motivation: { type: 'string' }
        }
      }
    });

    // Send coaching email
    const emailBody = `Your Personalized Coaching Plan\n\nStrengths:\n${coaching.strengths.join('\n')}\n\nTop improvements:\n${coaching.improvements.join('\n')}\n\nThis week:\n${coaching.weekly_actions.join('\n')}\n\n${coaching.motivation}`;

    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: '🎯 Your Personalized Coaching Plan',
      body: emailBody
    });

    return Response.json({ success: true, coaching });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});