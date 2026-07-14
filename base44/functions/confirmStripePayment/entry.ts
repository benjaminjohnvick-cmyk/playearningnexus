import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { payment_intent_id, amount } = body;

    if (!payment_intent_id) {
      return Response.json({ error: 'payment_intent_id is required' }, { status: 400 });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    // Retrieve the payment intent to check status
    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${payment_intent_id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${stripeKey}` }
    });

    const paymentIntent = await piRes.json();

    if (paymentIntent.error) {
      return Response.json({ error: paymentIntent.error.message }, { status: 400 });
    }

    if (paymentIntent.status === 'succeeded') {
      // Update the AdTransaction to completed
      const txns = await base44.asServiceRole.entities.AdTransaction.filter({
        stripe_payment_intent: payment_intent_id
      });

      if (txns.length > 0) {
        await base44.asServiceRole.entities.AdTransaction.update(txns[0].id, {
          status: 'completed',
          balance_after: amount
        });
      }

      return Response.json({
        status: 'succeeded',
        payment_intent_id,
        amount: amount,
        message: 'Payment confirmed — your PPC campaign is now active!'
      });
    } else {
      return Response.json({
        status: paymentIntent.status,
        payment_intent_id,
        message: `Payment status: ${paymentIntent.status}`
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});