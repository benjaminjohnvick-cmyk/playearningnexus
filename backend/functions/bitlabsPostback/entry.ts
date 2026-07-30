import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber } from "../../sdk/settings.ts";
import { allowedEarn } from "../../sdk/earn-cap.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { computeSurveyReward, isPremiumUser } from "../../sdk/survey-reward.ts";

// HMAC-SHA256 of the callback URL (signature param stripped), hex, constant-time compared.
async function verifyHmac(url: URL, provided: string, secret: string): Promise<boolean> {
  try {
    const u = new URL(url.toString());
    u.searchParams.delete("hash");
    u.searchParams.delete("signature");
    const message = u.pathname + u.search;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const a = hex.toLowerCase();
    const b = String(provided).toLowerCase();
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

// BitLabs calls this URL when a survey is completed
// Set the postback URL in BitLabs dashboard to: {your_function_url}/bitlabsPostback
// With params: ?uid=[USER_ID]&reward=[REWARD]&survey_id=[SURVEY_ID]
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);

    // BitLabs sends these as query params
    const uid = url.searchParams.get('uid');
    const reward = parseFloat(url.searchParams.get('reward') || '0');
    const surveyId = url.searchParams.get('survey_id') || '';

    if (!uid || !reward) {
      return Response.json({ error: 'Missing uid or reward' }, { status: 400 });
    }

    // --- Verify the postback is genuinely from BitLabs (this is a MONEY-IN endpoint). ------------
    // Auth is now MANDATORY: either a shared token matching BITLABS_API_KEY (append &token=<key> to
    // the postback URL in the BitLabs dashboard), OR a valid HMAC-SHA256 signature over the callback
    // URL using BITLABS_WEBHOOK_SECRET. An unauthenticated postback is REJECTED — previously a
    // request with no token was accepted, which let anyone credit an arbitrary balance.
    const apiKey = Deno.env.get('BITLABS_API_KEY');
    const secret = Deno.env.get('BITLABS_WEBHOOK_SECRET');
    const token = url.searchParams.get('token') || req.headers.get('x-api-key');
    const sig = url.searchParams.get('hash') || url.searchParams.get('signature') || req.headers.get('x-bitlabs-signature');

    let authorized = false;
    if (apiKey && token && token === apiKey) authorized = true;
    if (!authorized && secret && sig) authorized = await verifyHmac(url, sig, secret);
    if (!authorized) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get all users and find by ID (uid = user.id)
    const users = await base44.asServiceRole.entities.User.list();
    const user = users.find(u => u.id === uid);
    if (!user) {
      return new Response('OK', { status: 200 }); // Return OK to prevent retries
    }

    // TIERED SURVEY REWARD (replaces the old flat 50/50). The platform keeps the BitLabs CASH; the
    // user's reward is POINTS (non-premium: 12 pts/$ — closed-loop, non-cashable) or CASH BACK
    // (premium: 24% of $). No user-to-user movement; non-premium users never receive cash.
    const gross = Math.max(0, Math.round(reward * 100) / 100);
    const premium = await isPremiumUser(uid);
    const rw = await computeSurveyReward(premium, gross);

    // Daily earnings cap applies to the user's realized $ value; scale the reward down if capped.
    let creditPoints = rw.points;
    let creditCash = rw.cashUsd;
    let realizedUsd = rw.realizedUsd;
    const allowance = await allowedEarn(base44, uid, realizedUsd);
    if (allowance.capped) {
      const scale = realizedUsd > 0 ? allowance.allowed / realizedUsd : 0;
      creditPoints = Math.round(creditPoints * scale);
      creditCash = Math.round(creditCash * scale * 100) / 100;
      realizedUsd = allowance.allowed;
    }
    if (realizedUsd <= 0 && creditPoints <= 0) {
      return Response.json({ ok: true, capped: true, reason: 'Daily earnings cap reached', cap: allowance.cap });
    }
    const today = new Date().toISOString().split('T')[0];

    // DailyEarnings: total_earned = the value the user actually received today ($, kept honest so
    // "you earned $X" is never overstated); survey_gross = gross survey value done today (drives the
    // $8/day store-unlock goal, since the user's take is now 12%/24%, not 50%).
    const dailyEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({
      user_id: uid,
      date: today
    });

    if (dailyEarnings.length > 0) {
      const current = dailyEarnings[0];
      await base44.asServiceRole.entities.DailyEarnings.update(current.id, {
        total_earned: (current.total_earned || 0) + realizedUsd,
        survey_gross: (current.survey_gross || 0) + gross,
        total_surveys_completed: (current.total_surveys_completed || 0) + 1
      });
    } else {
      await base44.asServiceRole.entities.DailyEarnings.create({
        user_id: uid,
        date: today,
        total_earned: realizedUsd,
        survey_gross: gross,
        total_surveys_completed: 1
      });
    }

    // Credit the user: points (non-premium) or cash back (premium). Atomic CAS. Platform keeps the pool.
    if (rw.isPremium && creditCash > 0) {
      await adjustUserBalance(uid, creditCash, { field: "current_balance" });
    } else if (creditPoints > 0) {
      await adjustUserBalance(uid, creditPoints, { field: "points" });
    }
    // Lifetime realized value (drives tiers/narratives) — the value the user actually received, in $.
    await adjustUserBalance(uid, realizedUsd, { field: "total_earnings" });

    const rewardLabel = rw.isPremium ? `$${creditCash.toFixed(2)} cash back` : `${creditPoints} points`;

    // Create transaction record.
    await base44.asServiceRole.entities.Transaction.create({
      user_id: uid,
      amount: realizedUsd,
      transaction_type: 'survey_completion',
      status: 'completed',
      description: `Survey completed — earned ${rewardLabel} on a $${gross.toFixed(2)} survey`,
      payment_intent_id: surveyId
    });

    // Send in-app notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: uid,
      type: 'points_earned',
      title: '✅ Survey Completed!',
      message: `You earned ${rewardLabel} from a survey. Keep going to reach your $8/day survey goal!`,
      status: 'unread',
      delivery_method: ['in_app']
    });

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('BitLabs postback error:', error.message);
    return new Response('OK', { status: 200 }); // Always return OK to BitLabs
  }
});