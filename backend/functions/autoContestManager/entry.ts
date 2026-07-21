import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This runs as a scheduled function — service role only
    const now = new Date();

    // 1. Auto-close expired contests
    const activeContests = await base44.asServiceRole.entities.ReferralContest.filter({ status: 'active' });
    let closed = 0;
    let winners = 0;

    for (const contest of activeContests) {
      if (!contest.end_date) continue;
      const endDate = new Date(contest.end_date);
      if (now < endDate) continue;

      // Determine winner via AI analysis
      const participants = await base44.asServiceRole.entities.ContestParticipation.filter({ contest_id: contest.id });
      if (participants.length > 0) {
        // Sort by score/referrals
        const sorted = participants.sort((a, b) => (b.referral_count || 0) - (a.referral_count || 0));
        const winnerId = sorted[0]?.user_id;

        if (winnerId) {
          // Award prize
          await base44.asServiceRole.entities.Payout.create({
            user_id: winnerId,
            recipient_type: 'user',
            recipient_id: winnerId,
            amount: contest.prize_pool || 100,
            currency: 'USD',
            method: 'paypal',
            payout_type: 'contest_win',
            status: 'pending',
            description: `Contest winner: ${contest.title || 'Referral Contest'}`,
          });
          winners++;
        }
      }

      await base44.asServiceRole.entities.ReferralContest.update(contest.id, { status: 'completed' });
      closed++;
    }

    // 2. Auto-create a new weekly contest if none active
    const remaining = await base44.asServiceRole.entities.ReferralContest.filter({ status: 'active' });
    let newContest = null;

    if (remaining.length === 0) {
      const aiContest = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate a weekly referral contest for GamerGain (gaming rewards platform). 
Make the title catchy and the rules simple — most referrals wins. 
Return JSON: { "title": "string", "description": "string", "prize_pool": number, "rules": "string" }`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            prize_pool: { type: 'number' },
            rules: { type: 'string' },
          },
        },
      });

      newContest = await base44.asServiceRole.entities.ReferralContest.create({
        title: aiContest.title,
        description: aiContest.description,
        prize_pool: aiContest.prize_pool || 500,
        rules: aiContest.rules,
        status: 'active',
        start_date: now.toISOString(),
        end_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        contest_type: 'referral',
      });
    }

    return Response.json({ ok: true, closed_contests: closed, winners_paid: winners, new_contest: newContest?.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});