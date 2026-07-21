import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const sub = data;
    if (!sub?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      const subscriber = sub.subscriber_user_id ? (await base44.asServiceRole.entities.User.filter({ id: sub.subscriber_user_id }))[0] : null;
      const streamer = sub.streamer_user_id ? (await base44.asServiceRole.entities.User.filter({ id: sub.streamer_user_id }))[0] : null;

      // Welcome subscriber
      if (subscriber?.email) {
        await base44.integrations.Core.SendEmail({
          to: subscriber.email,
          subject: `🎮 Subscribed to ${streamer?.full_name || 'Streamer'} — ${sub.tier} Tier!`,
          body: `You're now subscribed to ${streamer?.full_name || 'the streamer'} at ${sub.tier} tier for $${sub.price_monthly}/month!\n\nPerks: ${(sub.perks || []).join(', ') || 'Exclusive access'}\n\nEnjoy your subscription!`
        });
      }

      // Notify streamer
      if (sub.streamer_user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.streamer_user_id,
          type: 'new_subscriber',
          title: `🎉 New ${sub.tier} Subscriber: ${subscriber?.full_name || 'Fan'}!`,
          message: `${subscriber?.full_name || 'Someone'} just subscribed at the ${sub.tier} tier ($${sub.price_monthly}/month)!`,
          is_read: false
        });
      }

      // Award XP to subscriber
      if (sub.subscriber_user_id) {
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: sub.subscriber_user_id,
          activity_type: 'streamer_subscribed',
          points_earned: 20,
          metadata: { streamer_id: sub.streamer_user_id, tier: sub.tier }
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});