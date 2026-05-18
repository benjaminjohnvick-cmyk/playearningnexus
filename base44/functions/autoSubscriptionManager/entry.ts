import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Daily: manage subscription renewals, expirations, failed payment retries
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const results = { renewed: 0, expired: 0, reminded: 0 };

    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });

    for (const sub of subscriptions) {
      const expiresAt = new Date(sub.expires_at || sub.next_billing_date);
      const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);

      if (daysUntilExpiry <= 0) {
        // Subscription expired
        await base44.asServiceRole.entities.Subscription.update(sub.id, { status: 'expired' });
        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.user_id,
          type: 'subscription_expired',
          title: `⚠️ Your Subscription Has Expired`,
          message: `Your ${sub.plan_name || 'subscription'} has expired. Renew to keep access to premium features.`,
          is_read: false
        });
        results.expired++;
      } else if (daysUntilExpiry <= 3) {
        // Send renewal reminder
        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.user_id,
          type: 'subscription_expiring',
          title: `⏰ Subscription Expiring in ${Math.ceil(daysUntilExpiry)} Day(s)`,
          message: `Your ${sub.plan_name || 'subscription'} expires soon. Renew now to avoid losing access.`,
          is_read: false
        });

        const user = (await base44.asServiceRole.entities.User.filter({ id: sub.user_id }))[0];
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `⏰ Your GamerGain subscription expires in ${Math.ceil(daysUntilExpiry)} day(s)`,
            body: `Hi ${user.full_name || 'Gamer'},\n\nYour ${sub.plan_name || 'GamerGain subscription'} is expiring in ${Math.ceil(daysUntilExpiry)} day(s).\n\nRenew now at gamergain.com to keep your premium benefits.\n\nThe GamerGain Team`
          });
        }
        results.reminded++;
      }
    }

    // Handle failed payment retries
    const failedSubs = await base44.asServiceRole.entities.Subscription.filter({ status: 'payment_failed' });
    for (const sub of failedSubs) {
      const failedAt = new Date(sub.failed_at || sub.updated_date);
      const hoursSinceFail = (now - failedAt) / (1000 * 60 * 60);
      if (hoursSinceFail >= 24) {
        // Retry or expire after 3 days
        const daysSinceFail = hoursSinceFail / 24;
        if (daysSinceFail >= 3) {
          await base44.asServiceRole.entities.Subscription.update(sub.id, { status: 'expired' });
          await base44.asServiceRole.entities.Notification.create({
            user_id: sub.user_id,
            type: 'subscription_cancelled',
            title: `❌ Subscription Cancelled — Payment Failed`,
            message: `We could not process your payment after 3 attempts. Update your payment method to resubscribe.`,
            is_read: false
          });
        } else {
          await base44.asServiceRole.entities.Notification.create({
            user_id: sub.user_id,
            type: 'payment_retry',
            title: `💳 Payment Retry — Action Required`,
            message: `Your subscription payment failed. Please update your payment method to avoid losing access.`,
            is_read: false
          });
        }
      }
    }

    return Response.json({ ok: true, ...results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});