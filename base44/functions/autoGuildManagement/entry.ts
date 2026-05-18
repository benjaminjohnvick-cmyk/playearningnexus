import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: guild challenges, leaderboards, rewards, inactive guild cleanup, member ranking
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Create weekly guild challenges if none exist for this week
    const activeChallenges = await base44.asServiceRole.entities.GuildChallenge.filter({ status: 'active' });
    if (activeChallenges.length < 3) {
      const challengeTemplates = [
        { title: 'Survey Sprint', description: 'Guild members complete 50 surveys combined', target: 50, type: 'surveys' },
        { title: 'Referral Rush', description: 'Get 10 new referrals as a guild', target: 10, type: 'referrals' },
        { title: 'Earnings Blitz', description: 'Earn $100 combined as a guild', target: 100, type: 'earnings' }
      ];
      for (const template of challengeTemplates.slice(0, 3 - activeChallenges.length)) {
        await base44.asServiceRole.entities.GuildChallenge.create({
          title: template.title,
          description: template.description,
          target_value: template.target,
          challenge_type: template.type,
          status: 'active',
          start_date: today,
          end_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          reward_type: 'points',
          reward_value: 500
        });
      }
      results.guild_challenges_created = 3 - activeChallenges.length;
    }

    // 2. Complete expired challenges and distribute rewards
    const expiredChallenges = await base44.asServiceRole.entities.GuildChallenge.filter({ status: 'active' });
    let challengesCompleted = 0;
    for (const challenge of expiredChallenges) {
      if (challenge.end_date && challenge.end_date < today) {
        await base44.asServiceRole.entities.GuildChallenge.update(challenge.id, { status: 'completed' });
        // Award guild reward
        if (challenge.guild_id) {
          await base44.asServiceRole.entities.GuildReward.create({
            guild_id: challenge.guild_id,
            challenge_id: challenge.id,
            reward_type: challenge.reward_type || 'points',
            reward_value: challenge.reward_value || 500,
            awarded_at: now
          });
        }
        challengesCompleted++;
      }
    }
    results.challenges_completed = challengesCompleted;

    // 3. Update guild rankings based on member earnings
    const guilds = await base44.asServiceRole.entities.Guild.list('-created_date', 50);
    let guildsRanked = 0;
    for (const guild of guilds) {
      const members = await base44.asServiceRole.entities.GuildMember.filter({ guild_id: guild.id });
      const totalPoints = members.reduce((sum, m) => sum + (m.contribution_points || 0), 0);
      await base44.asServiceRole.entities.Guild.update(guild.id, {
        total_points: totalPoints,
        member_count: members.length
      });
      guildsRanked++;
    }
    results.guilds_ranked = guildsRanked;

    // 4. Auto-create guilds if fewer than 5 exist
    if (guilds.length < 5) {
      const guildNames = ['Apex Earners', 'Survey Kings', 'Game Masters', 'Referral Legends', 'Daily Grinders'];
      for (let i = guilds.length; i < 5; i++) {
        await base44.asServiceRole.entities.Guild.create({
          name: guildNames[i],
          description: `Join ${guildNames[i]} and compete for top rewards!`,
          status: 'active',
          max_members: 50,
          is_public: true,
          created_at: now
        });
      }
      results.guilds_auto_created = 5 - guilds.length;
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});