import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber } from "../../sdk/settings.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type !== 'create') return Response.json({ ok: true });
    const user = data;
    if (!user?.id) return Response.json({ ok: true });

    // Create OnboardingProgress record
    await base44.asServiceRole.entities.OnboardingProgress.create({
      user_id: user.id,
      step: 'welcome',
      completed_steps: [],
      status: 'in_progress'
    });

    // Promotional value figures (single source of truth in settings).
    const advertised = await getNumber("ADVERTISED_VALUE_TOTAL", 2000).catch(() => 2000);
    const welcomeRewards = await getNumber("WELCOME_REWARDS_TOTAL", 1460).catch(() => 1460);

    // Welcome notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: 'welcome',
      title: `🎮 Welcome to GamerGain — up to $${advertised.toLocaleString()} in first-year value!`,
      message: `You have up to $${welcomeRewards.toLocaleString()} in welcome rewards to spend. Complete your profile, explore surveys, and start earning!`,
      is_read: false
    });

    // Send welcome email
    if (user.email) {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `🎮 Welcome to GamerGain — up to $${advertised.toLocaleString()} in first-year value`,
        body: `Hi ${user.full_name || 'Gamer'},\n\nWelcome to GamerGain! As a new member you have up to $${welcomeRewards.toLocaleString()} in welcome rewards to spend, part of up to $${advertised.toLocaleString()} in first-year value.\n\nHere's how to get started:\n1. Complete your profile\n2. Take your first survey and earn cash\n3. Install a featured game for bonus rewards\n4. Invite friends and earn referral commissions\n\nLog in now and start earning: gamergain.com\n\nThe GamerGain Team\n\n---\nWelcome rewards are non-cashable promotional credit that covers up to a set share per order and expires 12 months after signup. "Up to" values reflect the maximum available; actual value depends on your activity. Terms apply.`
      });
    }

    // Schedule profile completion check — create a future reminder flag
    await base44.asServiceRole.entities.UserActivity.create({
      user_id: user.id,
      activity_type: 'account_created',
      points_earned: 10,
      metadata: { source: 'onboarding' }
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});