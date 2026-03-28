import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Called when a new user registers (entity automation on User create)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data?.id) return Response.json({ error: 'Missing user data' }, { status: 400 });

    const user = data;

    const prompt = `You are an AI onboarding specialist for GamerGain, a gaming rewards and survey platform.

New User Profile:
- Name: ${user.full_name}
- Email: ${user.email}
- Joined: ${user.created_date}

Generate a personalized onboarding plan and welcome message for this user. 
Focus on the most impactful first steps to help them earn money quickly through surveys and referrals.`;

    const plan = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          welcome_message: { type: 'string' },
          first_steps: { type: 'array', items: { type: 'string' } },
          recommended_surveys: { type: 'array', items: { type: 'string' } },
          earning_potential: { type: 'string' },
          personalized_tips: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Send welcome notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: 'onboarding',
      title: `👋 Welcome to GamerGain, ${user.full_name}!`,
      message: plan.welcome_message,
      is_read: false
    });

    // Send welcome email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: `Welcome to GamerGain, ${user.full_name}! Here's your personalized earning plan 🎮`,
      body: `
Hi ${user.full_name},

${plan.welcome_message}

YOUR PERSONALIZED FIRST STEPS:
${(plan.first_steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}

YOUR EARNING POTENTIAL:
${plan.earning_potential}

PERSONALIZED TIPS FOR YOU:
${(plan.personalized_tips || []).map(t => `• ${t}`).join('\n')}

Get started now at GamerGain!

Best,
The GamerGain AI Team
      `
    });

    return Response.json({ success: true, user_id: user.id });
  } catch (error) {
    console.error('AI onboarding error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});