import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: season creation, rank assignment, rollover, rewards distribution, leaderboard reset
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // 1. Check if current season has ended
    const activeSeasons = await base44.asServiceRole.entities.Season.filter({ status: 'active' });
    
    if (activeSeasons.length === 0) {
      // Create new season
      const seasonNumber = await base44.asServiceRole.entities.Season.list('-created_date', 1);
      const nextNum = (seasonNumber[0]?.season_number || 0) + 1;
      const endDate = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]; // 30-day season
      
      await base44.asServiceRole.entities.Season.create({
        season_number: nextNum,
        name: `Season ${nextNum}`,
        status: 'active',
        start_date: today,
        end_date: endDate,
        prize_pool: 1000,
        description: `Compete in Season ${nextNum} for top prizes!`
      });
      results.new_season_created = `Season ${nextNum}`;
    } else {
      const currentSeason = activeSeasons[0];
      
      // Check if season should end
      if (currentSeason.end_date && currentSeason.end_date < today) {
        // End season and distribute rewards
        await base44.asServiceRole.entities.Season.update(currentSeason.id, { status: 'completed' });
        
        // Get top ranked users and award season rewards
        const topRanks = await base44.asServiceRole.entities.SeasonRank.filter(
          { season_id: currentSeason.id }, '-rank_score', 10
        );
        
        const prizeStructure = [500, 250, 100, 50, 25, 15, 10, 10, 10, 10];
        for (let i = 0; i < Math.min(topRanks.length, 10); i++) {
          const rank = topRanks[i];
          await base44.asServiceRole.entities.Payout.create({
            user_id: rank.user_id,
            amount: prizeStructure[i],
            payout_type: 'contest_win',
            description: `Season ${currentSeason.season_number} Rank #${i + 1} Prize`,
            status: 'pending'
          });
        }
        
        results.season_ended = currentSeason.name;
        results.prizes_queued = Math.min(topRanks.length, 10);
      } else {
        // Update season ranks for all users
        const users = await base44.asServiceRole.entities.User.list('-total_earnings', 100);
        let ranksUpdated = 0;
        for (const u of users) {
          const existing = await base44.asServiceRole.entities.SeasonRank.filter({
            season_id: currentSeason.id,
            user_id: u.id
          });
          const rankScore = (u.total_earnings || 0) + (u.points || 0) * 0.1;
          
          if (existing.length > 0) {
            await base44.asServiceRole.entities.SeasonRank.update(existing[0].id, { rank_score: rankScore });
          } else {
            await base44.asServiceRole.entities.SeasonRank.create({
              season_id: currentSeason.id,
              user_id: u.id,
              rank_score: rankScore,
              joined_at: now.toISOString()
            });
          }
          ranksUpdated++;
        }
        results.season_ranks_updated = ranksUpdated;
        results.current_season = currentSeason.name;
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});