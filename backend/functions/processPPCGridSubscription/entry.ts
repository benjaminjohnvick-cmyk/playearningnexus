import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { advertiserSurveyOptInEnabled, advertiserSurveyProvider, recordAdvertiserSurveyOptIn } from "../../sdk/advertiser-surveys.ts";
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), { apiVersion: '2023-10-16' });

// Plan config
const PLANS = {
  daily:   { amount: 800,    interval: 'day',   interval_count: 1,  label: 'PPC Grid Daily ($8/day)'       },
  monthly: { amount: 24000,  interval: 'month',  interval_count: 1,  label: 'PPC Grid Monthly ($240/month)' },
  yearly:  { amount: 500000, interval: 'year',   interval_count: 1,  label: 'PPC Grid Annual ($5,000/year)' },
};

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan, payment_method_id, amount, survey_optin, survey_consent } = await req.json();

    const planConfig = PLANS[plan];
    if (!planConfig) return Response.json({ error: 'Invalid plan' }, { status: 400 });

    // OPTIONAL: the advertiser chose, on signup, to ALSO participate as a survey-taker. If they ticked it,
    // they must accept the short consent line. When on, they're flagged to fill out surveys from the
    // THIRD-PARTY providers only (never the platform's own PPC surveys). Purely opt-in; leaving it off
    // changes nothing about the advertiser's subscription.
    const wantsSurveyOptIn = survey_optin === true && advertiserSurveyOptInEnabled();
    if (wantsSurveyOptIn && !(survey_consent && survey_consent.accepted === true)) {
      return Response.json({
        error: "To also participate as a survey-taker, please accept the survey-participation consent (survey_consent.accepted required). Survey availability and reward are variable and not guaranteed.",
        requires_survey_consent: true,
      }, { status: 400 });
    }

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

    // Auto-register as business client
    base44.asServiceRole.functions.invoke('autoRegisterBusinessClient', {
      user_id: user.id,
      service_type: `PPC Grid Subscription (${plan})`,
      amount_paid: planConfig.amount / 100,
      description: planConfig.label,
    }).catch(() => null);

    // OPTIONAL survey-taker opt-in — records User flags + an append-only consent record. Best-effort;
    // a failure here never blocks the (already-completed) subscription.
    let surveyOptIn = null;
    if (wantsSurveyOptIn) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
      surveyOptIn = await recordAdvertiserSurveyOptIn(user.id, {
        accepted: true,
        termsVersion: survey_consent?.terms_version ?? null,
        ip,
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      plan,
      ...result,
      survey_optin: surveyOptIn
        ? { opted_in: true, provider: surveyOptIn.provider, note: "You're also set up as a survey-taker. Your surveys come from the third-party providers; availability and reward vary and are not guaranteed." }
        : { opted_in: false, available: advertiserSurveyOptInEnabled(), provider: advertiserSurveyProvider() },
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});