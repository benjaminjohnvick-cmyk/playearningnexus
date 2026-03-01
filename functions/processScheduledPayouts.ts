import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_SECRET_KEY = Deno.env.get('PAYPAL_SECRET_KEY');
const PAYPAL_BASE = 'https://api-m.paypal.com';

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
        sender_batch_id: `gg_sched_${senderItemId}_${Date.now()}`,
        email_subject: 'GamerGain Payout!',
        email_message: note,
      },
      items: [{
        recipient_type: 'EMAIL',
        amount: { value: amount.toFixed(2), currency: 'USD' },
        receiver: recipientEmail,
        note,
        sender_item_id: String(senderItemId),
      }]
    })
  });
  return res.json();
}

// Returns true if a payout is due based on frequency and last payout date
function isPayoutDue(frequency, lastPayoutDate) {
  if (!lastPayoutDate) return true; // Never been paid, always due
  const daysSince = (Date.now() - new Date(lastPayoutDate)) / (1000 * 60 * 60 * 24);
  const thresholds = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    net_30: 30,
    net_60: 60,
    net_90: 90,
    on_demand: Infinity, // Never auto-process on_demand
  };
  return daysSince >= (thresholds[frequency] || 90);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both admin-triggered and scheduled (no user context) calls
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch {
      // Called from scheduler (no user), allow via service role
      isAdmin = true;
    }

    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allUsers = await base44.asServiceRole.entities.User.list();
    const allPrefs = await base44.asServiceRole.entities.PayoutPreference.list();
    const allPayouts = await base44.asServiceRole.entities.Payout.list();

    const results = { processed: 0, skipped: 0, failed: 0, details: [] };

    // Get PayPal token once for all payouts
    let paypalToken = null;
    if (PAYPAL_CLIENT_ID && PAYPAL_SECRET_KEY) {
      paypalToken = await getPayPalToken();
    }

    for (const u of allUsers) {
      const pending = u.pending_earnings || 0;
      if (pending <= 0) { results.skipped++; continue; }

      const pref = allPrefs.find(p => p.user_id === u.id);
      if (!pref || !pref.auto_payout_enabled) { results.skipped++; continue; }
      if (pref.payout_frequency === 'on_demand') { results.skipped++; continue; }

      // Check threshold
      const threshold = pref.minimum_payout_threshold || 50;
      if (pending < threshold) { results.skipped++; continue; }

      // Check if payout is due based on schedule
      const userPayouts = allPayouts
        .filter(p => p.user_id === u.id && p.status === 'completed')
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      const lastPayoutDate = userPayouts[0]?.created_date || null;

      if (!isPayoutDue(pref.payout_frequency, lastPayoutDate)) {
        results.skipped++;
        continue;
      }

      // Process based on method
      let success = false;
      let externalId = null;
      let errorMsg = null;

      if (pref.payout_method === 'paypal' && pref.paypal_email) {
        if (!paypalToken) {
          errorMsg = 'PayPal not configured';
        } else {
          const note = `GamerGain payout of $${pending.toFixed(2)} (${pref.payout_frequency} schedule)`;
          const result = await sendPayPalPayout(paypalToken, pref.paypal_email, pending, note, `sched_${u.id}`);
          success = result.batch_header?.batch_status !== 'DENIED';
          externalId = result.batch_header?.payout_batch_id || null;
          if (!success) errorMsg = result.message || 'PayPal payout denied';
        }
      } else if (pref.payout_method === 'bank_transfer') {
        // ACH: Mark as processing (manual bank transfer handled externally)
        success = true;
        externalId = `ach_${u.id}_${Date.now()}`;
      } else {
        errorMsg = `Unsupported method: ${pref.payout_method}`;
      }

      // Record payout
      await base44.asServiceRole.entities.Payout.create({
        user_id: u.id,
        recipient_email: pref.paypal_email || null,
        amount: pending,
        method: pref.payout_method,
        status: success ? (pref.payout_method === 'bank_transfer' ? 'processing' : 'completed') : 'failed',
        external_transaction_id: externalId,
        description: `Scheduled ${pref.payout_frequency} payout`,
        payout_type: 'referral_commission',
        error_message: errorMsg || null,
      });

      if (success) {
        // Clear pending earnings
        await base44.asServiceRole.auth.updateUser(u.id, { pending_earnings: 0 });

        // Success notification
        const methodLabel = pref.payout_method === 'bank_transfer' ? 'your bank account (ACH, 3–5 business days)' : `your PayPal (${pref.paypal_email})`;
        await base44.asServiceRole.entities.Notification.create({
          user_id: u.id,
          type: 'referral_earnings',
          title: '💸 Payout Initiated!',
          message: `$${pending.toFixed(2)} has been sent to ${methodLabel}. Schedule: ${pref.payout_frequency}.`,
          status: 'unread',
          delivery_method: ['in_app'],
        });
        results.processed++;
      } else {
        // Failure notification
        await base44.asServiceRole.entities.Notification.create({
          user_id: u.id,
          type: 'referral_earnings',
          title: '⚠️ Payout Issue',
          message: `We couldn't process your $${pending.toFixed(2)} payout. Reason: ${errorMsg}. Please check your Payout Settings.`,
          status: 'unread',
          delivery_method: ['in_app'],
        });
        results.failed++;
      }

      results.details.push({ user_id: u.id, amount: pending, method: pref.payout_method, success, errorMsg });
    }

    return Response.json({ ok: true, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});