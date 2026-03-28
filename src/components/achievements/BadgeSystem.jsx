import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useEffect } from 'react';

export const BADGE_DEFINITIONS = [
  {
    key: 'first_survey',
    label: 'First Step',
    emoji: '🎯',
    description: 'Complete your first survey',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    check: (stats) => stats.surveysCompleted >= 1,
  },
  {
    key: 'survey_pro',
    label: 'Survey Pro',
    emoji: '⭐',
    description: 'Complete 50 surveys',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    check: (stats) => stats.surveysCompleted >= 50,
  },
  {
    key: 'survey_legend',
    label: 'Survey Legend',
    emoji: '🏆',
    description: 'Complete 200 surveys',
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    check: (stats) => stats.surveysCompleted >= 200,
  },
  {
    key: 'speedster',
    label: 'Speedster',
    emoji: '⚡',
    description: 'Complete 5 surveys in under 30 seconds each',
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    check: (stats) => stats.fastCompletions >= 5,
  },
  {
    key: 'accuracy_king',
    label: 'Accuracy King',
    emoji: '🎖️',
    description: 'Maintain 90+ quality score across 20 surveys',
    color: 'bg-green-100 text-green-700 border-green-300',
    check: (stats) => stats.avgQuality >= 90 && stats.surveysCompleted >= 20,
  },
  {
    key: 'referral_starter',
    label: 'Connector',
    emoji: '🤝',
    description: 'Refer your first user',
    color: 'bg-teal-100 text-teal-700 border-teal-300',
    check: (stats) => stats.totalReferrals >= 1,
  },
  {
    key: 'referral_master',
    label: 'Referral Master',
    emoji: '👑',
    description: 'Have 10+ active referrals',
    color: 'bg-red-100 text-red-700 border-red-300',
    check: (stats) => stats.activeReferrals >= 10,
  },
  {
    key: 'referral_legend',
    label: 'Referral Legend',
    emoji: '💎',
    description: 'Have 25+ active referrals',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    check: (stats) => stats.activeReferrals >= 25,
  },
  {
    key: 'streak_7',
    label: '7-Day Streak',
    emoji: '🔥',
    description: 'Complete surveys 7 days in a row',
    color: 'bg-rose-100 text-rose-700 border-rose-300',
    check: (stats) => stats.streakDays >= 7,
  },
  {
    key: 'streak_30',
    label: 'Monthly Warrior',
    emoji: '🌟',
    description: 'Complete surveys 30 days in a row',
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    check: (stats) => stats.streakDays >= 30,
  },
  {
    key: 'top_earner',
    label: 'Top Earner',
    emoji: '💰',
    description: 'Earn $100+ total',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    check: (stats) => stats.totalEarnings >= 100,
  },
  {
    key: 'loyal_member',
    label: 'Loyal Member',
    emoji: '🛡️',
    description: 'Be a member for 30+ days',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    check: (stats) => stats.memberDays >= 30,
  },
  {
    key: 'quality_champion',
    label: 'Quality Champion',
    emoji: '✨',
    description: 'Complete 50 surveys with 85+ quality score',
    color: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    check: (stats) => stats.highQualityCompletions >= 50,
  },
];

// Hook to check and award badges automatically
export function useBadgeAwarder(user, stats) {
  const qc = useQueryClient();

  const { data: earnedBadges = [] } = useQuery({
    queryKey: ['user_badges', user?.id],
    queryFn: () => base44.entities.Badge.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id || !stats || earnedBadges.length === 0 && !stats.surveysCompleted) return;

    const earnedKeys = new Set(earnedBadges.map(b => b.badge_key));

    const toAward = BADGE_DEFINITIONS.filter(def => {
      if (earnedKeys.has(def.key)) return false;
      return def.check(stats);
    });

    if (toAward.length === 0) return;

    toAward.forEach(async (def) => {
      await base44.entities.Badge.create({
        user_id: user.id,
        badge_key: def.key,
        earned_at: new Date().toISOString(),
      });
      toast.success(`🏅 Badge Unlocked: ${def.label}!`, { description: def.description });
      qc.invalidateQueries({ queryKey: ['user_badges', user.id] });
    });
  }, [user?.id, stats?.surveysCompleted, stats?.totalReferrals, stats?.totalEarnings]);

  return { earnedBadges };
}

// Display component for badges on profile / referral dashboard
export function BadgeDisplay({ userId, compact = false, maxShow = null }) {
  const { data: earnedBadges = [] } = useQuery({
    queryKey: ['user_badges', userId],
    queryFn: () => base44.entities.Badge.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const earnedKeys = new Set(earnedBadges.map(b => b.badge_key));
  const earned = BADGE_DEFINITIONS.filter(d => earnedKeys.has(d.key));
  const displayed = maxShow ? earned.slice(0, maxShow) : earned;

  if (earned.length === 0) {
    return compact ? null : (
      <p className="text-sm text-gray-400 text-center py-4">No badges earned yet — complete surveys to unlock!</p>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {displayed.map(def => (
          <span key={def.key} title={`${def.label}: ${def.description}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${def.color}`}>
            {def.emoji} {def.label}
          </span>
        ))}
        {maxShow && earned.length > maxShow && (
          <span className="text-xs text-gray-400 self-center">+{earned.length - maxShow} more</span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {BADGE_DEFINITIONS.map(def => {
        const isEarned = earnedKeys.has(def.key);
        return (
          <div key={def.key}
            className={`rounded-xl border-2 p-3 text-center transition-all ${isEarned ? def.color + ' border-current shadow-sm' : 'bg-gray-50 border-gray-200 opacity-40'}`}>
            <div className="text-3xl mb-1">{def.emoji}</div>
            <p className="text-xs font-bold">{def.label}</p>
            <p className="text-xs opacity-70 mt-0.5">{def.description}</p>
            {isEarned && <p className="text-xs font-semibold mt-1 opacity-80">✓ Earned</p>}
          </div>
        );
      })}
    </div>
  );
}

export default BadgeDisplay;