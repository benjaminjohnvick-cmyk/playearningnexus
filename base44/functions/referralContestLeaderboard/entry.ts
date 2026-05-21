import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, contestId } = body;

    // Scheduled automation path — update all active contest leaderboards
    if (!action) {
      const activeContests = await base44.asServiceRole.entities.ReferralContest.filter({ status: 'active' });
      let updated = 0;
      for (const contest of activeContests) {
        // Recalculate leaderboard from referral data
        const referrals = await base44.asServiceRole.entities.Referral.filter({ contest_id: contest.id });
        const totals = {};
        for (const r of referrals) {
          totals[r.referrer_user_id] = (totals[r.referrer_user_id] || 0) + 1;
        }
        const sorted = Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([user_id, count], i) => ({ rank: i + 1, user_id, referral_count: count }));

        await base44.asServiceRole.entities.ReferralContest.update(contest.id, {
          weekly_top_10: sorted,
          last_leaderboard_update: new Date().toISOString()
        });
        updated++;
      }
      return Response.json({ success: true, contests_updated: updated });
    }

    if (action === 'getWeeklyLeaderboard') {
      // Get referral contest
      const contests = await base44.asServiceRole.entities.ReferralContest.filter({
        id: contestId
      });

      if (!contests.length) {
        return Response.json({ error: 'Contest not found' }, { status: 404 });
      }

      const contest = contests[0];
      const leaderboard = contest.weekly_top_10 || [];

      return Response.json({
        success: true,
        contest,
        leaderboard,
        total_referrals: contest.total_referrals,
        conversions: contest.conversions,
        prize_pool: contest.prize_pool
      });
    }

    if (action === 'distributePrizes') {
      // Admin/creator only — requires authenticated user
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const contests = await base44.asServiceRole.entities.ReferralContest.filter({
        id: contestId
      });

      if (!contests.length) {
        return Response.json({ error: 'Contest not found' }, { status: 404 });
      }

      const contest = contests[0];

      if (contest.creator_user_id !== user.id) {
        return Response.json({ error: 'Only contest creator can distribute prizes' }, { status: 403 });
      }

      const leaderboard = contest.weekly_top_10 || [];
      const prizeStructure = [
        { rank: 1, percentage: 40 },
        { rank: 2, percentage: 20 },
        { rank: 3, percentage: 15 },
        { rank: 4, percentage: 10 },
        { rank: 5, percentage: 7 },
        { rank: 6, percentage: 4 },
        { rank: 7, percentage: 2 },
        { rank: 8, percentage: 1 },
        { rank: 9, percentage: 0.5 },
        { rank: 10, percentage: 0.5 }
      ];

      const distributions = [];
      for (const entry of leaderboard.slice(0, 10)) {
        const prizeInfo = prizeStructure[entry.rank - 1];
        const prizeAmount = (contest.prize_pool * prizeInfo.percentage) / 100;

        distributions.push({
          rank: entry.rank,
          user_id: entry.user_id,
          amount: prizeAmount,
          status: 'pending'
        });
      }

      // Mark prizes as distributed
      await base44.asServiceRole.entities.ReferralContest.update(contest.id, {
        prizes_distributed: true
      });

      return Response.json({
        success: true,
        message: 'Prizes distributed to top 10 referrers',
        distributions,
        total_distributed: distributions.reduce((sum, d) => sum + d.amount, 0)
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in referralContestLeaderboard:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});