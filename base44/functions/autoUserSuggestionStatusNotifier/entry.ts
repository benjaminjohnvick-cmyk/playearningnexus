import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const suggestion = data;
    if (!suggestion?.user_id || event?.type !== 'update') return Response.json({ ok: true });

    const oldStatus = old_data?.status;
    const newStatus = data.status;
    if (oldStatus === newStatus) return Response.json({ ok: true });

    const statusMessages = {
      added_to_survey: {
        title: `📋 Your Suggestion Is Being Voted On!`,
        message: `Your suggestion "${(suggestion.suggestion || '').substring(0, 60)}" has been added to a community survey for voting!`
      },
      in_mockup: {
        title: `🎨 Your Suggestion Is Being Designed!`,
        message: `Exciting! Your suggestion "${(suggestion.suggestion || '').substring(0, 60)}" has advanced to the design/mockup phase.`
      },
      implemented: {
        title: `🎉 Your Suggestion Was Implemented!`,
        message: `Your suggestion "${(suggestion.suggestion || '').substring(0, 60)}" has been built into GamerGain! Thank you for making the platform better.`
      },
      rejected: {
        title: `Suggestion Update`,
        message: `We reviewed your suggestion but won't be implementing it at this time. Thank you for helping us improve GamerGain!`
      }
    };

    const msgDef = statusMessages[newStatus];
    if (!msgDef) return Response.json({ ok: true });

    await base44.asServiceRole.entities.Notification.create({
      user_id: suggestion.user_id,
      type: 'suggestion_status_update',
      title: msgDef.title,
      message: msgDef.message,
      is_read: false
    });

    // Award bonus XP when implemented
    if (newStatus === 'implemented') {
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: suggestion.user_id,
        activity_type: 'suggestion_implemented',
        points_earned: 250,
        metadata: { suggestion_id: suggestion.id }
      });
      await base44.asServiceRole.entities.ActivityFeedItem.create({
        user_id: suggestion.user_id,
        activity_type: 'achievement',
        title: `💡 Suggestion Implemented on GamerGain!`,
        description: `"${(suggestion.suggestion || '').substring(0, 80)}"`,
        icon: '💡',
        is_public: true
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});