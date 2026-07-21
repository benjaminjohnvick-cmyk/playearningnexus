import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { amount, description, metadata } = body;

    if (!amount || amount < 50) {
      return Response.json({ error: 'Amount must be at least $0.50 (50 cents)' }, { status: 400 });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    // Create Stripe PaymentIntent using fetch (no external SDK needed)
    const paymentIntentRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'amount': Math.round(amount * 100).toString(), // cents
        'currency': 'usd',
        'automatic_payment_methods[enabled]': 'true',
        'description': description || 'GamerGain PPC Campaign',
        'metadata[user_id]': user.id,
        'metadata[user_email]': user.email || '',
        'metadata[plan]': metadata?.plan || 'ppc_annual',
        ...(metadata?.ad_id ? { 'metadata[ad_id]': metadata.ad_id } : {})
      })
    });

    const paymentIntent = await paymentIntentRes.json();

    if (paymentIntent.error) {
      return Response.json({ error: paymentIntent.error.message }, { status: 400 });
    }

    // Log the payment intent as a pending AdTransaction
    await base44.asServiceRole.entities.AdTransaction.create({
      owner_user_id: user.id,
      type: 'deposit',
      amount: amount,
      description: description || 'PPC Annual Campaign — Upfront Payment',
      stripe_payment_intent: paymentIntent.id,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    return Response.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: amount,
      currency: 'usd'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});