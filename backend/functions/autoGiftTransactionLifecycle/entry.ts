import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const gift = data;
    if (!gift?.id || event?.type !== 'create') return Response.json({ ok: true });

    const sender = gift.sender_id ? (await base44.asServiceRole.entities.User.filter({ id: gift.sender_id }))[0] : null;
    const recipient = gift.recipient_id ? (await base44.asServiceRole.entities.User.filter({ id: gift.recipient_id }))[0] : null;

    // Notify recipient
    if (gift.recipient_id) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: gift.recipient_id,
        type: 'gift_received',
        title: `🎁 You Received a Gift!`,
        message: `${sender?.full_name || 'A friend'} sent you ${gift.gift_type === 'currency' ? `${gift.amount} coins` : `"${gift.item_name}"`}! ${gift.message ? `Message: "${gift.message}"` : ''}`,
        is_read: false
      });

      if (recipient?.email) {
        await base44.integrations.Core.SendEmail({
          to: recipient.email,
          subject: `🎁 ${sender?.full_name || 'Someone'} Sent You a Gift on GamerGain!`,
          body: `You received a gift from ${sender?.full_name || 'a friend'}!\n\nGift: ${gift.gift_type === 'currency' ? `${gift.amount} coins` : gift.item_name}\n${gift.message ? `Personal message: "${gift.message}"` : ''}\n\nLog in to claim your gift!`
        });
      }
    }

    // Confirm to sender
    if (gift.sender_id) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: gift.sender_id,
        type: 'gift_sent',
        title: `🎁 Gift Sent!`,
        message: `Your gift to ${recipient?.full_name || 'friend'} was delivered successfully!`,
        is_read: false
      });
    }

    // Award XP to sender for generosity
    if (gift.sender_id) {
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: gift.sender_id,
        activity_type: 'gift_sent',
        points_earned: 15,
        metadata: { gift_id: gift.id, recipient: gift.recipient_id }
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});