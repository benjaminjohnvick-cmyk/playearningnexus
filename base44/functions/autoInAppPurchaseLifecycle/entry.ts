import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const purchase = data;
    if (!purchase?.id || event?.type !== 'create') return Response.json({ ok: true });

    const user = purchase.user_id ? (await base44.asServiceRole.entities.User.filter({ id: purchase.user_id }))[0] : null;

    // Send receipt
    if (user?.email) {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `🎮 Purchase Confirmed: ${purchase.item_name || 'In-App Item'}`,
        body: `Your purchase of "${purchase.item_name || 'item'}" for $${purchase.amount || purchase.price} has been confirmed! The item has been added to your account. Thank you for playing on GamerGain!`
      });
    }

    // In-app notification
    if (purchase.user_id) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: purchase.user_id,
        type: 'purchase_confirmed',
        title: `🎮 Purchase Confirmed!`,
        message: `"${purchase.item_name || 'Item'}" has been added to your account.`,
        is_read: false
      });
    }

    // Award XP for purchase
    if (purchase.user_id) {
      const xpReward = Math.max(10, Math.floor((purchase.amount || purchase.price || 1) * 5));
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: purchase.user_id,
        activity_type: 'in_app_purchase',
        points_earned: xpReward,
        metadata: { purchase_id: purchase.id, item: purchase.item_name }
      });
    }

    // Record transaction
    await base44.asServiceRole.entities.Transaction.create({
      user_id: purchase.user_id,
      game_id: purchase.game_id,
      product_id: purchase.item_id || purchase.id,
      amount: purchase.amount || purchase.price || 0,
      transaction_type: 'in_game_purchase',
      status: 'completed',
      notes: `In-app purchase: ${purchase.item_name}`
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});