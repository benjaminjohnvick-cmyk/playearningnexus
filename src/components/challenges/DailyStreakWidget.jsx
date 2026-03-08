import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Flame, Star, Zap, Trophy, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { format, subDays, parseISO, isToday, isYesterday } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const STREAK_REWARDS = [
  { days: 3,  xp: 50,  bonusPct: 5,  label: '3-Day',  color: 'from-orange-400 to-amber-500',   icon: '🔥' },
  { days: 7,  xp: 150, bonusPct: 10, label: '7-Day',  color: 'from-purple-500 to-pink-500',    icon: '⚡' },
  { days: 30, xp: 750, bonusPct: 25, label: '30-Day', color: 'from-yellow-400 to-orange-500',   icon: '👑' },
];

// Last 7 days dot indicators
function StreakDots({ dailyEarnings }) {
  const dots = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const active = dailyEarnings.some(e => e.date === date && e.total_surveys_completed > 0);
    const isNow = i === 6;
    return { date, active, isNow };
  });

  return (
    <div className="flex items-center gap-1.5">
      {dots.map((dot, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            dot.active
              ? 'bg-orange-500 shadow-md shadow-orange-200'
              : dot.isNow
              ? 'bg-orange-100 border-2 border-orange-300 border-dashed'
              : 'bg-gray-100'
          }`}>
            {dot.active
              ? <Flame className="w-3.5 h-3.5 text-white" />
              : dot.isNow
              ? <Zap className="w-3 h-3 text-orange-400" />
              : <div className="w-2 h-2 rounded-full bg-gray-300" />
            }
          </div>
          <span className="text-[9px] text-gray-400">{format(subDays(new Date(), 6 - i), 'EEE')}</span>
        </div>
      ))}
    </div>
  );
}

export default function DailyStreakWidget({ user }) {
  const queryClient = useQueryClient();

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['streak-daily-earnings', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 35),
    enabled: !!user,
  });

  const { data: streakRecords = [] } = useQuery({
    queryKey: ['streak-record', user?.id],
    queryFn: () => base44.entities.Streak.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const streakRecord = streakRecords[0];

  // Compute current streak from dailyEarnings
  const { currentStreak, longestStreak, completedToday } = useMemo(() => {
    let streak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const earningDates = new Set(
      dailyEarnings.filter(e => e.total_surveys_completed > 0).map(e => e.date)
    );

    const completedToday = earningDates.has(today);
    // Start counting from yesterday if not done today yet
    const startFrom = completedToday ? 0 : 1;

    for (let i = startFrom; i < 35; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      if (earningDates.has(d)) streak++;
      else break;
    }

    const longest = Math.max(streakRecord?.longest_streak || 0, streak);
    return { currentStreak: streak, longestStreak: longest, completedToday };
  }, [dailyEarnings, streakRecord]);

  // Next milestone
  const nextMilestone = STREAK_REWARDS.find(r => currentStreak < r.days) || STREAK_REWARDS[STREAK_REWARDS.length - 1];
  const progressPct = Math.min((currentStreak / nextMilestone.days) * 100, 100);

  // Streak reward earned
  const highestEarned = [...STREAK_REWARDS].reverse().find(r => currentStreak >= r.days);

  const claimRewardMutation = useMutation({
    mutationFn: async (reward) => {
      await base44.auth.updateMe({
        total_earnings: (user.total_earnings || 0) + reward.xp * 0.01, // XP as $0.01 each
      });
      const milestones = streakRecord?.streak_milestones || [];
      if (!milestones.includes(reward.days)) {
        const payload = {
          user_id: user.id,
          current_streak: currentStreak,
          longest_streak: Math.max(longestStreak, currentStreak),
          last_activity_date: format(new Date(), 'yyyy-MM-dd'),
          total_bonus_earned: (streakRecord?.total_bonus_earned || 0) + reward.xp * 0.01,
          streak_milestones: [...milestones, reward.days],
        };
        if (streakRecord) {
          await base44.entities.Streak.update(streakRecord.id, payload);
        } else {
          await base44.entities.Streak.create(payload);
        }
      }
    },
    onSuccess: (_, reward) => {
      queryClient.invalidateQueries(['streak-record', user?.id]);
      toast.success(`🎉 ${reward.xp} XP claimed! +${reward.bonusPct}% survey payout bonus for today!`);
    },
  });

  const claimedMilestones = new Set(streakRecord?.streak_milestones || []);

  return (
    <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 overflow-hidden">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Daily Streak</h3>
              <p className="text-xs text-gray-400">Complete a survey each day</p>
            </div>
          </div>
          <Link to={createPageUrl('Challenges')}>
            <Button size="sm" variant="ghost" className="text-orange-600 text-xs h-7 px-2">
              All <ArrowRight className="w-3 h-3 ml-0.5" />
            </Button>
          </Link>
        </div>

        {/* Streak count + status */}
        <div className="flex items-center gap-4 mb-4">
          <motion.div
            key={currentStreak}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <div className={`text-5xl font-black ${currentStreak > 0 ? 'text-orange-500' : 'text-gray-300'}`}>
              {currentStreak}
            </div>
            <div className="text-xs text-gray-500 font-medium">Day Streak</div>
          </motion.div>

          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Progress to {nextMilestone.icon} {nextMilestone.label}</span>
              <span className="font-medium text-orange-600">{currentStreak}/{nextMilestone.days}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500"
              />
            </div>
            <div className="flex items-center gap-2">
              {completedToday
                ? <Badge className="bg-green-100 text-green-700 text-xs h-5"><CheckCircle2 className="w-3 h-3 mr-1" />Done today!</Badge>
                : <Badge className="bg-amber-100 text-amber-700 text-xs h-5 animate-pulse">⚡ Complete a survey today</Badge>
              }
              {longestStreak > 0 && (
                <span className="text-xs text-gray-400">Best: {longestStreak} days</span>
              )}
            </div>
          </div>
        </div>

        {/* 7-day dots */}
        <div className="flex justify-center mb-4">
          <StreakDots dailyEarnings={dailyEarnings} />
        </div>

        {/* Milestone rewards */}
        <div className="grid grid-cols-3 gap-2">
          {STREAK_REWARDS.map(reward => {
            const reached = currentStreak >= reward.days;
            const claimed = claimedMilestones.has(reward.days);
            const canClaim = reached && !claimed;
            return (
              <div key={reward.days} className={`rounded-xl p-2.5 text-center border-2 transition-all ${
                reached ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}>
                <div className="text-xl mb-0.5">{reward.icon}</div>
                <p className="text-xs font-bold text-gray-800">{reward.label}</p>
                <p className="text-xs text-orange-600 font-semibold">+{reward.xp} XP</p>
                <p className="text-[10px] text-gray-400">+{reward.bonusPct}% payout</p>
                {canClaim ? (
                  <Button
                    size="sm"
                    className="w-full mt-1.5 h-6 text-xs bg-orange-500 hover:bg-orange-600 px-1"
                    onClick={() => claimRewardMutation.mutate(reward)}
                    disabled={claimRewardMutation.isPending}
                  >
                    Claim!
                  </Button>
                ) : claimed ? (
                  <div className="mt-1.5 text-[10px] text-green-600 font-bold flex items-center justify-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Claimed
                  </div>
                ) : (
                  <div className="mt-1.5 text-[10px] text-gray-400 flex items-center justify-center gap-0.5">
                    <Lock className="w-3 h-3" /> {reward.days - currentStreak}d left
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Miss day warning */}
        {!completedToday && currentStreak > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-600 text-center">
            ⚠️ Complete a survey today or your <strong>{currentStreak}-day streak resets!</strong>
          </div>
        )}
      </CardContent>
    </Card>
  );
}