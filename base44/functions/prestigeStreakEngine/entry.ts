import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'check', target_user_id } = body;

    // Service role for reading user activity
    const userId = target_user_id || user.id;

    // Fetch user activity data
    const [activities, currentUser, existingStreak, existingBadges] = await Promise.all([
      base44.asServiceRole.entities.UserActivity.filter({ user_id: userId }, '-created_date', 30).catch(() => []),
      base44.asServiceRole.entities.User.get(userId).catch(() => null),
      base44.asServiceRole.entities.Streak.filter({ user_id: userId }).catch(() => []),
      base44.asServiceRole.entities.UserBadge.filter({ user_id: userId }).catch(() => []),
    ]);

    const streak = existingStreak?.[0];

    // Calculate current streak from activities
    const today = new Date().toISOString().split('T')[0];
    const activityDates = [...new Set(activities.map(a => new Date(a.created_date).toISOString().split('T')[0]))].sort().reverse();

    let currentStreakCount = 0;
    let checkDate = new Date();
    for (let i = 0; i < 60; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (activityDates.includes(dateStr)) {
        currentStreakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i > 0) {
        break; // streak broken
      } else {
        checkDate.setDate(checkDate.getDate() - 1); // allow today to be missing
      }
    }

    // Prestige badge tiers
    const PRESTIGE_TIERS = [
      { days: 3, badge: 'Bronze Streak', revenue_share_bonus: 1, color: 'bronze' },
      { days: 7, badge: 'Silver Streak', revenue_share_bonus: 2, color: 'silver' },
      { days: 14, badge: 'Gold Streak', revenue_share_bonus: 3, color: 'gold' },
      { days: 30, badge: 'Platinum Streak', revenue_share_bonus: 5, color: 'platinum' },
      { days: 60, badge: 'Diamond Streak', revenue_share_bonus: 8, color: 'diamond' },
      { days: 100, badge: 'Legendary Streak', revenue_share_bonus: 12, color: 'legendary' },
    ];

    const earnedTier = [...PRESTIGE_TIERS].reverse().find(t => currentStreakCount >= t.days);
    const nextTier = PRESTIGE_TIERS.find(t => currentStreakCount < t.days);
    const daysToNextTier = nextTier ? nextTier.days - currentStreakCount : 0;

    // Check if streak is at risk (no activity today)
    const hasActivityToday = activityDates[0] === today;
    const isAtRisk = !hasActivityToday && currentStreakCount > 0;

    // Award new badge if earned
    let badgeAwarded = null;
    if (earnedTier && action === 'check') {
      const alreadyHas = existingBadges.some(b => b.badge_name === earnedTier.badge);
      if (!alreadyHas) {
        await base44.asServiceRole.entities.UserBadge.create({
          user_id: userId,
          badge_name: earnedTier.badge,
          badge_type: 'prestige_streak',
          color: earnedTier.color,
          revenue_share_bonus: earnedTier.revenue_share_bonus,
          streak_days_at_award: currentStreakCount,
          awarded_at: new Date().toISOString(),
        }).catch(() => {});
        badgeAwarded = earnedTier;

        // Update user's revenue share bonus
        const currentBonus = currentUser?.revenue_share_bonus || 0;
        if (earnedTier.revenue_share_bonus > currentBonus) {
          await base44.asServiceRole.entities.User.update(userId, {
            revenue_share_bonus: earnedTier.revenue_share_bonus,
            prestige_badge: earnedTier.badge,
          }).catch(() => {});
        }
      }
    }

    // Update streak record
    if (streak) {
      await base44.asServiceRole.entities.Streak.update(streak.id, {
        current_streak: currentStreakCount,
        last_activity_date: activityDates[0] || null,
        longest_streak: Math.max(streak.longest_streak || 0, currentStreakCount),
      }).catch(() => {});
    } else {
      await base44.asServiceRole.entities.Streak.create({
        user_id: userId,
        current_streak: currentStreakCount,
        last_activity_date: activityDates[0] || null,
        longest_streak: currentStreakCount,
      }).catch(() => {});
    }

    // Trigger re-engagement email/push if at risk
    let reengagementSent = false;
    if (isAtRisk && currentStreakCount >= 3) {
      await base44.integrations.Core.SendEmail({
        to: currentUser?.email || user.email,
        subject: `⚠️ Your ${currentStreakCount}-day streak is about to break!`,
        body: `Hey ${currentUser?.full_name || 'there'}! 👋

You're about to lose your ${currentStreakCount}-day activity streak on GamerGain!

Your current badge: ${earnedTier?.badge || 'Building your first badge...'}
Revenue share bonus at stake: +${earnedTier?.revenue_share_bonus || 0}%

Log in NOW to keep your streak alive → https://gamergain.app

${nextTier ? `Just ${daysToNextTier} more days to earn the ${nextTier.badge} badge!` : 'You\'re a legend — keep going!'}

GamerGain Team`,
      }).catch(() => {});

      await base44.asServiceRole.entities.Notification.create({
        user_id: userId,
        type: 'streak_at_risk',
        title: `⚠️ ${currentStreakCount}-day streak at risk!`,
        message: `Log in today to keep your streak and ${earnedTier?.badge || 'streak badge'}. Revenue bonus: +${earnedTier?.revenue_share_bonus || 0}%`,
        is_read: false,
      }).catch(() => {});

      reengagementSent = true;
    }

    return Response.json({
      success: true,
      user_id: userId,
      current_streak: currentStreakCount,
      has_activity_today: hasActivityToday,
      is_at_risk: isAtRisk,
      earned_badge: earnedTier || null,
      badge_just_awarded: badgeAwarded,
      next_badge: nextTier || null,
      days_to_next_badge: daysToNextTier,
      revenue_share_bonus: earnedTier?.revenue_share_bonus || 0,
      reengagement_sent: reengagementSent,
      all_badges: existingBadges,
      prestige_tiers: PRESTIGE_TIERS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});