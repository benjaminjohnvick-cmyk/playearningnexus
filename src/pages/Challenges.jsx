import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trophy, Flame, Users, DollarSign, Star, Zap, Target,
  Gift, Lock, CheckCircle2, Clock, Loader2, Crown, Award
} from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, format, subDays } from 'date-fns';
import confetti from 'canvas-confetti';
import DailyChallengeBanner from '@/components/challenges/DailyChallengeBanner';

// ─── Challenge definitions ───────────────────────────────────────────────────
const CHALLENGES = [
  {
    id: 'survey_streak_5',
    title: '5-Day Survey Streak',
    description: 'Complete at least one survey every day for 5 consecutive days.',
    icon: Flame,
    color: 'from-orange-400 to-red-500',
    category: 'surveys',
    bonus: 2.50,
    bonusLabel: '$2.50 Cash Bonus',
    metric: 'streak_days',
    target: 5,
    difficulty: 'Easy',
    diffColor: 'bg-green-100 text-green-700',
  },
  {
    id: 'survey_streak_30',
    title: '30-Day Survey Streak',
    description: 'Complete surveys every day for an entire month.',
    icon: Crown,
    color: 'from-yellow-400 to-orange-500',
    category: 'surveys',
    bonus: 25.00,
    bonusLabel: '$25.00 Cash Bonus',
    metric: 'streak_days',
    target: 30,
    difficulty: 'Hard',
    diffColor: 'bg-red-100 text-red-700',
  },
  {
    id: 'referral_gold_rush',
    title: 'Referral Gold Rush',
    description: 'Get 10 active referrals who each complete at least one survey.',
    icon: Users,
    color: 'from-yellow-500 to-amber-600',
    category: 'referrals',
    bonus: 15.00,
    bonusLabel: '$15.00 Cash Bonus',
    metric: 'active_referrals',
    target: 10,
    difficulty: 'Medium',
    diffColor: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'first_100',
    title: 'First $100 Earned',
    description: 'Reach $100 in total lifetime earnings on GamerGain.',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-600',
    category: 'earnings',
    bonus: 10.00,
    bonusLabel: '$10.00 Cash Bonus',
    metric: 'total_earnings',
    target: 100,
    difficulty: 'Medium',
    diffColor: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'daily_goal_7',
    title: 'Weekly Earner',
    description: 'Hit your $3 daily earning goal 7 days in a row.',
    icon: Target,
    color: 'from-blue-500 to-indigo-600',
    category: 'surveys',
    bonus: 5.00,
    bonusLabel: '$5.00 Cash Bonus',
    metric: 'daily_goal_streak',
    target: 7,
    difficulty: 'Medium',
    diffColor: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'referral_50',
    title: 'Referral Champion',
    description: 'Reach 50 active referrals to unlock Tier 3 status.',
    icon: Award,
    color: 'from-purple-500 to-violet-600',
    category: 'referrals',
    bonus: 50.00,
    bonusLabel: '$50.00 Cash Bonus',
    metric: 'active_referrals',
    target: 50,
    difficulty: 'Expert',
    diffColor: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'surveys_50',
    title: 'Survey Veteran',
    description: 'Complete a total of 50 surveys on the platform.',
    icon: Star,
    color: 'from-teal-500 to-cyan-600',
    category: 'surveys',
    bonus: 7.50,
    bonusLabel: '$7.50 Cash Bonus',
    metric: 'total_surveys',
    target: 50,
    difficulty: 'Medium',
    diffColor: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'earnings_500',
    title: 'High Roller',
    description: 'Earn $500 in total lifetime earnings.',
    icon: Trophy,
    color: 'from-yellow-400 to-yellow-600',
    category: 'earnings',
    bonus: 75.00,
    bonusLabel: '$75.00 Cash Bonus',
    metric: 'total_earnings',
    target: 500,
    difficulty: 'Expert',
    diffColor: 'bg-purple-100 text-purple-700',
  },
];

const CATEGORY_TABS = [
  { key: 'all', label: 'All Challenges' },
  { key: 'surveys', label: '📋 Surveys' },
  { key: 'referrals', label: '👥 Referrals' },
  { key: 'earnings', label: '💰 Earnings' },
];

export default function Challenges() {
  const [user, setUser] = useState(null);
  const [category, setCategory] = useState('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['daily-challenges', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 90),
    enabled: !!user
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-challenges', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: claimedPayouts = [] } = useQuery({
    queryKey: ['challenge-payouts', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id, payout_type: 'contest_win' }),
    enabled: !!user
  });

  // ── Compute user metrics ─────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!user) return {};

    // Survey streak: consecutive days with at least 1 survey
    let streak = 0;
    for (let i = 0; i < 90; i++) {
      const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const day = dailyEarnings.find(e => e.date === dateStr);
      if (day && day.total_surveys_completed > 0) streak++;
      else break;
    }

    // Daily goal streak
    let goalStreak = 0;
    for (let i = 0; i < 90; i++) {
      const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const day = dailyEarnings.find(e => e.date === dateStr);
      if (day && day.goal_met) goalStreak++;
      else break;
    }

    const totalSurveys = dailyEarnings.reduce((s, e) => s + (e.total_surveys_completed || 0), 0);
    const totalEarnings = dailyEarnings.reduce((s, e) => s + (e.total_earned || 0), 0);
    const activeReferrals = referrals.filter(r => r.status === 'active').length;

    return { streak_days: streak, daily_goal_streak: goalStreak, total_surveys: totalSurveys, total_earnings: totalEarnings, active_referrals: activeReferrals };
  }, [user, dailyEarnings, referrals]);

  const claimedIds = new Set(claimedPayouts.map(p => p.description?.match(/\[([^\]]+)\]/)?.[1]).filter(Boolean));

  const claimChallengeMutation = useMutation({
    mutationFn: async (challenge) => {
      await base44.entities.Payout.create({
        user_id: user.id,
        recipient_type: 'user',
        recipient_id: user.id,
        recipient_email: user.email,
        amount: challenge.bonus,
        currency: 'USD',
        method: 'paypal',
        payout_type: 'contest_win',
        status: 'pending',
        description: `Challenge reward [${challenge.id}]: ${challenge.title} — ${challenge.bonusLabel}`,
      });
      // Create notification
      await base44.entities.Notification.create({
        user_id: user.id,
        type: 'achievement_unlocked',
        title: `🏆 Challenge Complete: ${challenge.title}`,
        message: `You earned ${challenge.bonusLabel} for completing the "${challenge.title}" challenge!`,
        status: 'unread',
        delivery_method: ['in_app'],
      });
      return challenge;
    },
    onSuccess: (challenge) => {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success(`🎉 ${challenge.bonusLabel} claimed! Payout pending.`);
      queryClient.invalidateQueries(['challenge-payouts']);
      queryClient.invalidateQueries(['notifications']);
    },
    onError: () => toast.error('Failed to claim. Please try again.')
  });

  const getProgress = (challenge) => {
    const value = metrics[challenge.metric] || 0;
    return { value, pct: Math.min((value / challenge.target) * 100, 100), complete: value >= challenge.target };
  };

  const filtered = category === 'all' ? CHALLENGES : CHALLENGES.filter(c => c.category === category);
  const completedCount = CHALLENGES.filter(c => getProgress(c).complete).length;

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Trophy className="w-9 h-9 text-purple-600" /> Challenges
            </h1>
            <p className="text-gray-500 mt-1">Complete challenges to earn cash bonuses</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-black text-purple-600">{completedCount}/{CHALLENGES.length}</p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-purple-200 flex items-center justify-center bg-white shadow-md">
              <span className="text-xl font-black text-purple-700">{Math.round((completedCount / CHALLENGES.length) * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Daily challenge */}
        <DailyChallengeBanner user={user} />

        {/* Live metrics bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Survey Streak', value: `${metrics.streak_days || 0} days`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
            { label: 'Active Referrals', value: metrics.active_referrals || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Total Surveys', value: metrics.total_surveys || 0, icon: Star, color: 'text-teal-500', bg: 'bg-teal-50' },
            { label: 'Total Earned', value: `$${(metrics.total_earnings || 0).toFixed(2)}`, icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-md">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`font-bold ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_TABS.map(t => (
            <button key={t.key} onClick={() => setCategory(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border-2 ${category === t.key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Challenge Grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map(challenge => {
            const { value, pct, complete } = getProgress(challenge);
            const isClaimed = claimedIds.has(challenge.id);
            const Icon = challenge.icon;

            return (
              <Card key={challenge.id}
                className={`border-2 overflow-hidden transition-all hover:shadow-xl ${complete && !isClaimed ? 'border-green-400 shadow-lg shadow-green-100' : isClaimed ? 'border-gray-200 opacity-70' : 'border-gray-100'}`}>
                <div className={`h-2 bg-gradient-to-r ${challenge.color}`} style={{ width: `${pct}%`, transition: 'width 0.8s ease' }} />
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${challenge.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                      {isClaimed ? <CheckCircle2 className="w-6 h-6 text-white" /> : <Icon className="w-6 h-6 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-gray-900">{challenge.title}</h3>
                        <Badge className={`text-xs ${challenge.diffColor}`}>{challenge.difficulty}</Badge>
                        {isClaimed && <Badge className="bg-gray-100 text-gray-500 text-xs">Claimed</Badge>}
                        {complete && !isClaimed && <Badge className="bg-green-100 text-green-700 text-xs animate-pulse">Ready to claim!</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{challenge.description}</p>

                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span className="font-medium">{Math.min(value, challenge.target)} / {challenge.target}</span>
                        </div>
                        <Progress value={pct} className="h-2.5" />
                      </div>

                      {/* Reward + action */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <Gift className="w-4 h-4 text-green-600" />
                          <span className="font-bold text-green-600 text-sm">{challenge.bonusLabel}</span>
                        </div>
                        {isClaimed ? (
                          <div className="flex items-center gap-1 text-gray-400 text-sm">
                            <CheckCircle2 className="w-4 h-4" /> Claimed
                          </div>
                        ) : complete ? (
                          <Button size="sm"
                            onClick={() => claimChallengeMutation.mutate(challenge)}
                            disabled={claimChallengeMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white">
                            {claimChallengeMutation.isPending
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <><Gift className="w-4 h-4 mr-1" /> Claim</>}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1 text-gray-400 text-xs">
                            <Lock className="w-3 h-3" /> {Math.round(100 - pct)}% remaining
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
}