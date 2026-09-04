import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { advertiserSurveyOptInEnabled, advertiserSurveyProvider, recordAdvertiserSurveyOptIn } from "../../sdk/advertiser-surveys.ts";
import { recurringRequireConsent } from "../../sdk/recurring-billing-compliance.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
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

    const { plan, payment_method_id, amount, survey_optin, survey_consent, recurring_consent } = await req.json();

    const planConfig = PLANS[plan];
    if (!planConfig) return Response.json({ error: 'Invalid plan' }, { status: 400 });

    // ── STRICT-STANDARD recurring-billing consent gate (CA ARL / ROSCA) ──
    // The daily/monthly plans create a RECURRING Stripe subscription (a negative option). Under the platform's
    // strict standard, a recurring auto-charge requires EXPRESS affirmative consent to the recurring terms,
    // captured here and recorded to the consent ledger. The yearly plan is a one-time charge (no recurring
    // consent needed). This is the single most important auto-renewal-law lever for a live billing surface.
    const isRecurring = plan === 'daily' || plan === 'monthly';
    if (isRecurring && recurringRequireConsent() && !(recurring_consent && recurring_consent.accepted === true)) {
      return Response.json({
        error: `This is a recurring ${planConfig.label} that auto-renews until you cancel. To proceed you must accept the auto-renewal terms (recurring_consent.accepted required). You can cancel any time from your billing settings; you'll get advance + final renewal reminders before each charge.`,
        requires_recurring_consent: true,
        recurring: { interval: planConfig.interval, amount_usd: planConfig.amount / 100 },
      }, { status: 400 });
    }

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

    // Mark user as active on PPC grid. For a recurring plan, record the express auto-renew consent + flag so
    // the strict recurring-billing guard recognizes this subscription as consented (and the cancel path works).
    await base44.asServiceRole.entities.User.update(user.id, {
      ppc_grid_active: true,
      ppc_grid_plan: plan,
      ppc_grid_activated_at: new Date().toISOString(),
      ...(isRecurring ? { ppc_auto_renew_consent: true, auto_renew_consent: true, auto_renew_optout: false } : {}),
    });
    if (isRecurring) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
      await recordConsent({
        user_id: user.id, kind: 'recurring_billing', version: 'ppc-grid-recurring-1', accepted: true,
        shown: { plan, interval: planConfig.interval, amount_usd: planConfig.amount / 100, cancel: 'anytime in billing settings' },
        ip, meta: { surface: 'processPPCGridSubscription', plan },
      }).catch(() => null);
    }

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