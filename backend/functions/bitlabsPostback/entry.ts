import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber } from "../../sdk/settings.ts";
import { allowedEarn } from "../../sdk/earn-cap.ts";

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

    // Revenue split (admin-adjustable; AI-optimized within bounds), then the daily earnings cap.
    const rewardShare = await getNumber("SURVEY_REWARD_CONVERSION", 0.5);
    let userEarnings = Math.round(reward * rewardShare * 100) / 100;
    const allowance = await allowedEarn(base44, uid, userEarnings);
    if (allowance.capped) userEarnings = allowance.allowed;
    if (userEarnings <= 0) return Response.json({ ok: true, capped: true, reason: 'Daily earnings cap reached', cap: allowance.cap });
    const today = new Date().toISOString().split('T')[0];

    // Update or create DailyEarnings
    const dailyEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({
      user_id: uid,
      date: today
    });

    if (dailyEarnings.length > 0) {
      const current = dailyEarnings[0];
      await base44.asServiceRole.entities.DailyEarnings.update(current.id, {
        total_earned: (current.total_earned || 0) + userEarnings,
        total_surveys_completed: (current.total_surveys_completed || 0) + 1
      });
    } else {
      await base44.asServiceRole.entities.DailyEarnings.create({
        user_id: uid,
        date: today,
        total_earned: userEarnings,
        total_surveys_completed: 1
      });
    }

    // Update user's total balance
    await base44.asServiceRole.auth.updateUser(uid, {
      current_balance: (user.current_balance || 0) + userEarnings,
      total_earnings: (user.total_earnings || 0) + userEarnings
    });

    // Create transaction record
    await base44.asServiceRole.entities.Transaction.create({
      user_id: uid,
      amount: userEarnings,
      transaction_type: 'survey_completion',
      status: 'completed',
      description: `Survey completed (your share of $${reward.toFixed(2)} reward)`,
      payment_intent_id: surveyId
    });

    // Send in-app notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: uid,
      type: 'points_earned',
      title: '✅ Survey Completed!',
      message: `You earned $${userEarnings.toFixed(2)} from a survey. Keep going to reach your $3 daily goal!`,
      status: 'unread',
      delivery_method: ['in_app']
    });

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('BitLabs postback error:', error.message);
    return new Response('OK', { status: 200 }); // Always return OK to BitLabs
  }
});