import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch users eligible for email nurture sequences
    const users = await base44.entities.User.filter({}, '-created_date', 500);
    
    let emailsSent = 0;
    let throttled = 0;
    const sequences = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (const appUser of users) {
      try {
        // Daily email throttle — max 1 automated email per user per day
        const lastEmailDate = appUser.last_automated_email_date?.split('T')[0];
        if (lastEmailDate === todayStr) { throttled++; continue; }

        // Get user profile and activity data
        const userProfile = {
          name: appUser.full_name,
          email: appUser.email,
          signup_days_ago: Math.floor((new Date() - new Date(appUser.created_date)) / (1000 * 60 * 60 * 24)),
          engagement_level: appUser.engagement_score || 'unknown',
          interests: appUser.survey_interests || []
        };

        // Use AI to generate personalized email sequence
        const emailSequence = await base44.integrations.Core.InvokeLLM({
          prompt: `Generate a personalized email sequence for this user.

User Profile:
- Name: ${userProfile.name}
- Days Since Signup: ${userProfile.signup_days_ago}
- Engagement: ${userProfile.engagement_level}
- Interests: ${userProfile.interests.join(', ') || 'general'}

Return JSON with:
1. email_subject: compelling subject line
2. email_body: personalized message (max 200 words)
3. call_to_action: specific action to promote
4. send_delay_hours: hours to wait before sending
5. confidence: 0-100`,
          response_json_schema: {
            type: 'object',
            properties: {
              email_subject: { type: 'string' },
              email_body: { type: 'string' },
              call_to_action: { type: 'string' },
              send_delay_hours: { type: 'number' },
              confidence: { type: 'number' }
            }
          }
        });

        // Send if high confidence
        if (emailSequence.confidence >= 75) {
          await base44.integrations.Core.SendEmail({
            to: appUser.email,
            subject: emailSequence.email_subject,
            body: emailSequence.email_body,
            from_name: 'GamerGain'
          });
          await base44.entities.User.update(appUser.id, { last_automated_email_date: new Date().toISOString() });
          emailsSent++;
        }

        sequences.push({
          user_id: appUser.id,
          user_email: appUser.email,
          subject: emailSequence.email_subject,
          cta: emailSequence.call_to_action,
          confidence: emailSequence.confidence,
          sent: emailSequence.confidence >= 75,
          awaiting_review: emailSequence.confidence < 75 && emailSequence.confidence >= 65
        });
      } catch (error) {
        console.error(`Email generation failed for user ${appUser.id}:`, error);
      }
    }

    return Response.json({
      users_analyzed: users.length,
      emails_sent: emailsSent,
      throttled,
      awaiting_review: sequences.filter(s => s.awaiting_review).length,
      sample_sequences: sequences.slice(0, 20)
    });
  } catch (error) {
    console.error('Email sequence error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});