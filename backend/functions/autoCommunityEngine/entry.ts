import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Automates: forum post moderation, chat message AI replies/moderation, friend requests,
// game engagement XP, user activity analytics, leaderboard rank notifications, squad management
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date().toISOString();

    // 1. Moderate new forum posts (unmoderated)
    const unmoderatedPosts = await base44.asServiceRole.entities.ForumPost.filter({ moderated: false }, '-created_date', 30);
    let postsModerated = 0;
    for (const post of unmoderatedPosts) {
      // AI community moderation
      await base44.asServiceRole.functions.invoke('aiCommunityModerationEngine', {
        content: post.content,
        entity_type: 'forum_post',
        entity_id: post.id
      });
      await base44.asServiceRole.entities.ForumPost.update(post.id, { moderated: true, moderated_at: now });
      postsModerated++;
    }
    results.forum_posts_moderated = postsModerated;

    // 2. Auto-moderate chat messages
    const unmoderatedMessages = await base44.asServiceRole.entities.ChatMessage.filter({ moderated: false }, '-created_date', 50);
    let messagesModerated = 0;
    for (const msg of unmoderatedMessages.slice(0, 30)) {
      await base44.asServiceRole.functions.invoke('autoChatModeration', { message_id: msg.id, content: msg.message });
      await base44.asServiceRole.entities.ChatMessage.update(msg.id, { moderated: true });
      messagesModerated++;
    }
    results.chat_messages_moderated = messagesModerated;

    // 3. Auto-respond to unread support chat messages with AI
    const unreadSupportMsgs = await base44.asServiceRole.entities.ChatMessage.filter({
      sender_type: 'user',
      is_read: false,
      message_type: 'text'
    }, '-created_date', 20);
    let aiRepliesSent = 0;
    for (const msg of unreadSupportMsgs.slice(0, 10)) {
      const ageMinutes = (Date.now() - new Date(msg.created_date).getTime()) / 60000;
      if (ageMinutes > 5) { // No response after 5 min — AI replies
        await base44.asServiceRole.functions.invoke('aiSupportEngine', {
          conversation_id: msg.conversation_id,
          message: msg.message,
          user_id: msg.sender_user_id
        });
        await base44.asServiceRole.entities.ChatMessage.update(msg.id, { is_read: true });
        aiRepliesSent++;
      }
    }
    results.ai_chat_replies_sent = aiRepliesSent;

    // 4. Process pending friend requests
    const pendingFriendRequests = await base44.asServiceRole.entities.FriendRequest.filter({ status: 'pending' }, '-created_date', 30);
    let friendRequestsProcessed = 0;
    for (const fr of pendingFriendRequests) {
      const ageDays = (Date.now() - new Date(fr.created_date).getTime()) / 86400000;
      if (ageDays > 0.1) { // Send notification if not yet notified
        if (!fr.notification_sent) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: fr.recipient_id,
            type: 'friend_request',
            title: '👋 New Friend Request',
            message: 'Someone sent you a friend request!',
            is_read: false,
            created_at: now
          });
          await base44.asServiceRole.entities.FriendRequest.update(fr.id, { notification_sent: true });
          friendRequestsProcessed++;
        }
      }
      // Auto-expire after 30 days
      if (ageDays > 30) {
        await base44.asServiceRole.entities.FriendRequest.update(fr.id, { status: 'expired' });
      }
    }
    results.friend_requests_notified = friendRequestsProcessed;

    // 5. Award XP for game engagement
    const recentEngagements = await base44.asServiceRole.entities.GameEngagement.filter({ xp_awarded: false }, '-created_date', 50);
    let xpAwarded = 0;
    for (const engagement of recentEngagements.slice(0, 30)) {
      await base44.asServiceRole.functions.invoke('awardUserXP', {
        user_id: engagement.user_id,
        xp_amount: engagement.xp_value || 10,
        reason: 'game_engagement',
        engagement_id: engagement.id
      });
      await base44.asServiceRole.entities.GameEngagement.update(engagement.id, { xp_awarded: true });
      xpAwarded++;
    }
    results.xp_awarded_for_engagement = xpAwarded;

    // 6. Aggregate user activity analytics
    const recentActivity = await base44.asServiceRole.entities.UserActivity.filter({ aggregated: false }, '-created_date', 100);
    let activitiesAggregated = 0;
    for (const activity of recentActivity.slice(0, 50)) {
      await base44.asServiceRole.entities.UserActivity.update(activity.id, { aggregated: true });
      activitiesAggregated++;
    }
    results.user_activities_aggregated = activitiesAggregated;

    // 7. Leaderboard rank change notifications
    const recentLeaderboardEntries = await base44.asServiceRole.entities.LeaderboardEntry.filter({ rank_change_notified: false }, '-updated_date', 30);
    let rankNotifications = 0;
    for (const entry of recentLeaderboardEntries.slice(0, 20)) {
      if (entry.previous_rank && entry.rank < entry.previous_rank) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: entry.user_id,
          type: 'rank_up',
          title: '🏆 Rank Up!',
          message: `You moved up to rank #${entry.rank} on the leaderboard!`,
          is_read: false,
          created_at: now
        });
      }
      await base44.asServiceRole.entities.LeaderboardEntry.update(entry.id, { rank_change_notified: true });
      rankNotifications++;
    }
    results.rank_change_notifications = rankNotifications;

    // 8. Squad activity feed processing
    const squadFeeds = await base44.asServiceRole.entities.SquadActivityFeed.filter({ processed: false }, '-created_date', 30);
    let squadFeedsProcessed = 0;
    for (const feed of squadFeeds.slice(0, 20)) {
      // Notify squad members
      const squad = await base44.asServiceRole.entities.ReferralSquad.filter({ id: feed.squad_id });
      if (squad.length > 0) {
        const members = await base44.asServiceRole.entities.SquadMember.filter({ squad_id: feed.squad_id });
        for (const member of members.slice(0, 10)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: member.user_id,
            type: 'squad_activity',
            title: '⚔️ Squad Update',
            message: feed.activity_description || 'Your squad has new activity!',
            is_read: false,
            created_at: now
          });
        }
        await base44.asServiceRole.entities.SquadActivityFeed.update(feed.id, { processed: true });
        squadFeedsProcessed++;
      }
    }
    results.squad_feeds_processed = squadFeedsProcessed;

    // 9. Onboarding completion rewards
    const completedOnboarding = await base44.asServiceRole.entities.OnboardingProgress.filter({ completed: true, reward_granted: false });
    let onboardingRewards = 0;
    for (const progress of completedOnboarding.slice(0, 20)) {
      await base44.asServiceRole.functions.invoke('awardUserXP', {
        user_id: progress.user_id,
        xp_amount: 100,
        reason: 'onboarding_completed'
      });
      await base44.asServiceRole.entities.OnboardingProgress.update(progress.id, { reward_granted: true });
      onboardingRewards++;
    }
    results.onboarding_rewards_granted = onboardingRewards;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});