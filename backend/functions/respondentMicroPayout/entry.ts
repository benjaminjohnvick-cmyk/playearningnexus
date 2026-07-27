import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isPartnerPayout } from "../../sdk/payout-policy.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { getNumber } from "../../sdk/settings.ts";
import { allowedEarn } from "../../sdk/earn-cap.ts";

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
export default __handler(async (req) => {
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
    const grossPayout = survey.survey_type === 'data_collection' ? 2.00 : 0;
    if (grossPayout <= 0) {
      return Response.json({ success: false, reason: 'No payout for this survey type', payout: 0 });
    }

    // Revenue split — user receives this share (admin-adjustable; AI-optimized within bounds).
    const rewardShare = await getNumber("SURVEY_REWARD_CONVERSION", 0.5);
    let payoutAmount = Math.round(grossPayout * rewardShare * 100) / 100;

    // Enforce the per-user daily earnings cap (DAILY_EARN_CAP_USD; 0 = no cap).
    const allowance = await allowedEarn(base44, respondent_user_id, payoutAmount);
    if (allowance.capped) payoutAmount = allowance.allowed;
    if (payoutAmount <= 0) return Response.json({ success: false, reason: 'Daily earnings cap reached', payout: 0, cap: allowance.cap });

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

    // 1b. Record into DailyEarnings so the per-user daily earnings cap accumulates across payouts.
    const earnDay = new Date().toISOString().slice(0, 10);
    const deRows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: respondent_user_id, date: earnDay }).catch(() => []);
    if ((deRows || []).length) {
      await base44.asServiceRole.entities.DailyEarnings.update(deRows[0].id, {
        total_earned: (deRows[0].total_earned || 0) + payoutAmount,
        total_surveys_completed: (deRows[0].total_surveys_completed || 0) + 1,
      }).catch(() => null);
    } else {
      await base44.asServiceRole.entities.DailyEarnings.create({
        user_id: respondent_user_id, date: earnDay, total_earned: payoutAmount, total_surveys_completed: 1,
      }).catch(() => null);
    }

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

    // 5. Try instant PayPal payout if respondent has a PayPal email AND new balance ≥ $10.
    //    Closed-loop policy: a regular respondent's earnings stay as on-site credit — cash only
    //    goes out for business-partner payouts, and only while the cash_out kill-switch is ON.
    let paypalResult = null;
    const payoutPrefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: respondent_user_id });
    const pref = payoutPrefs[0];
    const cashAllowed = isPartnerPayout({ role: respondent.role, payout_type: "survey_payout" })
      && await isEnabled("cash_out", respondent.jurisdiction ?? respondent.state ?? null);
    if (cashAllowed && pref?.paypal_email && newBalance >= 10) {
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
      message: `+$${payoutAmount.toFixed(2)} added to your balance for completing "${survey.title}" (your reward share)${paypalResult?.sent ? ' — also sent via PayPal!' : ''}`,
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