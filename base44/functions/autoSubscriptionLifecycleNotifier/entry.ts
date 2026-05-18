import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const sub = data;
    if (!sub?.id) return Response.json({ ok: true });

    const user = sub.user_id ? (await base44.asServiceRole.entities.User.filter({ id: sub.user_id }))[0] : null;

    if (event?.type === 'create') {
      // Welcome subscription email
      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `🌟 Welcome to ${sub.plan_name || 'GamerGain Premium'}!`,
          body: `Your subscription to "${sub.plan_name || 'Premium'}" is now active! You now have access to all premium features. Next billing: ${sub.next_billing_date || 'monthly'}. Thank you for supporting GamerGain!`
        });
      }
      if (sub.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.user_id,
          type: 'subscription_activated',
          title: `🌟 Subscription Activated!`,
          message: `Your ${sub.plan_name || 'Premium'} subscription is now active. Enjoy all premium features!`,
          is_read: false
        });
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: sub.user_id,
          activity_type: 'subscription_started',
          points_earned: 100,
          metadata: { plan: sub.plan_name }
        });
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = sub.status;
      if (oldStatus === newStatus) return Response.json({ ok: true });

      if (newStatus === 'cancelled') {
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `😢 Subscription Cancelled`,
            body: `Your ${sub.plan_name || 'Premium'} subscription has been cancelled. Access continues until ${sub.expires_at || 'end of billing period'}. We hope to see you back soon!`
          });
        }
        if (sub.user_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: sub.user_id,
            type: 'subscription_cancelled',
            title: `Subscription Cancelled`,
            message: `Your ${sub.plan_name || 'Premium'} subscription has been cancelled. Access continues until end of billing period.`,
            is_read: false
          });
        }
      }

      if (newStatus === 'renewed') {
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `✅ Subscription Renewed — ${sub.plan_name}`,
            body: `Your ${sub.plan_name || 'Premium'} subscription has been successfully renewed for another period. Thank you!`
          });
        }
      }

      if (newStatus === 'expired') {
        if (sub.user_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: sub.user_id,
            type: 'subscription_expired',
            title: `⚠️ Subscription Expired`,
            message: `Your ${sub.plan_name || 'Premium'} subscription has expired. Renew now to keep your premium benefits!`,
            is_read: false
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});