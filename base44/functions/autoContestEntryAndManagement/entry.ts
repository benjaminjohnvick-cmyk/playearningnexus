import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Auto-enters all eligible users into active contests and manages contest lifecycle
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const activeContests = await base44.asServiceRole.entities.ReferralContest.filter({ status: 'active' });
    let enrolled = 0;
    let contestsCreated = 0;

    // Ensure there's always an active weekly contest
    if (activeContests.length === 0) {
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.ReferralContest.create({
        name: `GamerGain Weekly Referral Contest - Week of ${new Date().toLocaleDateString()}`,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: endDate,
        prize_pool: 1000,
        prize_distribution: [
          { place: 1, amount: 500 },
          { place: 2, amount: 250 },
          { place: 3, amount: 150 },
          { place: 4, amount: 75 },
          { place: 5, amount: 25 },
        ],
        auto_created: true,
      });
      contestsCreated++;
    }

    // Auto-enroll all users into all active contests
    const allContests = await base44.asServiceRole.entities.ReferralContest.filter({ status: 'active' });
    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);

    for (const contest of allContests) {
      for (const user of users) {
        const existing = await base44.asServiceRole.entities.ContestParticipation.filter({
          contest_id: contest.id,
          user_id: user.id,
        });
        if (existing.length > 0) continue;

        // Count their referrals for initial score
        const referrals = await base44.asServiceRole.entities.Referral.filter({ referrer_user_id: user.id });

        await base44.asServiceRole.entities.ContestParticipation.create({
          contest_id: contest.id,
          user_id: user.id,
          referral_count: referrals.length,
          joined_at: new Date().toISOString(),
          auto_enrolled: true,
        });
        enrolled++;
      }
    }

    return Response.json({ success: true, enrolled, contestsCreated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});