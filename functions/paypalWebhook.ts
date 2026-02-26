import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function verifyWebhookSignature(req, body) {
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_SECRET_KEY');
  
  if (!webhookId) {
    console.warn('PAYPAL_WEBHOOK_ID not set, skipping signature verification');
    return true;
  }
  
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
  
  // Verify webhook signature
  const verifyResponse = await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.access_token}`
    },
    body: JSON.stringify({
      transmission_id: req.headers.get('paypal-transmission-id'),
      transmission_time: req.headers.get('paypal-transmission-time'),
      cert_url: req.headers.get('paypal-cert-url'),
      auth_algo: req.headers.get('paypal-auth-algo'),
      transmission_sig: req.headers.get('paypal-transmission-sig'),
      webhook_id: webhookId,
      webhook_event: body
    })
  });
  
  const verifyData = await verifyResponse.json();
  return verifyData.verification_status === 'SUCCESS';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const bodyText = await req.text();
    const event = JSON.parse(bodyText);
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(req, event);
    if (!isValid) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Handle different PayPal webhook event types
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        const capture = event.resource;
        const customId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id;
        
        if (customId) {
          const { game_id, user_id } = JSON.parse(customId);
          
          // Fetch game and user
          const game = await base44.asServiceRole.entities.Game.get(game_id);
          const user = await base44.asServiceRole.entities.User.get(user_id);
          
          // Create transaction record if not exists
          const existingTransaction = await base44.asServiceRole.entities.Transaction.filter({
            paypal_order_id: capture.id
          });
          
          if (existingTransaction.length === 0) {
            await base44.asServiceRole.entities.Transaction.create({
              user_id: user_id,
              game_id: game_id,
              business_client_id: game.developer_id,
              amount: parseFloat(capture.amount.value),
              transaction_type: 'game_purchase',
              status: 'completed',
              payment_method: 'paypal',
              paypal_order_id: capture.id
            });
            
            // Update user game library
            if (!user.game_library?.includes(game_id)) {
              await base44.asServiceRole.entities.User.update(user_id, {
                game_library: [...(user.game_library || []), game_id]
              });
            }
            
            // Update game stats
            await base44.asServiceRole.entities.Game.update(game_id, {
              total_revenue: (game.total_revenue || 0) + parseFloat(capture.amount.value),
              total_installs: (game.total_installs || 0) + 1
            });
            
            // Log activity
            await base44.asServiceRole.entities.UserActivity.create({
              user_id: user_id,
              activity_type: 'game_installed',
              points_earned: 50,
              description: `Purchased ${game.title} via PayPal webhook`,
              related_entity_id: game_id
            });
          }
        }
        break;
        
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED':
        console.log('Payment denied or refunded:', event.resource);
        break;
        
      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`);
    }
    
    return Response.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});