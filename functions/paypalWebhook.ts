export default async function paypalWebhook(request, context) {
  const event = request.body;
  
  // Handle different PayPal webhook event types
  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      const capture = event.resource;
      const customId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id;
      
      if (customId) {
        try {
          const { game_id, user_id } = JSON.parse(customId);
          
          // Fetch game and user
          const game = await context.entities.Game.get(game_id);
          const user = await context.entities.User.get(user_id);
          
          // Create transaction record if not exists
          const existingTransaction = await context.entities.Transaction.filter({
            paypal_order_id: capture.id
          });
          
          if (existingTransaction.length === 0) {
            await context.entities.Transaction.create({
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
              await context.entities.User.update(user_id, {
                game_library: [...(user.game_library || []), game_id]
              });
            }
            
            // Update game stats
            await context.entities.Game.update(game_id, {
              total_revenue: (game.total_revenue || 0) + parseFloat(capture.amount.value),
              total_installs: (game.total_installs || 0) + 1
            });
            
            // Log activity
            await context.entities.UserActivity.create({
              user_id: user_id,
              activity_type: 'game_installed',
              points_earned: 50,
              description: `Purchased ${game.title} via PayPal webhook`,
              related_entity_id: game_id
            });
          }
        } catch (error) {
          console.error('Error processing PayPal webhook:', error);
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
  
  return { status: 200, body: { received: true } };
}