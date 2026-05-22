import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
        sender_batch_id: `gamergain_${senderItemId}_${Date.now()}`,
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Allow scheduled/service-role headless calls; only block non-admin user requests
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { action } = payload;

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

        // Send via PayPal
        const paypalResult = await sendPayPalPayout(
          token, pref.paypal_email, pending,
          `GamerGain referral earnings payout of $${pending.toFixed(2)}`,
          `ref_${u.id}_${Date.now()}`
        );

        const success = paypalResult.batch_header?.batch_status !== 'DENIED';
        const payoutId = paypalResult.batch_header?.payout_batch_id || null;

        // Record payout
        const payoutRecord = await base44.asServiceRole.entities.Payout.create({
          user_id: u.id,
          amount: pending,
          method: 'paypal',
          status: success ? 'completed' : 'failed',
          external_transaction_id: payoutId,
          description: 'Auto referral commission payout',
          payout_type: 'referral_commission',
        });

        if (success) {
          // Zero out pending earnings
          await base44.asServiceRole.auth.updateUser(u.id, { pending_earnings: 0 });

          // Notify user
          await base44.asServiceRole.entities.Notification.create({
            user_id: u.id,
            type: 'referral_earnings',
            title: '💸 Payout Sent!',
            message: `$${pending.toFixed(2)} has been sent to your PayPal (${pref.paypal_email}). It may take 1–3 business days to arrive.`,
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

      const prefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: target_user_id });
      const pref = prefs[0];

      if (!pref || pref.payout_method !== 'paypal' || !pref.paypal_email) {
        return Response.json({ error: 'User has no PayPal payout method configured' }, { status: 400 });
      }

      const token = await getPayPalToken();
      const note = reward_note || `GamerGain reward: ${reward_type || 'contest_win'}`;
      const paypalResult = await sendPayPalPayout(
        token, pref.paypal_email, amount, note,
        `${reward_type || 'reward'}_${target_user_id}_${Date.now()}`
      );

      const success = paypalResult.batch_header?.batch_status !== 'DENIED';
      const payoutId = paypalResult.batch_header?.payout_batch_id || null;

      await base44.asServiceRole.entities.Payout.create({
        user_id: target_user_id,
        amount,
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
          message: `$${amount.toFixed(2)} has been sent to your PayPal account. ${note}`,
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

      const prefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: winner_user_id });
      const pref = prefs[0];

      if (!pref || pref.payout_method !== 'paypal' || !pref.paypal_email) {
        // Credit to balance instead if no PayPal configured
        await base44.asServiceRole.auth.updateUser(winner_user_id, {
          pending_earnings: (winner.pending_earnings || 0) + prize_amount,
          total_earnings: (winner.total_earnings || 0) + prize_amount,
        });
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

      const token = await getPayPalToken();
      const note = `GamerGain contest win: ${contest_name} — Prize: $${prize_amount.toFixed(2)}`;
      const paypalResult = await sendPayPalPayout(
        token, pref.paypal_email, prize_amount, note,
        `contest_${winner_user_id}_${Date.now()}`
      );

      const success = paypalResult.batch_header?.batch_status !== 'DENIED';

      await base44.asServiceRole.entities.Payout.create({
        user_id: winner_user_id,
        amount: prize_amount,
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
          message: `$${prize_amount.toFixed(2)} has been sent to your PayPal (${pref.paypal_email}). Congratulations!`,
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