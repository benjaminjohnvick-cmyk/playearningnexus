import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const tip = data;
    if (!tip?.id || event?.type !== 'create') return Response.json({ ok: true });

    const tipper = tip.tipper_user_id ? (await base44.asServiceRole.entities.User.filter({ id: tip.tipper_user_id }))[0] : null;
    const streamer = tip.streamer_user_id ? (await base44.asServiceRole.entities.User.filter({ id: tip.streamer_user_id }))[0] : null;

    // Notify streamer
    if (tip.streamer_user_id) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: tip.streamer_user_id,
        type: 'tip_received',
        title: `💝 ${tip.is_anonymous ? 'Anonymous' : (tipper?.full_name || 'Fan')} Tipped ${tip.amount} ${tip.currency}!`,
        message: tip.message ? `"${tip.message}"` : `You received a tip of ${tip.amount} ${tip.currency}!`,
        is_read: false
      });
    }

    // Thank the tipper
    if (tip.tipper_user_id) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: tip.tipper_user_id,
        type: 'tip_sent',
        title: `💝 Tip Sent to ${streamer?.full_name || 'Streamer'}!`,
        message: `Your tip of ${tip.amount} ${tip.currency} was delivered${tip.message ? ` with your message: "${tip.message}"` : ''}!`,
        is_read: false
      });
      // Award XP for tipping
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: tip.tipper_user_id,
        activity_type: 'streamer_tip',
        points_earned: Math.max(5, Math.floor(tip.amount * 2)),
        metadata: { streamer_id: tip.streamer_user_id, amount: tip.amount, currency: tip.currency }
      });
    }

    // Credit the streamer's earnings if USD
    if (tip.currency === 'USD' && tip.streamer_user_id && streamer) {
      await base44.asServiceRole.entities.User.update(tip.streamer_user_id, {
        total_earnings: (streamer.total_earnings || 0) + (tip.amount || 0)
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});