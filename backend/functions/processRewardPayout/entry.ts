import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isPartnerPayout } from "../../sdk/payout-policy.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { applyBackupWithholding } from "../../sdk/tax.ts";
import { postLedgerEntry } from "../../sdk/ledger.ts";
import { db } from "../../sdk/db.ts";
import { featureAllowed, prizeNeedsRegistration, minAgeFor } from "../../sdk/jurisdiction.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";

// Age from a DOB field, if present (null when unknown → don't block on unknown age).
function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_SECRET_KEY = Deno.env.get('PAYPAL_SECRET_KEY');
const PAYPAL_BASE = 'https://api-m.paypal.com'; // use sandbox: https://api-m.sandbox.paypal.com for testing

async function getPayPalToken() {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_KEY}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

async function sendPayPalPayout(token, recipientEmail, amount, note, senderItemId) {
  const res = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `gamergain_${senderItemId}`, // caller passes a stable, unique senderItemId
        email_subject: 'GamerGain Reward Payout!',
        email_message: note,
      },
      items: [{
        recipient_type: 'EMAIL',
        amount: { value: amount.toFixed(2), currency: 'USD' },
        receiver: recipientEmail,
        note,
        sender_item_id: senderItemId,
      }]
    })
  });
  return res.json();
}

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Allow scheduled/service-role headless calls; only block non-admin user requests
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { action } = payload;

    // Closed-loop policy: cash only leaves the system for business-partner payouts, and only while
    // the cash_out kill-switch is ON. Regular-user earnings stay as on-site credit.
    const cashOutOn = await isEnabled("cash_out");

    // ── Process all pending rewards automatically ──────────────────────────────
    if (action === 'process_all') {
      const token = await getPayPalToken();
      const results = [];

      // 1. Referral commissions: users with pending_earnings >= threshold
      const allUsers = await base44.asServiceRole.entities.User.list();
      const allPrefs = await base44.asServiceRole.entities.PayoutPreference.list();
      const allPayouts = await base44.asServiceRole.entities.Payout.list();

      for (const u of allUsers) {
        const pending = u.pending_earnings || 0;
        if (pending <= 0) continue;

        // Closed-loop: skip anyone who isn't a cash-eligible business partner (or if cash_out is off).
        if (!cashOutOn || !isPartnerPayout({ role: u.role, payout_type: 'referral_commission' })) continue;

        const pref = allPrefs.find(p => p.user_id === u.id);
        if (!pref || !pref.auto_payout_enabled) continue;
        if (pending < (pref.minimum_payout_threshold || 50)) continue;
        if (pref.payout_method !== 'paypal' || !pref.paypal_email) continue;

        // Check frequency — skip if too soon
        const userPayouts = allPayouts.filter(p => p.user_id === u.id && p.status === 'completed');
        if (userPayouts.length > 0) {
          const lastPayout = userPayouts.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
          const daysSinceLast = (Date.now() - new Date(lastPayout.created_date)) / (1000 * 60 * 60 * 24);
          const minDays = pref.payout_frequency === 'net_30' ? 30 : pref.payout_frequency === 'net_60' ? 60 : 90;
          if (daysSinceLast < minDays) continue;
        }

        // Tax: backup withholding when no W-9 is on file — send net, set aside `withheld`.
        const wh = applyBackupWithholding(pending, u);

        // IDEMPOTENCY / anti-double-pay: atomically CLAIM this user's pending earnings (set to 0,
        // conditioned on the exact value we read) BEFORE sending. If a concurrent run already claimed it,
        // updateIf returns null and we skip — so two overlapping runs can't both pay the same balance.
        const claimed = await db.updateIf("User", u.id, { pending_earnings: 0 }, { field: "pending_earnings", equals: String(pending) }).catch(() => null);
        if (!claimed) continue;

        // Send via PayPal (stable per-user/day sender id so a retry dedupes at PayPal).
        const paypalResult = await sendPayPalPayout(
          token, pref.paypal_email, wh.net,
          `GamerGain referral earnings payout of $${wh.net.toFixed(2)}`,
          `ref_${u.id}_${new Date().toISOString().slice(0, 10)}`
        );

        const success = paypalResult.batch_header?.batch_status !== 'DENIED';
        const payoutId = paypalResult.batch_header?.payout_batch_id || null;

        // Record payout
        const payoutRecord = await base44.asServiceRole.entities.Payout.create({
          user_id: u.id,
          amount: pending,               // gross
          net_amount: wh.net,
          withheld_amount: wh.withheld,
          withholding_rate: wh.rate,
          method: 'paypal',
          status: success ? 'completed' : 'failed',
          external_transaction_id: payoutId,
          description: 'Auto referral commission payout',
          payout_type: 'referral_commission',
        });

        if (!success) {
          // Payment failed — RESTORE the claimed pending earnings so it can be retried, no money lost.
          await base44.asServiceRole.auth.updateUser(u.id, { pending_earnings: pending }).catch(() => null);
        }

        if (success) {
          // Immutable money-movement audit entry (feeds 1099 totals).
          await postLedgerEntry({
            user_id: u.id, type: 'referral_payout', amount: -Math.abs(pending), currency: 'USD',
            ref: payoutId, idempotency_key: `processRewardPayout:ref:${u.id}:${new Date().toISOString().slice(0, 10)}`,
            meta: { method: 'paypal' },
          }).catch(() => null);

          // Notify user
          await base44.asServiceRole.entities.Notification.create({
            user_id: u.id,
            type: 'referral_earnings',
            title: '💸 Payout Sent!',
            message: `$${wh.net.toFixed(2)} has been sent to your PayPal (${pref.paypal_email}).${wh.withheld > 0 ? ` ($${wh.withheld.toFixed(2)} withheld — submit your W-9 to receive the full amount.)` : ''} It may take 1–3 business days to arrive.`,
            status: 'unread',
            delivery_method: ['in_app'],
          });
        }

        results.push({ user_id: u.id, amount: pending, success, payoutId });
      }

      return Response.json({ ok: true, processed: results.length, results });
    }

    // ── Manual single user payout ──────────────────────────────────────────────
    if (action === 'single') {
      const { target_user_id, amount, reward_type, reward_note } = payload;

      const allUsers = await base44.asServiceRole.entities.User.list();
      const targetUser = allUsers.find(u => u.id === target_user_id);
      if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });

      // Closed-loop: only business partners can receive cash, and only while cash_out is ON.
      if (!cashOutOn || !isPartnerPayout({ role: targetUser.role, payout_type: reward_type || 'manual' })) {
        return Response.json({ blocked: true, closed_loop: true, cash_sent: false,
          message: 'Closed-loop platform: this recipient is not cash-eligible. Reward remains as on-site credit.' }, { status: 200 });
      }

      const prefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: target_user_id });
      const pref = prefs[0];

      if (!pref || pref.payout_method !== 'paypal' || !pref.paypal_email) {
        return Response.json({ error: 'User has no PayPal payout method configured' }, { status: 400 });
      }

      // Tax: backup withholding when no W-9 is on file — send net, set aside `withheld`.
      const wh = applyBackupWithholding(Number(amount), targetUser);
      const token = await getPayPalToken();
      const note = reward_note || `GamerGain reward: ${reward_type || 'contest_win'}`;
      const paypalResult = await sendPayPalPayout(
        token, pref.paypal_email, wh.net, note,
        `${reward_type || 'reward'}_${target_user_id}_${Date.now()}`
      );

      const success = paypalResult.batch_header?.batch_status !== 'DENIED';
      const payoutId = paypalResult.batch_header?.payout_batch_id || null;

      await base44.asServiceRole.entities.Payout.create({
        user_id: target_user_id,
        amount,                          // gross
        net_amount: wh.net,
        withheld_amount: wh.withheld,
        withholding_rate: wh.rate,
        method: 'paypal',
        status: success ? 'completed' : 'failed',
        external_transaction_id: payoutId,
        description: note,
        payout_type: reward_type || 'manual',
      });

      if (success) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: target_user_id,
          type: 'referral_earnings',
          title: '🎉 You received a reward!',
          message: `$${wh.net.toFixed(2)} has been sent to your PayPal account.${wh.withheld > 0 ? ` ($${wh.withheld.toFixed(2)} withheld — submit your W-9 for the full amount.)` : ''} ${note}`,
          status: 'unread',
          delivery_method: ['in_app'],
        });
      }

      return Response.json({ ok: success, payoutId, paypalResult });
    }

    // ── Contest winner payout ──────────────────────────────────────────────────
    if (action === 'contest_winner') {
      const { winner_user_id, prize_amount, contest_name } = payload;

      const allUsers = await base44.asServiceRole.entities.User.list();
      const winner = allUsers.find(u => u.id === winner_user_id);
      if (!winner) return Response.json({ error: 'Winner not found' }, { status: 404 });

      // Jurisdiction + age gate at payout (mirrors processWeeklyJackpot / distributeTournamentPrizes):
      // don't award a contest prize where prize competitions are blocked, to an under-age winner, or at/
      // above the state's sweepstakes-registration threshold — hold those for manual review instead.
      const juris = winner.jurisdiction ?? winner.state ?? null;
      const winnerAge = ageFromDob(winner.date_of_birth ?? winner.dob);
      if (!featureAllowed('jackpots', juris)) {
        return Response.json({ ok: false, held: true, reason: 'feature_blocked_in_jurisdiction', amount: prize_amount });
      }
      if (winnerAge != null && winnerAge < minAgeFor(juris)) {
        return Response.json({ ok: false, held: true, reason: 'under_minimum_age', amount: prize_amount });
      }
      if (prizeNeedsRegistration(Number(prize_amount) || 0, juris)) {
        return Response.json({ ok: false, held: true, reason: 'prize_registration_threshold', amount: prize_amount });
      }

      const prefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: winner_user_id });
      const pref = prefs[0];

      // Closed-loop: unless the winner is a cash-eligible partner (and cash_out is ON), keep the
      // prize as on-site credit rather than sending cash.
      const winnerCashOk = cashOutOn && isPartnerPayout({ role: winner.role, payout_type: 'contest_win' });
      if (!winnerCashOk || !pref || pref.payout_method !== 'paypal' || !pref.paypal_email) {
        // Credit to balance instead if not cash-eligible or no PayPal configured. Atomic compare-and-set
        // per field so a duplicate contest-payout call can't double-credit the winner.
        await adjustUserBalance(winner_user_id, Number(prize_amount) || 0, { field: "pending_earnings" }).catch(() => null);
        await adjustUserBalance(winner_user_id, Number(prize_amount) || 0, { field: "total_earnings" }).catch(() => null);
        await base44.asServiceRole.entities.Notification.create({
          user_id: winner_user_id,
          type: 'referral_earnings',
          title: `🏆 Contest Win: ${contest_name}!`,
          message: `You won $${prize_amount.toFixed(2)}! It's been credited to your balance. Set up PayPal in Payout Settings to receive future winnings instantly.`,
          status: 'unread',
          delivery_method: ['in_app'],
        });
        return Response.json({ ok: true, method: 'balance_credit', amount: prize_amount });
      }

      // Tax: backup withholding when no W-9 is on file — send net, set aside `withheld`.
      const wh = applyBackupWithholding(Number(prize_amount), winner);
      const token = await getPayPalToken();
      const note = `GamerGain contest win: ${contest_name} — Prize: $${prize_amount.toFixed(2)}`;
      const paypalResult = await sendPayPalPayout(
        token, pref.paypal_email, wh.net, note,
        `contest_${winner_user_id}_${Date.now()}`
      );

      const success = paypalResult.batch_header?.batch_status !== 'DENIED';

      await base44.asServiceRole.entities.Payout.create({
        user_id: winner_user_id,
        amount: prize_amount,            // gross
        net_amount: wh.net,
        withheld_amount: wh.withheld,
        withholding_rate: wh.rate,
        method: 'paypal',
        status: success ? 'completed' : 'failed',
        external_transaction_id: paypalResult.batch_header?.payout_batch_id,
        description: note,
        payout_type: 'contest_win',
      });

      if (success) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: winner_user_id,
          type: 'referral_earnings',
          title: `🏆 Contest Win Paid: ${contest_name}!`,
          message: `$${wh.net.toFixed(2)} has been sent to your PayPal (${pref.paypal_email}).${wh.withheld > 0 ? ` ($${wh.withheld.toFixed(2)} withheld — submit your W-9 for the full amount.)` : ''} Congratulations!`,
          status: 'unread',
          delivery_method: ['in_app'],
        });
      }

      return Response.json({ ok: success, method: 'paypal', paypalResult });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});