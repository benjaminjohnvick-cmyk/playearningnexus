import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const connection = data;
    if (!connection?.id || event?.type !== 'create') return Response.json({ ok: true });
    if (connection.status === 'blocked') return Response.json({ ok: true });

    const follower = connection.follower_user_id
      ? (await base44.asServiceRole.entities.User.filter({ id: connection.follower_user_id }))[0]
      : null;

    // Notify the followed/connected user
    if (connection.following_user_id) {
      const actionWord = connection.connection_type === 'friend' ? 'sent you a friend request' : 'started following you';
      await base44.asServiceRole.entities.Notification.create({
        user_id: connection.following_user_id,
        type: 'new_follower',
        title: connection.connection_type === 'friend' ? `👥 New Friend Request` : `👁️ New Follower!`,
        message: `${follower?.full_name || 'Someone'} ${actionWord} on GamerGain!`,
        is_read: false
      });
    }

    // Award XP to follower for building their network
    if (connection.follower_user_id) {
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: connection.follower_user_id,
        activity_type: 'social_connected',
        points_earned: connection.connection_type === 'friend' ? 5 : 2,
        metadata: { connection_type: connection.connection_type, following: connection.following_user_id }
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});