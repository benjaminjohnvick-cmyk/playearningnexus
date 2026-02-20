export default async function capturePayPalOrder(request, context) {
  const { orderId, gameId, userId } = request.body;
  
  const fetch = require('node-fetch');
  const clientId = context.secrets.PAYPAL_CLIENT_ID;
  const clientSecret = context.secrets.PAYPAL_SECRET_KEY;
  
  try {
    // Get PayPal access token
    const authResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });
    
    const authData = await authResponse.json();
    const accessToken = authData.access_token;
    
    // Capture the order
    const captureResponse = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
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
      payment_method: 'paypal',
      paypal_order_id: orderId
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
      description: `Purchased ${game.title} with PayPal`,
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