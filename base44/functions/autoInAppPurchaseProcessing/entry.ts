import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const purchase = data;
    if (!purchase?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      const user = purchase.user_id ? (await base44.asServiceRole.entities.User.filter({ id: purchase.user_id }))[0] : null;

      // Record transaction
      await base44.asServiceRole.entities.Transaction.create({
        user_id: purchase.user_id,
        game_id: purchase.game_id,
        product_id: purchase.product_id,
        amount: purchase.amount,
        currency: 'USD',
        transaction_type: 'in_game_purchase',
        status: 'completed',
        notes: `In-app purchase: ${purchase.item_name || 'item'}`
      });

      // Award XP for purchase
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: purchase.user_id,
        activity_type: 'in_app_purchase',
        points_earned: Math.floor((purchase.amount || 0) * 10),
        metadata: { amount: purchase.amount, item: purchase.item_name }
      });

      // Send receipt
      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `🎮 Purchase Confirmed: ${purchase.item_name || 'Item'}`,
          body: `Your purchase of "${purchase.item_name || 'item'}" for $${purchase.amount} has been confirmed. Item has been added to your account. Thank you for supporting the developers!`
        });
      }

      // Revenue share: update game revenue + developer stats
      if (purchase.game_id) {
        const game = (await base44.asServiceRole.entities.Game.filter({ id: purchase.game_id }))[0];
        if (game) {
          await base44.asServiceRole.entities.Game.update(purchase.game_id, {
            total_revenue: (game.total_revenue || 0) + purchase.amount
          });
          if (game.developer_id) {
            const devClient = (await base44.asServiceRole.entities.BusinessClient.filter({ id: game.developer_id }))[0];
            if (devClient) {
              await base44.asServiceRole.entities.BusinessClient.update(game.developer_id, {
                total_revenue: (devClient.total_revenue || 0) + (purchase.amount * 0.7) // 70% to developer
              });
            }
          }
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});