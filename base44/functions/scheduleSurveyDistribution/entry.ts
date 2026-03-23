import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    survey_id,
    survey_title,
    channels,
    audience_segment,
    schedule_date,
    email_subject,
    social_caption,
  } = await req.json();

  // Send email confirmation to the survey creator
  if (channels.includes('email')) {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: `Survey Distribution Scheduled: ${survey_title}`,
      body: `
Hi ${user.full_name},

Your survey has been scheduled for distribution!

Survey: ${survey_title}
Channels: ${channels.join(', ')}
Audience: ${audience_segment}
Scheduled For: ${new Date(schedule_date).toLocaleString()}
Email Subject: ${email_subject}
Social Caption: ${social_caption}

We'll notify you once your survey goes live. Log in to the PPC Marketplace to track responses in real time.

— The GamerGain Team
      `.trim()
    });
  }

  // Record the scheduled distribution (store in survey's ai_prompt field as metadata for now)
  await base44.asServiceRole.entities.PPCSurvey.update(survey_id, {
    ai_prompt: JSON.stringify({
      distribution_scheduled: true,
      channels,
      audience_segment,
      schedule_date,
      email_subject,
      social_caption,
      scheduled_by: user.id,
      scheduled_at: new Date().toISOString()
    })
  });

  return Response.json({
    success: true,
    message: `Distribution scheduled for ${new Date(schedule_date).toLocaleString()} to ${audience_segment} via ${channels.join(', ')}`
  });
});