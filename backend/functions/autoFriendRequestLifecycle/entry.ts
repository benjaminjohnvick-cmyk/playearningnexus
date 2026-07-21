import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const fr = data;
    if (!fr?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Notify the recipient of the friend request
      if (fr.to_user_id) {
        const sender = fr.from_user_id ? (await base44.asServiceRole.entities.User.filter({ id: fr.from_user_id }))[0] : null;
        await base44.asServiceRole.entities.Notification.create({
          user_id: fr.to_user_id,
          type: 'friend_request_received',
          title: '👥 New Friend Request!',
          message: `${sender?.full_name || 'Someone'} wants to be your friend on GamerGain! Accept to connect and share stats.`,
          is_read: false
        });
      }
    }

    if (event?.type === 'update' && data.status === 'accepted') {
      // Notify sender that request was accepted
      if (fr.from_user_id) {
        const accepter = fr.to_user_id ? (await base44.asServiceRole.entities.User.filter({ id: fr.to_user_id }))[0] : null;
        await base44.asServiceRole.entities.Notification.create({
          user_id: fr.from_user_id,
          type: 'friend_request_accepted',
          title: '🎉 Friend Request Accepted!',
          message: `${accepter?.full_name || 'Your friend'} accepted your friend request! You're now connected on GamerGain.`,
          is_read: false
        });
        // Award XP for making a friend connection
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: fr.from_user_id,
          activity_type: 'friend_connected',
          points_earned: 10,
          metadata: { friend_id: fr.to_user_id }
        });
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: fr.to_user_id,
          activity_type: 'friend_connected',
          points_earned: 10,
          metadata: { friend_id: fr.from_user_id }
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});