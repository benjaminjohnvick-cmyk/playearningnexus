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

    // 1. Create weekly guild challenges — need at least one guild to attach them to
    const allGuildsForChallenges = await base44.asServiceRole.entities.Guild.filter({ status: 'active' });
    const activeChallenges = await base44.asServiceRole.entities.GuildChallenge.filter({ status: 'active' });
    if (activeChallenges.length < 3 && allGuildsForChallenges.length > 0) {
      const challengeTemplates = [
        { challenge_name: 'Survey Sprint', description: 'Guild members complete 50 surveys combined', target_amount: 50, challenge_type: 'survey_sprint', target_metric: 'surveys_completed' },
        { challenge_name: 'Referral Rush', description: 'Get 10 new referrals as a guild', target_amount: 10, challenge_type: 'referral_push', target_metric: 'referrals_made' },
        { challenge_name: 'Earnings Blitz', description: 'Earn $100 combined as a guild', target_amount: 100, challenge_type: 'earning_battle', target_metric: 'total_earnings' }
      ];
      for (const template of challengeTemplates.slice(0, 3 - activeChallenges.length)) {
        // Assign challenge to the first active guild (global challenges apply to all guilds)
        const guild = allGuildsForChallenges[0];
        await base44.asServiceRole.entities.GuildChallenge.create({
          guild_id: guild.id,
          challenge_name: template.challenge_name,
          description: template.description,
          target_amount: template.target_amount,
          target_metric: template.target_metric,
          challenge_type: template.challenge_type,
          status: 'active',
          duration_days: 7,
          reward_pool: 500,
          starts_at: now,
          ends_at: new Date(Date.now() + 7 * 86400000).toISOString()
        });
      }
      results.guild_challenges_created = 3 - activeChallenges.length;
    }

    // 2. Complete expired challenges and distribute rewards
    const expiredChallenges = await base44.asServiceRole.entities.GuildChallenge.filter({ status: 'active' });
    let challengesCompleted = 0;
    for (const challenge of expiredChallenges) {
      if (challenge.ends_at && challenge.ends_at < now) {
        await base44.asServiceRole.entities.GuildChallenge.update(challenge.id, { status: 'completed', completed_at: now });
        // Award top member of the guild a reward
        if (challenge.guild_id) {
          const guildMembers = await base44.asServiceRole.entities.GuildMember.filter({ guild_id: challenge.guild_id });
          const topMember = guildMembers.sort((a, b) => (b.contribution_points || 0) - (a.contribution_points || 0))[0];
          if (topMember?.user_id) {
            await base44.asServiceRole.entities.GuildReward.create({
              guild_id: challenge.guild_id,
              challenge_id: challenge.id,
              user_id: topMember.user_id,
              user_name: topMember.user_name || 'Member',
              reward_type: 'cash',
              reward_amount: challenge.reward_pool || 500,
              status: 'pending',
              awarded_at: now
            });
          }
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