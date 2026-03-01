import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Flame, Users, TrendingUp, Star, Sparkles } from "lucide-react";
import GamificationHub from '../components/gamification/GamificationHub';
import Leaderboard from '../components/gamification/Leaderboard';
import GuildLeaderboard from '../components/gamification/GuildLeaderboard';
import AITierSuggestion from '../components/gamification/AITierSuggestion';
import AIChurnPrevention from '../components/gamification/AIChurnPrevention';
import AICampaignGenerator from '../components/gamification/AICampaignGenerator';

export default function Gamification() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const { data: dailyEarnings } = useQuery({
    queryKey: ['dailyEarnings', user?.id, today],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id, date: today }),
    enabled: !!user,
    select: (d) => d[0] || null,
  });

  const { data: allDailyEarnings = [] } = useQuery({
    queryKey: ['allDailyEarnings', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases', user?.id],
    queryFn: () => base44.entities.InAppPurchase.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => base44.entities.LeaderboardEntry.list('-total_earnings', 50),
  });

  const { data: myGuilds = [] } = useQuery({
    queryKey: ['myGuilds', user?.id],
    queryFn: () => base44.entities.Guild.list().then(guilds =>
      guilds.filter(g => g.leader_id === user.id || g.member_ids?.includes(user.id))
    ),
    enabled: !!user,
  });

  const activeReferrals = referrals.filter(r => r.status === 'active').length;
  const daysGoalMet = allDailyEarnings.filter(d => d.goal_met).length;
  const totalSurveys = allDailyEarnings.reduce((s, d) => s + (d.total_surveys_completed || 0), 0);

  const stats = {
    totalReferrals: referrals.length,
    activeReferrals,
    commissionEarned: referrals.reduce((s, r) => s + (r.commission_earned || 0), 0),
    totalSurveys,
    daysGoalMet,
    streakDays: 0, // can hook up to streak entity if needed
    purchases: purchases.length,
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Star className="w-9 h-9 text-yellow-500" />
            Rewards & Achievements
          </h1>
          <p className="text-gray-600">Earn points, unlock badges, complete daily goals, and climb the leaderboard!</p>
        </div>

        <Tabs defaultValue="hub" className="space-y-6">
          <TabsList className="bg-white shadow-md border-2 border-red-200">
            <TabsTrigger value="hub">
              <Trophy className="w-4 h-4 mr-2" />
              My Progress
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <TrendingUp className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="guilds">
              <Users className="w-4 h-4 mr-2" />
              Guild Rankings
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hub">
            <div className="space-y-4">
              <AIChurnPrevention user={user} />
              <GamificationHub
                user={user}
                stats={stats}
                todayEarnings={dailyEarnings?.total_earned || 0}
                todaySurveys={dailyEarnings?.total_surveys_completed || 0}
                referrals={referrals}
              />
            </div>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard entries={leaderboard} currentUserId={user.id} />
          </TabsContent>

          <TabsContent value="guilds">
            <GuildLeaderboard currentGuildId={myGuilds[0]?.id} />
          </TabsContent>

          <TabsContent value="ai">
            <div className="space-y-6">
              <AITierSuggestion user={user} />
              {user?.role === 'admin' && <AICampaignGenerator />}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}