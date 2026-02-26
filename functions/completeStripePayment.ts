import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentIntentId, gameId } = await req.json();
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return Response.json({ error: 'Payment not completed' }, { status: 400 });
    }
    
    const game = await base44.entities.Game.get(gameId);
    
    await base44.entities.Transaction.create({
      user_id: user.id,
      game_id: gameId,
      business_client_id: game.developer_id,
      amount: game.price,
      transaction_type: 'game_purchase',
      status: 'completed',
      payment_method: 'stripe',
      stripe_payment_intent_id: paymentIntentId
    });
    
    await base44.entities.User.update(user.id, {
      game_library: [...(user.game_library || []), gameId]
    });
    
    await base44.entities.Game.update(gameId, {
      total_revenue: (game.total_revenue || 0) + game.price,
      total_installs: (game.total_installs || 0) + 1
    });
    
    await base44.entities.UserActivity.create({
      user_id: user.id,
      activity_type: 'game_installed',
      points_earned: 50,
      description: `Purchased ${game.title} with Stripe`,
      related_entity_id: gameId
    });
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});