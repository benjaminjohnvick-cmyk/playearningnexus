import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), { apiVersion: '2023-10-16' });

// Plan config
const PLANS = {
  daily:   { amount: 800,    interval: 'day',   interval_count: 1,  label: 'PPC Grid Daily ($8/day)'       },
  monthly: { amount: 24000,  interval: 'month',  interval_count: 1,  label: 'PPC Grid Monthly ($240/month)' },
  yearly:  { amount: 200000, interval: 'year',   interval_count: 1,  label: 'PPC Grid Annual ($2,000/year)' },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan, payment_method_id, amount } = await req.json();

    const planConfig = PLANS[plan];
    if (!planConfig) return Response.json({ error: 'Invalid plan' }, { status: 400 });

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        payment_method: payment_method_id,
        invoice_settings: { default_payment_method: payment_method_id },
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await base44.asServiceRole.entities.User.update(user.id, { stripe_customer_id: customerId });
    } else {
      // Attach new payment method to existing customer
      await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: payment_method_id },
      });
    }

    let result;

    if (plan === 'yearly') {
      // One-time charge for yearly plan
      const paymentIntent = await stripe.paymentIntents.create({
        amount: planConfig.amount,
        currency: 'usd',
        customer: customerId,
        payment_method: payment_method_id,
        confirm: true,
        description: planConfig.label,
        metadata: { user_id: user.id, plan: 'yearly' },
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      });
      result = { type: 'one_time', payment_intent_id: paymentIntent.id, status: paymentIntent.status };
    } else {
      // Recurring subscription for daily/monthly
      const priceData = {
        unit_amount: planConfig.amount,
        currency: 'usd',
        recurring: { interval: planConfig.interval, interval_count: planConfig.interval_count },
        product_data: { name: planConfig.label },
      };
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price_data: priceData }],
        default_payment_method: payment_method_id,
        metadata: { user_id: user.id, plan },
      });
      result = { type: 'subscription', subscription_id: subscription.id, status: subscription.status };
    }

    // Mark user as active on PPC grid
    await base44.asServiceRole.entities.User.update(user.id, {
      ppc_grid_active: true,
      ppc_grid_plan: plan,
      ppc_grid_activated_at: new Date().toISOString(),
    });

    // Record in AdTransaction
    await base44.asServiceRole.entities.AdTransaction.create({
      user_id: user.id,
      type: plan === 'yearly' ? 'one_time_charge' : 'subscription_start',
      amount: planConfig.amount / 100,
      plan,
      description: planConfig.label,
      stripe_id: result.payment_intent_id || result.subscription_id,
      created_at: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({ success: true, plan, ...result });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});