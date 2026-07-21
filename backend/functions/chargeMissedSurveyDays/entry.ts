import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { user_id, days_missed } = body;

    if (!user_id || !days_missed || days_missed < 1) {
      return Response.json({ error: 'user_id and days_missed (>=1) required' }, { status: 400 });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const chargeAmount = days_missed * 8; // $8 per missed day
    const chargeCents = Math.round(chargeAmount * 100);

    // Look up the user's payment method from their upfront payment
    // In a real system, we'd store the customer ID from the initial $1,460 payment
    // For now, we create a payment intent for the charge amount
    const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'amount': chargeCents.toString(),
        'currency': 'usd',
        'description': `Missed survey charge — ${days_missed} day(s) × $8/day`,
        'metadata[user_id]': user_id,
        'metadata[charge_type]': 'missed_survey_day',
        'metadata[days_missed]': days_missed.toString(),
        'automatic_payment_methods[enabled]': 'true'
      })
    });

    const paymentIntent = await piRes.json();

    if (paymentIntent.error) {
      return Response.json({ error: paymentIntent.error.message }, { status: 400 });
    }

    // Log the charge
    await base44.asServiceRole.entities.AdTransaction.create({
      owner_user_id: user_id,
      type: 'charge',
      amount: -chargeAmount,
      description: `Missed survey day(s) — ${days_missed} × $8/day`,
      stripe_payment_intent: paymentIntent.id,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    return Response.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: chargeAmount,
      days_missed,
      message: `Charge of $${chargeAmount} (${days_missed} × $8) initiated for missed survey day(s)`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});