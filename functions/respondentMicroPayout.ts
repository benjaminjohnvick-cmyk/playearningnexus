import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_SECRET_KEY = Deno.env.get('PAYPAL_SECRET_KEY');
const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_KEY}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal auth failed: ${data.error_description || res.status}`);
  return data.access_token;
}

/**
 * Triggered after fraud + quality checks pass.
 * Awards the respondent their $2 micro-payment via:
 *   1. Platform balance credit (instant, always)
 *   2. PayPal Payout (if respondent has PayPal email configured AND balance is ≥ $10)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { response_id, survey_id, respondent_user_id } = await req.json();
    if (!response_id || !survey_id || !respondent_user_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate response passes fraud + quality thresholds
    const [responses, surveys] = await Promise.all([
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ id: response_id }),
      base44.asServiceRole.entities.PPCSurvey.filter({ id: survey_id }),
    ]);

    const response = responses[0];
    const survey = surveys[0];

    if (!response || !survey) {
      return Response.json({ error: 'Response or survey not found' }, { status: 404 });
    }

    // Gate: must not be blocked by fraud detection
    if (response.is_blocked) {
      return Response.json({ success: false, reason: 'Response blocked by fraud detection', payout: 0 });
    }

    // Gate: quality score must be ≥ 40 (configurable)
    const qualityScore = response.quality_score ?? 100;
    if (qualityScore < 40) {
      return Response.json({ success: false, reason: `Quality score too low (${qualityScore}/100)`, payout: 0 });
    }

    // Gate: survey wallet must have budget remaining
    if ((survey.budget_remaining || 0) <= 0) {
      return Response.json({ success: false, reason: 'Survey wallet exhausted', payout: 0 });
    }

    // Check survey type payout amount
    const payoutAmount = survey.survey_type === 'data_collection' ? 2.00 : 0;
    if (payoutAmount <= 0) {
      return Response.json({ success: false, reason: 'No payout for this survey type', payout: 0 });
    }

    // Load respondent user
    const users = await base44.asServiceRole.entities.User.filter({ id: respondent_user_id });
    const respondent = users[0];
    if (!respondent) return Response.json({ error: 'Respondent not found' }, { status: 404 });

    // 1. Credit platform balance (always instant)
    const newBalance = (respondent.current_balance || 0) + payoutAmount;
    await base44.asServiceRole.entities.User.update(respondent_user_id, {
      current_balance: newBalance,
      total_earnings: (respondent.total_earnings || 0) + payoutAmount,
    });

    // 2. Deduct from survey wallet
    await base44.asServiceRole.entities.PPCSurvey.update(survey_id, {
      budget_remaining: Math.max(0, (survey.budget_remaining || 0) - payoutAmount),
      total_spent: (survey.total_spent || 0) + payoutAmount,
    });

    // 3. Record transaction
    await base44.asServiceRole.entities.PPCTransaction.create({
      user_id: respondent_user_id,
      transaction_type: 'survey_payout',
      amount: payoutAmount,
      net_amount: payoutAmount,
      related_survey_id: survey_id,
      description: `Survey response payout — ${survey.title}`,
      status: 'completed',
    });

    // 4. Mark the response as paid
    await base44.asServiceRole.entities.PPCSurveyResponse.update(response_id, {
      payout_to_user: payoutAmount,
    });

    // 5. Try instant PayPal payout if respondent has a PayPal email AND new balance ≥ $10
    let paypalResult = null;
    const payoutPrefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: respondent_user_id });
    const pref = payoutPrefs[0];
    if (pref?.paypal_email && newBalance >= 10) {
      try {
        const accessToken = await getPayPalAccessToken();
        const batchId = `RESP_${response_id}_${Date.now()}`;
        const ppRes = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender_batch_header: {
              sender_batch_id: batchId,
              email_subject: 'Your GamerGain Survey Earnings!',
              email_message: `You earned $${newBalance.toFixed(2)} completing surveys on GamerGain. Keep it up!`,
            },
            items: [{
              recipient_type: 'EMAIL',
              amount: { value: newBalance.toFixed(2), currency: 'USD' },
              receiver: pref.paypal_email,
              note: `GamerGain survey earnings — ${survey.title}`,
              sender_item_id: batchId,
            }],
          }),
        });
        const ppData = await ppRes.json();
        if (ppRes.ok) {
          // Zero out balance after PayPal payout
          await base44.asServiceRole.entities.User.update(respondent_user_id, { current_balance: 0 });
          await base44.asServiceRole.entities.Payout.create({
            user_id: respondent_user_id,
            recipient_email: pref.paypal_email,
            amount: newBalance,
            method: 'paypal',
            payout_type: 'manual',
            status: 'processing',
            paypal_batch_id: ppData.batch_header?.payout_batch_id,
            description: 'Auto micro-payout after survey completion',
          });
          paypalResult = { sent: true, batch_id: ppData.batch_header?.payout_batch_id };
        }
      } catch { /* PayPal failure is non-fatal — balance credit already applied */ }
    }

    // 6. Send in-app notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: respondent_user_id,
      type: 'survey_payout',
      title: '💰 Survey Payout Received!',
      message: `+$${payoutAmount.toFixed(2)} added to your balance for completing "${survey.title}"${paypalResult?.sent ? ' — also sent via PayPal!' : ''}`,
      status: 'unread',
      delivery_method: ['in_app'],
    });

    return Response.json({
      success: true,
      payout: payoutAmount,
      new_balance: newBalance,
      paypal_payout: paypalResult,
      quality_score: qualityScore,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});