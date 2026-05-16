import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import SurveyQualityRewards from '@/components/gamification/SurveyQualityRewards';
import GamificationLeaderboard from '@/components/gamification/GamificationLeaderboard';
import GamificationHub from '@/components/gamification/GamificationHub';
import AIPayoutAdvanceDashboard from '@/components/payout/AIPayoutAdvanceDashboard';

export default function AchievementsPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user,
  });

  const { data: surveyResponses = [] } = useQuery({
    queryKey: ['survey_responses', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const { data: streakData } = useQuery({
    queryKey: ['streak', user?.id],
    queryFn: () => base44.entities.Streak.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['daily_earnings', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const activeReferrals = referrals.filter(r => r.status === 'active' || r.status === 'completed').length;
  const commissionEarned = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const qualitySurveys = surveyResponses.filter(r => (r.quality_score || 0) >= 90).length;
  const fastSurveys = surveyResponses.filter(r => (r.time_taken_seconds || 999) < 300).length;
  const streak = streakData?.[0];
  const bestDayEarnings = dailyEarnings.reduce((max, d) => Math.max(max, d.amount || 0), 0);
  const memberDays = Math.floor((Date.now() - new Date(user.created_date)) / 86400000);

  const stats = {
    totalSurveys: surveyResponses.length,
    activeReferrals,
    totalReferrals: referrals.length,
    commissionEarned,
    quality_surveys: qualitySurveys,
    fast_surveys: fastSurveys,
    streak_days: streak?.current_streak || 0,
    daysGoalMet: streak?.total_days_met || 0,
    best_day_earnings: bestDayEarnings,
    member_days: memberDays,
    leaderboard_rank: 999, // would come from leaderboard data
  };

  const todayEarning = dailyEarnings.find(d => d.date === new Date().toISOString().split('T')[0]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-gray-900">Achievements & Rewards</h1>
          <p className="text-gray-500 text-sm mt-1">Level up, earn badges, and unlock real financial perks</p>
        </div>

        <Tabs defaultValue="levels">
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="levels">🏆 Levels</TabsTrigger>
            <TabsTrigger value="leaderboard">📊 Leaderboard</TabsTrigger>
            <TabsTrigger value="gamification">🎮 Gamification</TabsTrigger>
            <TabsTrigger value="payout">⚡ AI Payout</TabsTrigger>
          </TabsList>

          <TabsContent value="levels">
            <SurveyQualityRewards user={user} stats={stats} />
          </TabsContent>

          <TabsContent value="leaderboard">
            <GamificationLeaderboard currentUserId={user.id} />
          </TabsContent>

          <TabsContent value="gamification">
            <GamificationHub
              user={user}
              stats={stats}
              todayEarnings={todayEarning?.amount || 0}
              todaySurveys={surveyResponses.filter(r => r.created_date?.startsWith(new Date().toISOString().split('T')[0])).length}
              referrals={referrals}
            />
          </TabsContent>

          <TabsContent value="payout">
            <AIPayoutAdvanceDashboard user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}