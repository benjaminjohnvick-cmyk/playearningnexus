import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.entity_name === 'Guild' && event?.type === 'create') {
      const guild = data;
      // Notify guild founder
      if (guild.owner_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: guild.owner_id,
          type: 'guild_created',
          title: `⚔️ Guild "${guild.name}" Created!`,
          message: `Your guild "${guild.name}" is live! Invite friends to join and start completing guild challenges together.`,
          is_read: false
        });
      }
    }

    if (event?.entity_name === 'GuildMember' && event?.type === 'create') {
      const member = data;
      if (!member?.guild_id) return Response.json({ ok: true });

      const guild = (await base44.asServiceRole.entities.Guild.filter({ id: member.guild_id }))[0];
      const user = member.user_id ? (await base44.asServiceRole.entities.User.filter({ id: member.user_id }))[0] : null;

      // Welcome new member
      if (member.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: member.user_id,
          type: 'guild_joined',
          title: `⚔️ Joined Guild: ${guild?.name || 'Guild'}!`,
          message: `Welcome to "${guild?.name || 'the guild'}"! Work together on challenges to earn exclusive guild rewards.`,
          is_read: false
        });
      }

      // Notify guild owner of new member
      if (guild?.owner_id && guild.owner_id !== member.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: guild.owner_id,
          type: 'guild_new_member',
          title: `👥 New Guild Member!`,
          message: `${user?.full_name || 'A player'} joined "${guild.name}"! Your guild is growing.`,
          is_read: false
        });
      }

      // Update member count
      const allMembers = await base44.asServiceRole.entities.GuildMember.filter({ guild_id: member.guild_id });
      await base44.asServiceRole.entities.Guild.update(member.guild_id, {
        member_count: allMembers.length
      });

      // Award XP for joining a guild
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: member.user_id,
        activity_type: 'guild_join',
        points_earned: 25,
        metadata: { guild_id: member.guild_id }
      });
    }

    if (event?.entity_name === 'GuildReward' && event?.type === 'create') {
      const reward = data;
      // Notify all guild members of new reward
      if (reward.guild_id) {
        const members = await base44.asServiceRole.entities.GuildMember.filter({ guild_id: reward.guild_id });
        for (const member of members.slice(0, 20)) {
          if (member.user_id) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: member.user_id,
              type: 'guild_reward_available',
              title: `🏆 New Guild Reward Available!`,
              message: `Your guild earned "${reward.reward_name || 'a reward'}"! Check the guild page to claim it.`,
              is_read: false
            });
          }
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});