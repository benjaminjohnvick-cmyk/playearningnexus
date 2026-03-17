import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { paymentMethodId, sampleSize, surveyTitle } = await req.json();

    if (!paymentMethodId) return Response.json({ error: 'Missing paymentMethodId' }, { status: 400 });

    const minSampleSize = Math.max(sampleSize || 100, 100);
    const totalAmount = minSampleSize * 4; // $4 per completed response
    const amountCents = totalAmount * 100;

    // Create and confirm a PaymentIntent immediately
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      return_url: 'https://gamergain.com/Surveys',
      description: `Survey creation: "${surveyTitle}" — ${minSampleSize} responses @ $4 each`,
      metadata: {
        user_id: user.id,
        user_email: user.email,
        survey_title: surveyTitle,
        sample_size: String(minSampleSize),
        cost_per_response: '4',
      },
    });

    if (paymentIntent.status === 'succeeded') {
      // Record the transaction
      await base44.asServiceRole.entities.PPCTransaction.create({
        user_id: user.id,
        transaction_type: 'survey_charge',
        amount: totalAmount,
        net_amount: totalAmount,
        description: `Survey creation charge: ${minSampleSize} responses for "${surveyTitle}"`,
        status: 'completed',
      });

      return Response.json({
        success: true,
        payment_intent_id: paymentIntent.id,
        amount_charged: totalAmount,
        sample_size: minSampleSize,
      });
    } else if (paymentIntent.status === 'requires_action') {
      return Response.json({
        success: false,
        requires_action: true,
        client_secret: paymentIntent.client_secret,
      });
    } else {
      return Response.json({ success: false, error: `Payment status: ${paymentIntent.status}` }, { status: 400 });
    }

  } catch (error) {
    if (error.type?.startsWith('Stripe')) {
      return Response.json({ success: false, error: error.message }, { status: 400 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});