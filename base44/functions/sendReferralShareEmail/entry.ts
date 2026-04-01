import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, referrerName, referralLink } = await req.json();

    if (!email || !referralLink) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Send personalized invitation email
    const emailBody = `
Hi there,

${referrerName} thinks you'd love GamerGain! 🎮

You can earn real money by:
- Playing games
- Completing surveys
- Participating in contests

Start earning today using this link:
${referralLink}

We even offer payment methods worldwide, so you can cash out whenever you want.

See you on the platform!
The GamerGain Team
    `;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: `${referrerName} invited you to join GamerGain 💰`,
      body: emailBody,
      from_name: 'GamerGain'
    });

    // Create referral record
    await base44.asServiceRole.entities.Referral.create({
      referrer_id: user.id,
      referred_email: email,
      status: 'pending',
      created_date: new Date().toISOString()
    });

    return Response.json({ success: true, message: 'Invitation sent!' });

  } catch (error) {
    console.error('Error sending referral email:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});