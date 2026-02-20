export default async function createPayPalOrder(request, context) {
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
  
  // Create PayPal order
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
    
    // Create order
    const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
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
          custom_id: JSON.stringify({ game_id: gameId, user_id: userId })
        }]
      })
    });
    
    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      throw new Error(orderData.message || 'Failed to create PayPal order');
    }
    
    return {
      status: 200,
      body: {
        orderId: orderData.id
      }
    };
  } catch (error) {
    return {
      status: 500,
      body: { error: error.message }
    };
  }
}