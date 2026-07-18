import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Credits a user's pending $0.10 referral-post rewards. Called when a user
// completes a survey (the reward is "held until the next survey"). Accepts an
// explicit { user_id } (for server-side calls) or uses the authenticated user.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    let userId = body.user_id;
    // grace_days: fairness path — auto-credit rewards that have been pending too long,
    // so a user never forfeits money they earned just because they stopped taking surveys.
    const graceDays = body.grace_days;

    let pending: any[] = [];
    if (userId) {
      // Survey-completion path: release this user's pending rewards.
      pending = await base44.asServiceRole.entities.ReferralPostEntry.filter({
        user_id: userId, reward_pending: true, reward_credited: false,
      }, '-created_date', 500);
    } else if (graceDays) {
      // Grace-period sweep across all users.
      const cutoff = Date.now() - graceDays * 24 * 60 * 60 * 1000;
      const all = await base44.asServiceRole.entities.ReferralPostEntry.filter({
        reward_pending: true, reward_credited: false,
      }, '-created_date', 2000);
      pending = all.filter((e: any) => e.created_date && new Date(e.created_date).getTime() < cutoff);
    } else {
      const me = await base44.auth.me().catch(() => null);
      userId = me?.id;
      if (!userId) return Response.json({ error: 'user_id or grace_days required' }, { status: 400 });
      pending = await base44.asServiceRole.entities.ReferralPostEntry.filter({
        user_id: userId, reward_pending: true, reward_credited: false,
      }, '-created_date', 500);
    }

    if (pending.length === 0) {
      return Response.json({ success: true, credited_count: 0, credited_amount: 0 });
    }

    let creditedAmount = 0;
    let creditedCount = 0;
    for (const entry of pending) {
      const amount = entry.reward_amount || 0.1;
      const creditUserId = entry.user_id || userId; // grace sweep credits each entry's own user
      try {
        await base44.asServiceRole.entities.Transaction.create({
          user_id: creditUserId,
          amount,
          currency: 'USD',
          transaction_type: 'survey_earning',
          status: 'completed',
          notes: `Referral post bonus (${entry.platform}, week ${entry.week_of})`,
        });
        await base44.asServiceRole.entities.ReferralPostEntry.update(entry.id, {
          reward_pending: false,
          reward_credited: true,
          reward_credited_at: new Date().toISOString(),
        });
        creditedAmount += amount;
        creditedCount++;
      } catch { /* skip and continue */ }
    }

    return Response.json({ success: true, credited_count: creditedCount, credited_amount: Number(creditedAmount.toFixed(2)) });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to credit rewards' }, { status: 500 });
  }
});
