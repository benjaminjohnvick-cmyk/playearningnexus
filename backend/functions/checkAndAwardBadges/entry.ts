import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id } = await req.json();
    if (!user_id) return Response.json({ error: 'Missing user_id' }, { status: 400 });

    const user = await base44.asServiceRole.entities.User.filter({ id: user_id }).then(r => r[0]);
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const badgesToAward = [];
    const badgeDefinitions = {
      survey_master: { threshold: 100, name: 'Survey Master', icon: 'BookOpen', color: '#3b82f6', rarity: 'epic' },
      referral_legend: { threshold: 50, name: 'Referral Legend', icon: 'Users', color: '#8b5cf6', rarity: 'legendary' },
      high_earner: { threshold: 500, name: 'High Earner', icon: 'DollarSign', color: '#10b981', rarity: 'epic' },
      first_payout: { threshold: 10, name: 'First Payout', icon: 'Gift', color: '#f59e0b', rarity: 'uncommon' },
      early_bird: { threshold: 7, name: 'Early Bird', icon: 'Sunrise', color: '#f97316', rarity: 'rare' },
      consistency_king: { threshold: 30, name: 'Consistency King', icon: 'TrendingUp', color: '#06b6d4', rarity: 'epic' },
      quality_champion: { threshold: 0.85, name: 'Quality Champion', icon: 'Star', color: '#ec4899', rarity: 'rare' },
      viral_star: { threshold: 100, name: 'Viral Star', icon: 'Zap', color: '#eab308', rarity: 'legendary' },
      trusted_member: { threshold: 80, name: 'Trusted Member', icon: 'Shield', color: '#6366f1', rarity: 'uncommon' },
    };

    // Check each badge criteria
    if (user.surveys_completed >= badgeDefinitions.survey_master.threshold) {
      badgesToAward.push({ key: 'survey_master', data: badgeDefinitions.survey_master });
    }
    if (user.total_referrals >= badgeDefinitions.referral_legend.threshold) {
      badgesToAward.push({ key: 'referral_legend', data: badgeDefinitions.referral_legend });
    }
    if (user.total_earnings >= badgeDefinitions.high_earner.threshold) {
      badgesToAward.push({ key: 'high_earner', data: badgeDefinitions.high_earner });
    }
    if (user.total_earnings >= 10) {
      badgesToAward.push({ key: 'first_payout', data: badgeDefinitions.first_payout });
    }
    if (user.account_age_days <= 7) {
      badgesToAward.push({ key: 'early_bird', data: badgeDefinitions.early_bird });
    }
    if (user.daily_active_streak >= 30) {
      badgesToAward.push({ key: 'consistency_king', data: badgeDefinitions.consistency_king });
    }
    if (user.total_referrals >= 100) {
      badgesToAward.push({ key: 'viral_star', data: badgeDefinitions.viral_star });
    }
    if (user.trust_score >= 80) {
      badgesToAward.push({ key: 'trusted_member', data: badgeDefinitions.trusted_member });
    }

    const created = [];
    for (const badge of badgesToAward) {
      // Check if user already has badge
      const existing = await base44.asServiceRole.entities.UserAchievementBadge.filter({
        user_id,
        badge_key: badge.key,
      });

      if (existing.length === 0) {
        const newBadge = await base44.asServiceRole.entities.UserAchievementBadge.create({
          user_id,
          badge_key: badge.key,
          badge_name: badge.data.name,
          badge_icon: badge.data.icon,
          badge_color: badge.data.color,
          rarity: badge.data.rarity,
          unlocked_at: new Date().toISOString(),
          is_featured: badge.data.rarity === 'legendary' || badge.data.rarity === 'epic',
        });
        created.push(newBadge);
      }
    }

    return Response.json({
      success: true,
      user_id,
      badges_awarded: created.length,
      badges: created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});