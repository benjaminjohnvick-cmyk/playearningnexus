import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId, amount } = await req.json();
    
    const game = await base44.entities.Game.get(gameId);
    if (!game) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }
    
    if (user.game_library?.includes(gameId)) {
      return Response.json({ error: 'Game already owned' }, { status: 400 });
    }
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        game_id: gameId,
        user_id: user.id,
        game_title: game.title
      }
    });
    
    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});