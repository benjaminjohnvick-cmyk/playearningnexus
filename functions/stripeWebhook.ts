import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
    try {
        const signature = req.headers.get('stripe-signature');
        if (!signature) {
            return Response.json({ error: 'No signature provided' }, { status: 400 });
        }

        const body = await req.text();
        
        // Verify webhook signature (async in Deno)
        let event;
        try {
            event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return Response.json({ error: 'Invalid signature' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Handle different event types
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                const gameId = paymentIntent.metadata.game_id;
                const userId = paymentIntent.metadata.user_id;
                const amount = paymentIntent.amount / 100;

                // Check if transaction already exists
                const existingTransactions = await base44.asServiceRole.entities.Transaction.filter({
                    user_id: userId,
                    game_id: gameId,
                    payment_intent_id: paymentIntent.id
                });

                if (existingTransactions.length === 0) {
                    // Create transaction record
                    await base44.asServiceRole.entities.Transaction.create({
                        user_id: userId,
                        game_id: gameId,
                        amount: amount,
                        transaction_type: 'purchase',
                        status: 'completed',
                        payment_method: 'stripe',
                        payment_intent_id: paymentIntent.id
                    });

                    // Update user's total spent
                    const user = await base44.asServiceRole.entities.User.get(userId);
                    await base44.asServiceRole.entities.User.update(userId, {
                        total_spent: (user.total_spent || 0) + amount
                    });

                    // Update game's total revenue
                    const game = await base44.asServiceRole.entities.Game.get(gameId);
                    await base44.asServiceRole.entities.Game.update(gameId, {
                        total_revenue: (game.total_revenue || 0) + amount
                    });

                    console.log(`Payment succeeded for user ${userId}, game ${gameId}`);
                }
                break;
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object;
                const gameId = paymentIntent.metadata.game_id;
                const userId = paymentIntent.metadata.user_id;

                // Log failed payment
                await base44.asServiceRole.entities.Transaction.create({
                    user_id: userId,
                    game_id: gameId,
                    amount: paymentIntent.amount / 100,
                    transaction_type: 'purchase',
                    status: 'failed',
                    payment_method: 'stripe',
                    payment_intent_id: paymentIntent.id
                });

                console.log(`Payment failed for user ${userId}, game ${gameId}`);
                break;
            }

            case 'charge.refunded': {
                const charge = event.data.object;
                const paymentIntentId = charge.payment_intent;

                // Find and update the transaction
                const transactions = await base44.asServiceRole.entities.Transaction.filter({
                    payment_intent_id: paymentIntentId
                });

                if (transactions.length > 0) {
                    const transaction = transactions[0];
                    await base44.asServiceRole.entities.Transaction.update(transaction.id, {
                        status: 'refunded'
                    });

                    // Reverse user's total spent
                    const user = await base44.asServiceRole.entities.User.get(transaction.user_id);
                    await base44.asServiceRole.entities.User.update(transaction.user_id, {
                        total_spent: Math.max(0, (user.total_spent || 0) - transaction.amount)
                    });

                    // Reverse game's total revenue
                    const game = await base44.asServiceRole.entities.Game.get(transaction.game_id);
                    await base44.asServiceRole.entities.Game.update(transaction.game_id, {
                        total_revenue: Math.max(0, (game.total_revenue || 0) - transaction.amount)
                    });

                    console.log(`Refund processed for transaction ${transaction.id}`);
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return Response.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});