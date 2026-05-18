import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Scheduled daily: transition season statuses and recalculate SeasonRank scores
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const results = [];

    // Activate upcoming seasons whose start time has passed
    const upcoming = await base44.asServiceRole.entities.Season.filter({ status: 'upcoming' });
    for (const s of upcoming) {
      if (s.starts_at && new Date(s.starts_at) <= now) {
        await base44.asServiceRole.entities.Season.update(s.id, { status: 'active' });
        // Broadcast season start to all users
        const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
        for (const u of users) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: u.id,
            type: 'season_started',
            title: `🏁 ${s.name} Has Begun!`,
            message: `A new competitive season is live! Earn surveys, referrals, and XP to climb the leaderboard and win exclusive rewards.`,
            is_read: false
          });
        }
        results.push(`activated_season_${s.season_number}`);
      }
    }

    // Complete active seasons whose end time has passed
    const active = await base44.asServiceRole.entities.Season.filter({ status: 'active' });
    for (const s of active) {
      if (s.ends_at && new Date(s.ends_at) <= now) {
        await base44.asServiceRole.entities.Season.update(s.id, { status: 'completed' });
        results.push(`completed_season_${s.season_number}`);
      }
    }

    // Recalculate SeasonRank scores for all active season participants
    const activeSeason = (await base44.asServiceRole.entities.Season.filter({ status: 'active' }))[0];
    if (activeSeason) {
      const ranks = await base44.asServiceRole.entities.SeasonRank.filter({ season_id: activeSeason.id });
      const scored = ranks.map(r => ({
        ...r,
        computed_score: (r.earnings || 0) * 10 + (r.surveys_completed || 0) * 5 + (r.referrals || 0) * 20
      })).sort((a, b) => b.computed_score - a.computed_score);

      for (let i = 0; i < scored.length; i++) {
        const r = scored[i];
        const newRank = i + 1;
        if (r.score !== r.computed_score || r.rank !== newRank) {
          await base44.asServiceRole.entities.SeasonRank.update(r.id, {
            score: r.computed_score,
            rank: newRank
          });
          // Notify on top-10 entry
          if (newRank <= 10 && (r.rank > 10 || !r.rank)) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: r.user_id,
              type: 'season_top10',
              title: `🏆 You're in the Season Top 10! Rank #${newRank}`,
              message: `You've climbed into the Top 10 for ${activeSeason.name}! Keep earning to stay there and win season rewards.`,
              is_read: false
            });
          }
        }
      }
      results.push('season_ranks_recalculated');
    }

    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});