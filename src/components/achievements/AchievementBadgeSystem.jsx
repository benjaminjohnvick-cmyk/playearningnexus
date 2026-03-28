import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Lock, Trophy, Zap, Users, Star, Target, Flame, Shield, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export const ACHIEVEMENT_DEFINITIONS = [
  {
    key: 'first_survey',
    title: 'First Survey',
    description: 'Complete your first survey',
    icon: Star,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    tier: 1,
    category: 'surveys',
    check: (stats) => stats.surveysCompleted >= 1,
  },
  {
    key: 'surveys_10',
    title: '10 Surveys Done',
    description: 'Complete 10 surveys',
    icon: Trophy,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    tier: 2,
    category: 'surveys',
    check: (stats) => stats.surveysCompleted >= 10,
  },
  {
    key: 'surveys_50',
    title: 'Survey Veteran',
    description: 'Complete 50 surveys',
    icon: Trophy,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    tier: 3,
    category: 'surveys',
    check: (stats) => stats.surveysCompleted >= 50,
  },
  {
    key: 'first_referral',
    title: 'First Referral',
    description: 'Refer your first user',
    icon: Users,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    tier: 1,
    category: 'referrals',
    check: (stats) => stats.totalReferrals >= 1,
  },
  {
    key: 'referrals_5',
    title: 'Connector',
    description: 'Refer 5 users',
    icon: Users,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    tier: 2,
    category: 'referrals',
    check: (stats) => stats.totalReferrals >= 5,
  },
  {
    key: 'streak_master',
    title: 'Streak Master',
    description: '7-day earning streak',
    icon: Flame,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    tier: 2,
    category: 'streaks',
    check: (stats) => stats.streakDays >= 7,
  },
  {
    key: 'earner_10',
    title: 'First $10',
    description: 'Earn $10 total',
    icon: Zap,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    tier: 1,
    category: 'earnings',
    check: (stats) => stats.totalEarnings >= 10,
  },
  {
    key: 'earner_50',
    title: 'Half Century',
    description: 'Earn $50 total',
    icon: TrendingUp,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    tier: 2,
    category: 'earnings',
    check: (stats) => stats.totalEarnings >= 50,
  },
  {
    key: 'quality_star',
    title: 'Quality Star',
    description: 'Average quality score 85+',
    icon: Star,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    tier: 2,
    category: 'quality',
    check: (stats) => stats.avgQuality >= 85,
  },
  {
    key: 'loyal_member',
    title: 'Loyal Member',
    description: 'Member for 30+ days',
    icon: Shield,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    tier: 1,
    category: 'streaks',
    check: (stats) => stats.memberDays >= 30,
  },
  {
    key: 'goal_setter',
    title: 'Goal Setter',
    description: 'Hit your daily goal 5 times',
    icon: Target,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    tier: 2,
    category: 'surveys',
    check: (stats) => stats.daysGoalMet >= 5,
  },
  {
    key: 'centurion',
    title: 'Centurion',
    description: 'Earn $100 total',
    icon: Award,
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    tier: 3,
    category: 'earnings',
    check: (stats) => stats.totalEarnings >= 100,
  },
];

const TIER_LABELS = { 1: 'Bronze', 2: 'Silver', 3: 'Gold' };
const TIER_COLORS = {
  1: 'text-amber-700 bg-amber-100',
  2: 'text-slate-600 bg-slate-100',
  3: 'text-yellow-700 bg-yellow-100',
};

export function useAchievements(user, userStats) {
  const qc = useQueryClient();

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['user-achievements', user?.id],
    queryFn: () => base44.entities.UserAchievement.filter({ user_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const awardMutation = useMutation({
    mutationFn: ({ key }) => base44.entities.UserAchievement.create({
      user_id: user.id,
      achievement_key: key,
      earned_at: new Date().toISOString(),
      is_featured: false,
    }),
    onSuccess: (_, { key }) => {
      const def = ACHIEVEMENT_DEFINITIONS.find(d => d.key === key);
      qc.invalidateQueries(['user-achievements', user.id]);
      if (def) {
        toast.success(`🏆 Achievement Unlocked: ${def.title}!`, { duration: 5000 });
      }
    },
  });

  // Auto-award new achievements
  useEffect(() => {
    if (!user || !userStats || userAchievements === undefined) return;
    const earnedKeys = new Set(userAchievements.map(a => a.achievement_key));
    ACHIEVEMENT_DEFINITIONS.forEach(def => {
      if (!earnedKeys.has(def.key) && def.check(userStats)) {
        awardMutation.mutate({ key: def.key });
      }
    });
  }, [userStats?.surveysCompleted, userStats?.totalEarnings, userStats?.totalReferrals]);

  const earnedKeys = new Set(userAchievements.map(a => a.achievement_key));
  return {
    userAchievements,
    earnedKeys,
    earnedCount: earnedKeys.size,
    totalCount: ACHIEVEMENT_DEFINITIONS.length,
  };
}

export default function AchievementBadgeSystem({ user, userStats, compact = false }) {
  const { earnedKeys, earnedCount, totalCount } = useAchievements(user, userStats);

  const categories = [...new Set(ACHIEVEMENT_DEFINITIONS.map(d => d.category))];

  if (compact) {
    const earned = ACHIEVEMENT_DEFINITIONS.filter(d => earnedKeys.has(d.key)).slice(0, 6);
    return (
      <div className="flex flex-wrap gap-2">
        {earned.map(d => {
          const Icon = d.icon;
          return (
            <div key={d.key} title={d.title} className={`w-10 h-10 rounded-full flex items-center justify-center ${d.bg} border ${d.border}`}>
              <Icon className={`w-5 h-5 ${d.color}`} />
            </div>
          );
        })}
        {earnedCount > 6 && (
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 border border-gray-200 text-xs font-bold text-gray-600">
            +{earnedCount - 6}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            Achievements
          </CardTitle>
          <Badge className="bg-purple-600">{earnedCount}/{totalCount}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {categories.map(cat => {
          const catDefs = ACHIEVEMENT_DEFINITIONS.filter(d => d.category === cat);
          return (
            <div key={cat}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">{cat}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {catDefs.map(def => {
                  const earned = earnedKeys.has(def.key);
                  const Icon = def.icon;
                  return (
                    <motion.div
                      key={def.key}
                      initial={earned ? { scale: 0.8, opacity: 0 } : {}}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`relative flex flex-col items-center p-3 rounded-xl border text-center transition-all
                        ${earned ? `${def.bg} ${def.border}` : 'bg-gray-50 border-gray-100 opacity-50'}`}
                    >
                      {!earned && <Lock className="absolute top-2 right-2 w-3 h-3 text-gray-400" />}
                      <Icon className={`w-7 h-7 mb-1.5 ${earned ? def.color : 'text-gray-400'}`} />
                      <p className={`text-xs font-bold leading-tight ${earned ? def.color : 'text-gray-400'}`}>{def.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{def.description}</p>
                      {earned && (
                        <Badge className={`mt-1.5 text-xs py-0 ${TIER_COLORS[def.tier]}`}>
                          {TIER_LABELS[def.tier]}
                        </Badge>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}