import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const membership = data;
    if (!membership?.id) return Response.json({ ok: true });

    const user = membership.user_id ? (await base44.asServiceRole.entities.User.filter({ id: membership.user_id }))[0] : null;

    if (event?.type === 'create') {
      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `⭐ Welcome to GamerGain Premium!`,
          body: `Congratulations ${user.full_name}! Your Premium membership is now active.\n\nBenefits unlocked:\n• Priority survey matching\n• 2x XP on all activities\n• Exclusive premium games\n• Advanced earnings analytics\n• Priority support\n\nYour membership is valid until ${membership.expires_at ? new Date(membership.expires_at).toLocaleDateString() : 'cancelled'}. Enjoy!`
        });
      }
      if (membership.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: membership.user_id,
          type: 'premium_activated',
          title: `⭐ Premium Membership Activated!`,
          message: `You now have Premium access! Enjoy 2x XP, priority surveys, exclusive games, and more.`,
          is_read: false
        });
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: membership.user_id,
          activity_type: 'premium_joined',
          points_earned: 250,
          metadata: { plan: membership.plan_type }
        });
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = membership.status;
      if (oldStatus === newStatus) return Response.json({ ok: true });

      if (newStatus === 'expired') {
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `⚠️ Your GamerGain Premium Has Expired`,
            body: `Your Premium membership has expired. Renew now to keep your premium benefits and avoid losing your priority survey queue position. Visit gamergain.com/Pricing to renew.`
          });
        }
        if (membership.user_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: membership.user_id,
            type: 'premium_expired',
            title: `⚠️ Premium Membership Expired`,
            message: `Your Premium membership has expired. Renew to restore 2x XP, priority surveys, and exclusive access.`,
            is_read: false
          });
        }
      }

      if (newStatus === 'renewed') {
        if (membership.user_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: membership.user_id,
            type: 'premium_renewed',
            title: `✅ Premium Renewed!`,
            message: `Your Premium membership has been renewed. All benefits continue uninterrupted!`,
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