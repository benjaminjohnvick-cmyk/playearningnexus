import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Flame, Users } from "lucide-react";
import StreakTracker from '../components/gamification/StreakTracker';
import AchievementsList from '../components/gamification/AchievementsList';
import Leaderboard from '../components/gamification/Leaderboard';

export default function Gamification() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: streak } = useQuery({
    queryKey: ['user-streak', user?.id],
    queryFn: async () => {
      const streaks = await base44.entities.Streak.filter({ user_id: user.id });
      return streaks[0] || null;
    },
    enabled: !!user
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['user-achievements', user?.id],
    queryFn: () => base44.entities.Achievement.filter({ user_id: user.id }),
    enabled: !!user
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => base44.entities.LeaderboardEntry.list('-total_earnings', 50)
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Gamification Hub</h1>
          <p className="text-gray-600">Track your progress, unlock achievements, and compete with others!</p>
        </div>

        <Tabs defaultValue="streaks" className="space-y-6">
          <TabsList className="bg-white shadow-md border-2 border-red-200">
            <TabsTrigger value="streaks" className="text-lg">
              <Flame className="w-4 h-4 mr-2" />
              Streaks
            </TabsTrigger>
            <TabsTrigger value="achievements" className="text-lg">
              <Trophy className="w-4 h-4 mr-2" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-lg">
              <Users className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="streaks">
            <StreakTracker streak={streak} />
          </TabsContent>

          <TabsContent value="achievements">
            <AchievementsList achievements={achievements} />
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard entries={leaderboard} currentUserId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}