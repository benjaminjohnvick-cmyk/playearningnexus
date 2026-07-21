import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id, flow_type, trigger_event } = await req.json();

    if (!user_id || !flow_type) {
      return Response.json({ error: 'Missing user_id or flow_type' }, { status: 400 });
    }

    const user = await base44.asServiceRole.entities.User.filter({ id: user_id }).then(r => r[0]);
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const flowTemplates = {
      welcome_series: [
        {
          subject: `Welcome to GamerGain, {{user_name}}! 🎮`,
          body: `Hi {{user_name}},\n\nWelcome to GamerGain! We're thrilled to have you join our community of gamers earning real rewards.\n\nHere's how to get started:\n1. Complete your profile\n2. Take your first survey\n3. Earn your first reward\n\nLet's go! 🚀`,
          delay: 0,
        },
        {
          subject: `You're 2 surveys away from $5! 💰`,
          body: `Hey {{user_name}},\n\nYou've started strong! Complete 2 more surveys to earn your first $5.\n\nHere are high-paying surveys waiting for you:\n{{available_surveys}}\n\nKeep the momentum! ⚡`,
          delay: 86400000, // 1 day
        },
        {
          subject: `Your weekly rewards summary 📊`,
          body: `Hi {{user_name}},\n\nGreat week! You've completed {{surveys_this_week}} surveys and earned ${{earnings_this_week}}.\n\nNext week, we'll have even better surveys for you.\n\nKeep playing! 🏆`,
          delay: 604800000, // 7 days
        },
      ],
      inactive_winback: [
        {
          subject: `We miss you, {{user_name}}! 😢`,
          body: `Hi {{user_name}},\n\nWe noticed you haven't completed any surveys in {{days_inactive}} days.\n\nWe've curated personalized surveys just for you with higher payouts to help you get back on track.\n\nCome back and earn: {{personalized_surveys}}\n\nWe're waiting for you! 🎯`,
          delay: 0,
        },
        {
          subject: `Double rewards for your comeback 2x 🎉`,
          body: `{{user_name}},\n\nHere's an exclusive offer: Complete your next survey and get 2x the reward!\n\nYour {{days_inactive}} day absence means you're due for some serious earnings.\n\nClaim your double reward: {{bonus_survey_link}}\n\nLet's go! 🚀`,
          delay: 259200000, // 3 days
        },
      ],
      milestone_congratulations: [
        {
          subject: `Congrats! You've earned your first $10! 🎊`,
          body: `{{user_name}},\n\nCongratulations on reaching your first $10!\n\nThis is just the beginning. Users like you average ${{avg_monthly_earnings}}/month.\n\nYour next milestone: $25 ({{surveys_until_25}} surveys away)\n\nKeep crushing it! 💪`,
          delay: 0,
        },
      ],
    };

    const template = flowTemplates[flow_type]?.[0];
    if (!template) {
      return Response.json({ error: 'Invalid flow type' }, { status: 400 });
    }

    // Personalize email
    let emailBody = template.body
      .replace('{{user_name}}', user.full_name)
      .replace('{{days_inactive}}', Math.floor((Date.now() - new Date(user.last_survey_date)) / 86400000))
      .replace('{{surveys_this_week}}', user.surveys_completed || 0)
      .replace('{{earnings_this_week}}', user.total_earnings || 0)
      .replace('{{avg_monthly_earnings}}', Math.floor((user.total_earnings || 0) * 30 / user.account_age_days))
      .replace('{{surveys_until_25}}', Math.max(0, Math.ceil(25 / (user.total_earnings / (user.surveys_completed || 1)))));

    let emailSubject = template.subject.replace('{{user_name}}', user.full_name);

    // Create email marketing flow record
    const flowRecord = await base44.asServiceRole.entities.EmailMarketingFlow.create({
      flow_type,
      user_id,
      user_email: user.email,
      user_name: user.full_name,
      trigger_event: trigger_event || flow_type,
      step: 1,
      total_steps: flowTemplates[flow_type].length,
      email_subject: emailSubject,
      email_body: emailBody,
      personalization_data: {
        surveys_completed: user.surveys_completed,
        total_earnings: user.total_earnings,
        account_age_days: user.account_age_days,
      },
      scheduled_send_at: new Date(Date.now() + template.delay).toISOString(),
      status: 'scheduled',
    });

    // Send email via Core integration
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: emailSubject,
      body: emailBody,
      from_name: 'GamerGain',
    });

    // Mark as sent
    await base44.asServiceRole.entities.EmailMarketingFlow.update(flowRecord.id, {
      sent_at: new Date().toISOString(),
      status: 'sent',
    });

    return Response.json({
      success: true,
      flow_id: flowRecord.id,
      user_email: user.email,
      steps_remaining: flowTemplates[flow_type].length - 1,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});