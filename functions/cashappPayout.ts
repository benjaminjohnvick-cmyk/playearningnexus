import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.25.0';

// CashApp Cash Card is a Visa debit card.
// Stripe Instant Payouts push money to any Visa/Mastercard debit card within 30 minutes.
// Frontend collects Cash Card details via Stripe Elements, sends us a card token.
// We create a Stripe Connected Account external card and issue an Instant Payout.

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { payoutId, cardToken, amount, currency = 'usd' } = await req.json();
    if (!payoutId || !cardToken || !amount) {
      return Response.json({ error: 'Missing required fields: payoutId, cardToken, amount' }, { status: 400 });
    }
    if (amount < 10) return Response.json({ error: 'Minimum payout is $10' }, { status: 400 });

    const amountCents = Math.round(amount * 100);

    // Create or retrieve a Stripe Connected Account for this user
    let stripeAccountId = user.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'custom',
        country: 'US',
        email: user.email,
        capabilities: { transfers: { requested: true } },
        business_type: 'individual',
        individual: { email: user.email },
        tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
      });
      stripeAccountId = account.id;
      await base44.auth.updateMe({ stripe_account_id: stripeAccountId });
    }

    // Fund the connected account via a transfer from platform
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency,
      destination: stripeAccountId,
      description: `GamerGain CashApp payout for user ${user.id}`,
    });

    // Attach the Cash Card token as an external account on the connected account
    const externalAccount = await stripe.accounts.createExternalAccount(stripeAccountId, {
      external_account: cardToken,
    });

    // Issue Instant Payout to the Cash Card
    const payout = await stripe.payouts.create(
      {
        amount: amountCents,
        currency,
        method: 'instant',
        destination: externalAccount.id,
        description: 'GamerGain CashApp Instant Payout',
        metadata: { payout_id: payoutId, user_id: user.id },
      },
      { stripeAccount: stripeAccountId }
    );

    await base44.asServiceRole.entities.Payout.update(payoutId, {
      status: 'processing',
      external_transaction_id: payout.id,
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: 'purchase_complete',
      title: '💚 Cash App Payout Sent!',
      message: `Your $${amount.toFixed(2)} has been sent to your Cash Card via Stripe Instant Payout. Arrives within 30 minutes. ID: ${payout.id}`,
      status: 'unread',
      delivery_method: ['in_app'],
    });

    return Response.json({ success: true, payout_id: payout.id, status: 'processing', arrival: '~30 minutes' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});