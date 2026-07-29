import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";
import { isPartnerPayout } from "../../sdk/payout-policy.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { applyBackupWithholding } from "../../sdk/tax.ts";
import { postLedgerEntry } from "../../sdk/ledger.ts";
import { db } from "../../sdk/db.ts";
import { emitEvent } from "../../sdk/events.ts";
import Stripe from 'npm:stripe@14.25.0';

// CashApp Cash Card is a Visa debit card.
// Stripe Instant Payouts push money to any Visa/Mastercard debit card within 30 minutes.
// Frontend collects Cash Card details via Stripe Elements, sends us a card token.
// We create a Stripe Connected Account external card and issue an Instant Payout.

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "cashappPayout", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "cashappPayout — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { payoutId, cardToken, amount, currency = 'usd', payout_type } = body;

    // --- Closed-loop policy: no cash out to regular users; business partners only ---
    if (!isPartnerPayout({ role: user?.role, payout_type }, { trustType: false })) {
      return Response.json({
        blocked: true, closed_loop: true, cash_sent: false,
        message: 'Closed-loop platform: user earnings remain as on-site credit (redeemable for perks) and are not paid out as cash. Only business-partner revenue shares are paid via Cash App.',
      }, { status: 200 });
    }

    // --- cash_out kill-switch: an emergency brake on ALL cash disbursement (safe-default OFF) ---
    if (!(await isEnabled('cash_out', user?.jurisdiction ?? user?.state ?? null))) {
      return Response.json({ blocked: true, cash_out_disabled: true, cash_sent: false,
        message: 'Cash payouts are currently disabled.' }, { status: 403 });
    }

    if (!payoutId || !cardToken || !amount) {
      return Response.json({ error: 'Missing required fields: payoutId, cardToken, amount' }, { status: 400 });
    }
    if (amount < 10) return Response.json({ error: 'Minimum payout is $10' }, { status: 400 });

    // Tax: backup withholding when no W-9 is on file — pay net, set aside `withheld`.
    const wh = applyBackupWithholding(Number(amount), user);
    const amountCents = Math.round(wh.net * 100);

    // IDEMPOTENCY: claim the payout (pending → processing) before moving any money; a retry bails. The
    // Stripe calls below also each carry an idempotencyKey keyed on payoutId, so a retry can't double-pay.
    const claimed = await db.updateIf("Payout", String(payoutId), { status: "processing", claimed_at: new Date().toISOString() }, { field: "status", equals: "pending" }).catch(() => null);
    if (!claimed) return Response.json({ error: "This payout is already processing or completed.", already: true }, { status: 409 });

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

    // Fund the connected account via a transfer from platform (idempotent on payoutId).
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency,
      destination: stripeAccountId,
      description: `GamerGain CashApp payout for user ${user.id}`,
    }, { idempotencyKey: `gg-transfer-${payoutId}` });

    // Attach the Cash Card token as an external account on the connected account
    const externalAccount = await stripe.accounts.createExternalAccount(stripeAccountId, {
      external_account: cardToken,
    });

    // Issue Instant Payout to the Cash Card (idempotent on payoutId — a retry returns the same payout).
    const payout = await stripe.payouts.create(
      {
        amount: amountCents,
        currency,
        method: 'instant',
        destination: externalAccount.id,
        description: 'GamerGain CashApp Instant Payout',
        metadata: { payout_id: payoutId, user_id: user.id },
      },
      { stripeAccount: stripeAccountId, idempotencyKey: `gg-payout-${payoutId}` }
    );

    await base44.asServiceRole.entities.Payout.update(payoutId, {
      status: 'processing',
      external_transaction_id: payout.id,
      net_amount: wh.net,
      withheld_amount: wh.withheld,
      withholding_rate: wh.rate,
    });

    // Compliance: immutable money-movement audit entry (feeds 1099 totals in tax.ts).
    await postLedgerEntry({
      user_id: user.id, type: 'payout_cashapp', amount: -Math.abs(Number(amount) || 0), currency: 'USD',
      ref: payout.id, idempotency_key: `cashappPayout:${payoutId}`,
      meta: { payout_type: payout_type ?? null },
    }).catch(() => null);

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: 'purchase_complete',
      title: '💚 Cash App Payout Sent!',
      message: `Your $${wh.net.toFixed(2)} has been sent to your Cash Card via Stripe Instant Payout.${wh.withheld > 0 ? ` ($${wh.withheld.toFixed(2)} withheld — submit your W-9 to receive the full amount.)` : ''} Arrives within 30 minutes. ID: ${payout.id}`,
      status: 'unread',
      delivery_method: ['in_app'],
    }).catch(() => null);

    await emitEvent("payout.executed", {
      payout_id: payoutId, rail: "cashapp", transaction_id: payout.id,
      amount: Number(amount) || 0, net: wh.net, payout_type: payout_type ?? null,
    }, { source: "cashappPayout" }).catch(() => null);

    return Response.json({ success: true, payout_id: payout.id, status: 'processing', arrival: '~30 minutes' });
  } catch (error) {
    try { const b = await req.clone().json().catch(() => ({})); if (b?.payoutId) await db.update("Payout", String(b.payoutId), { status: "pending" }).catch(() => null); } catch { /* */ }
    await emitEvent("payout.failed", { rail: "cashapp", error: (error as Error).message }, { source: "cashappPayout" }).catch(() => null);
    return Response.json({ error: error.message }, { status: 500 });
  }
});