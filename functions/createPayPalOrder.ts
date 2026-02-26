import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId } = await req.json();
    
    // Fetch game details
    const game = await base44.entities.Game.get(gameId);
    if (!game) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }
    
    // Check if user already owns the game
    if (user.game_library?.includes(gameId)) {
      return Response.json({ error: 'Game already owned' }, { status: 400 });
    }
    
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const clientSecret = Deno.env.get('PAYPAL_SECRET_KEY');
    
    // Get PayPal access token
    const authResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
      },
      body: 'grant_type=client_credentials'
    });
    
    const authData = await authResponse.json();
    const accessToken = authData.access_token;
    
    // Create order
    const orderResponse = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: game.price.toFixed(2)
          },
          description: `Purchase of ${game.title}`,
          custom_id: JSON.stringify({ game_id: gameId, user_id: user.id })
        }]
      })
    });
    
    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      throw new Error(orderData.message || 'Failed to create PayPal order');
    }
    
    return Response.json({ orderId: orderData.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});