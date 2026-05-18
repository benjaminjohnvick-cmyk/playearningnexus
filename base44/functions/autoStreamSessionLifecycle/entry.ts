import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const session = data;
    if (!session?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Stream started — notify followers
      if (session.streamer_id) {
        const followers = await base44.asServiceRole.entities.StreamerSubscription.filter({ streamer_id: session.streamer_id });
        const streamer = (await base44.asServiceRole.entities.User.filter({ id: session.streamer_id }))[0];
        let notified = 0;
        for (const follower of followers.slice(0, 30)) {
          if (follower.subscriber_id) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: follower.subscriber_id,
              type: 'streamer_live',
              title: `🔴 ${streamer?.full_name || 'A streamer'} is LIVE!`,
              message: `${streamer?.full_name || 'Your followed streamer'} just started streaming "${session.title || 'a new stream'}". Tune in now!`,
              is_read: false
            });
            notified++;
          }
        }
        // Update creator profile stream count
        const creatorProfiles = await base44.asServiceRole.entities.CreatorProfile.filter({ user_id: session.streamer_id });
        if (creatorProfiles[0]) {
          await base44.asServiceRole.entities.CreatorProfile.update(creatorProfiles[0].id, {
            total_streams: (creatorProfiles[0].total_streams || 0) + 1
          });
        }
      }
    }

    if (event?.type === 'update') {
      // Stream ended
      if (data.status === 'ended' && old_data?.status !== 'ended') {
        const duration = session.duration_minutes || 0;
        // Award XP to streamer for streaming
        if (session.streamer_id) {
          await base44.asServiceRole.entities.UserActivity.create({
            user_id: session.streamer_id,
            activity_type: 'stream_completed',
            points_earned: Math.min(duration * 2, 200),
            metadata: { session_id: session.id, duration_minutes: duration, viewer_count: session.peak_viewers || 0 }
          });
          await base44.asServiceRole.entities.Notification.create({
            user_id: session.streamer_id,
            type: 'stream_ended',
            title: '📊 Stream Summary',
            message: `Stream ended! Peak viewers: ${session.peak_viewers || 0}. Duration: ${duration} min. You earned ${Math.min(duration * 2, 200)} XP!`,
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