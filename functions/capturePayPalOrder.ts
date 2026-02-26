import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, gameId } = await req.json();
    
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
    
    // Capture the order
    const captureResponse = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const captureData = await captureResponse.json();
    
    if (!captureResponse.ok) {
      throw new Error(captureData.message || 'Failed to capture payment');
    }
    
    // Verify payment status
    if (captureData.status !== 'COMPLETED') {
      return Response.json({ error: 'Payment not completed' }, { status: 400 });
    }
    
    // Fetch game
    const game = await base44.entities.Game.get(gameId);
    
    // Create transaction record
    await base44.entities.Transaction.create({
      user_id: user.id,
      game_id: gameId,
      business_client_id: game.developer_id,
      amount: game.price,
      transaction_type: 'game_purchase',
      status: 'completed',
      payment_method: 'paypal',
      paypal_order_id: orderId
    });
    
    // Update user game library
    await base44.entities.User.update(user.id, {
      game_library: [...(user.game_library || []), gameId]
    });
    
    // Update game stats
    await base44.entities.Game.update(gameId, {
      total_revenue: (game.total_revenue || 0) + game.price,
      total_installs: (game.total_installs || 0) + 1
    });
    
    // Log activity
    await base44.entities.UserActivity.create({
      user_id: user.id,
      activity_type: 'game_installed',
      points_earned: 50,
      description: `Purchased ${game.title} with PayPal`,
      related_entity_id: gameId
    });
    
    return Response.json({ success: true, message: 'Purchase completed successfully' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});