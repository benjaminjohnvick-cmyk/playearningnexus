export default async function confirmPayment(request, context) {
  const { paymentIntentId, gameId, userId } = request.body;
  
  const stripe = require('stripe')(context.secrets.STRIPE_SECRET_KEY);
  
  try {
    // Verify payment intent status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return { status: 400, body: { error: 'Payment not completed' } };
    }
    
    // Fetch game and user
    const game = await context.entities.Game.get(gameId);
    const user = await context.entities.User.get(userId);
    
    // Create transaction record
    await context.entities.Transaction.create({
      user_id: userId,
      game_id: gameId,
      business_client_id: game.developer_id,
      amount: game.price,
      transaction_type: 'game_purchase',
      status: 'completed',
      payment_method: 'stripe',
      stripe_payment_intent_id: paymentIntentId
    });
    
    // Update user game library
    await context.entities.User.update(userId, {
      game_library: [...(user.game_library || []), gameId]
    });
    
    // Update game stats
    await context.entities.Game.update(gameId, {
      total_revenue: (game.total_revenue || 0) + game.price,
      total_installs: (game.total_installs || 0) + 1
    });
    
    // Log activity
    await context.entities.UserActivity.create({
      user_id: userId,
      activity_type: 'game_installed',
      points_earned: 50,
      description: `Purchased ${game.title} with credit card`,
      related_entity_id: gameId
    });
    
    return {
      status: 200,
      body: { success: true, message: 'Purchase completed successfully' }
    };
  } catch (error) {
    return {
      status: 500,
      body: { error: error.message }
    };
  }
}