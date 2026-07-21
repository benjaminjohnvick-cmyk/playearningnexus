import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: remind subscribers 3 days before expiry; expire past-due subscriptions
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const results = [];

    const activeSubs = await base44.asServiceRole.entities.StreamerSubscription.filter({ is_active: true });

    for (const sub of activeSubs) {
      if (!sub.end_date) continue;
      const endDate = new Date(sub.end_date);

      if (endDate < now) {
        // Expire subscription
        await base44.asServiceRole.entities.StreamerSubscription.update(sub.id, { is_active: false });
        if (sub.subscriber_user_id) {
          const streamer = sub.streamer_user_id ? (await base44.asServiceRole.entities.User.filter({ id: sub.streamer_user_id }))[0] : null;
          await base44.asServiceRole.entities.Notification.create({
            user_id: sub.subscriber_user_id,
            type: 'streamer_sub_expired',
            title: `Subscription Expired: ${streamer?.full_name || 'Streamer'}`,
            message: `Your ${sub.tier} subscription to ${streamer?.full_name || 'the streamer'} has expired. Renew to keep your perks!`,
            is_read: false
          });
        }
        results.push(`expired_sub_${sub.id}`);
      } else if (endDate <= in3Days) {
        // 3-day reminder
        if (sub.subscriber_user_id) {
          const streamer = sub.streamer_user_id ? (await base44.asServiceRole.entities.User.filter({ id: sub.streamer_user_id }))[0] : null;
          await base44.asServiceRole.entities.Notification.create({
            user_id: sub.subscriber_user_id,
            type: 'streamer_sub_expiry_reminder',
            title: `⏰ Subscription Expiring in 3 Days`,
            message: `Your ${sub.tier} subscription to ${streamer?.full_name || 'your streamer'} expires ${endDate.toLocaleDateString()}. Renew to keep your perks!`,
            is_read: false
          });
        }
        results.push(`reminded_sub_${sub.id}`);
      }
    }

    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});