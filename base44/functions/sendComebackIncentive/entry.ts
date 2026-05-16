import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id, email, churn_score } = await req.json();

    if (!user_id) {
      return Response.json({ error: 'user_id required' }, { status: 400 });
    }

    // Determine incentive tier based on churn score
    let incentiveType = 'standard';
    let bonusAmount = 2;
    let message = 'Come back and earn $2 bonus credit!';

    if (churn_score > 85) {
      incentiveType = 'premium';
      bonusAmount = 5;
      message = 'Special comeback offer: $5 bonus credit just for you!';
    } else if (churn_score > 75) {
      incentiveType = 'enhanced';
      bonusAmount = 3;
      message = 'We miss you! Get $3 bonus credit when you complete a survey.';
    }

    // Send email via Twilio SendGrid or similar
    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `🎉 We miss you! ${message}`,
        body: `
          <h2>Come Back to GamerGain!</h2>
          <p>We've noticed you haven't been active lately.</p>
          <p><strong>${message}</strong></p>
          <p>Your account is all set, just log in and start earning!</p>
          <p><a href="https://gamergain.com/login">Log in now</a></p>
        `,
      });
    } catch (e) {
      console.error('Email send failed:', e);
    }

    // Create a comeback offer record
    await base44.asServiceRole.entities.RetentionCampaign.create({
      user_id,
      campaign_type: 'churn_comeback',
      incentive_type: incentiveType,
      bonus_amount: bonusAmount,
      churn_score,
      status: 'triggered',
    });

    return Response.json({ success: true, incentive_type: incentiveType });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});