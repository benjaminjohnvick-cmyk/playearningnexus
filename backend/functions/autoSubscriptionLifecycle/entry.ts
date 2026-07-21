import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const sub = data;
    if (!sub?.id) return Response.json({ ok: true });

    const user = sub.user_id ? (await base44.asServiceRole.entities.User.filter({ id: sub.user_id }))[0] : null;

    if (event?.type === 'create') {
      // New subscription → welcome email + onboarding notification
      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `🎉 Welcome to ${sub.plan_name || 'Premium'}!`,
          body: `Thank you for subscribing to ${sub.plan_name || 'GamerGain Premium'}! Your subscription is now active. Enjoy all premium benefits including enhanced earnings, priority surveys, and exclusive rewards.`
        });
      }
      await base44.asServiceRole.entities.Notification.create({
        user_id: sub.user_id,
        type: 'subscription_activated',
        title: `⭐ ${sub.plan_name || 'Premium'} Activated!`,
        message: 'Your subscription is active. Enjoy enhanced earnings and exclusive features!',
        is_read: false
      });
    }

    if (event?.type === 'update') {
      if (sub.status === 'cancelled') {
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: '😢 Your subscription has been cancelled',
            body: `Your ${sub.plan_name || 'Premium'} subscription has been cancelled. You'll retain access until ${sub.end_date || 'end of billing period'}. We'd love to have you back — reply to this email for a special comeback offer.`
          });
        }
        // Create retention campaign
        await base44.asServiceRole.entities.RetentionCampaign.create({
          user_id: sub.user_id,
          campaign_type: 'churn_comeback',
          incentive_type: 'premium',
          bonus_amount: 10,
          status: 'triggered',
          expiry_date: new Date(Date.now() + 7 * 86400000).toISOString()
        });
      }

      if (sub.status === 'expired') {
        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.user_id,
          type: 'subscription_expired',
          title: '⚠️ Subscription Expired',
          message: 'Your subscription has expired. Renew now to keep your premium benefits!',
          is_read: false
        });
      }

      // Renewal reminder (7 days before expiry)
      if (sub.end_date) {
        const daysLeft = Math.ceil((new Date(sub.end_date) - Date.now()) / 86400000);
        if (daysLeft === 7 && user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: '⏰ Your subscription renews in 7 days',
            body: `Just a heads up — your ${sub.plan_name || 'Premium'} subscription renews on ${sub.end_date}. No action needed if you'd like to continue enjoying premium benefits!`
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});