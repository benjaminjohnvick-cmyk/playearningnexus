export default async function createPaymentIntent(request, context) {
  const { gameId, userId } = request.body;
  
  // Fetch game details
  const game = await context.entities.Game.get(gameId);
  if (!game) {
    return { status: 404, body: { error: 'Game not found' } };
  }
  
  // Fetch user details
  const user = await context.entities.User.get(userId);
  if (!user) {
    return { status: 404, body: { error: 'User not found' } };
  }
  
  // Check if user already owns the game
  if (user.game_library?.includes(gameId)) {
    return { status: 400, body: { error: 'Game already owned' } };
  }
  
  // Create Stripe payment intent
  const stripe = require('stripe')(context.secrets.STRIPE_SECRET_KEY);
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(game.price * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        game_id: gameId,
        user_id: userId,
        game_title: game.title
      },
      description: `Purchase of ${game.title}`
    });
    
    return {
      status: 200,
      body: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    };
  } catch (error) {
    return {
      status: 500,
      body: { error: error.message }
    };
  }
}