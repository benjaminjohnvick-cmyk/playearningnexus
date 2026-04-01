import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Crown, Star, Zap, Shield, Trophy, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

const TITLES_BY_LEVEL = {
  1: 'Newbie', 5: 'Surveyor', 10: 'Expert', 15: 'Master',
  20: 'Legend', 25: 'Oracle', 30: 'Sage', 40: 'Mythic', 50: 'Ascended'
};

const PROFILE_FRAMES = {
  5: 'Silver Frame', 10: 'Gold Frame', 15: 'Platinum Frame',
  20: 'Diamond Frame', 30: 'Cosmic Frame', 50: 'Eternal Frame'
};

const ALL_BADGES = [
  { id: 'first_survey', name: 'First Step', icon: '🎬', requirement: 'surveys_completed', value: 1, description: 'Complete your first survey' },
  { id: 'survey_master', name: 'Survey Master', icon: '🏆', requirement: 'surveys_completed', value: 100, description: 'Complete 100 surveys' },
  { id: 'on_fire', name: 'On Fire', icon: '🔥', requirement: 'streak', value: 7, description: '7-day streak' },
  { id: 'unstoppable', name: 'Unstoppable', icon: '⚡', requirement: 'streak', value: 30, description: '30-day streak' },
  { id: 'level_5', name: 'Rising Star', icon: '⭐', requirement: 'level_reached', value: 5, description: 'Reach Level 5' },
  { id: 'level_10', name: 'Hall of Fame', icon: '🌟', requirement: 'level_reached', value: 10, description: 'Reach Level 10' },
  { id: 'xp_legend', name: 'XP Legend', icon: '👑', requirement: 'xp_threshold', value: 5000, description: 'Earn 5000 XP' }
];

export default function LevelAndBadgesPage() {
  const [user, setUser] = useState(null);
  const [userLevel, setUserLevel] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);

        const levels = await base44.asServiceRole.entities.UserLevel.filter({ user_id: me.id });
        if (levels.length > 0) setUserLevel(levels[0]);

        const topUsers = await base44.asServiceRole.entities.UserLevel.list('-total_xp', 50);
        setLeaderboard(topUsers);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  const level = userLevel?.current_level || 1;
  const totalXp = userLevel?.total_xp || 0;
  const xpToNextLevel = (100 * level);
  const xpProgress = ((totalXp % xpToNextLevel) / xpToNextLevel) * 100;
  const unlockedBadges = userLevel?.unlocked_badges || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-black text-gray-900 mb-8 flex items-center gap-3">
          <Crown className="w-10 h-10 text-yellow-500" /> Levels & Badges
        </h1>

        <Tabs defaultValue="level" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="level">
              <Zap className="w-4 h-4 mr-2" /> My Level
            </TabsTrigger>
            <TabsTrigger value="badges">
              <Shield className="w-4 h-4 mr-2" /> Badges
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="w-4 h-4 mr-2" /> Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* My Level Tab */}
          <TabsContent value="level" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-8">
                <div className="text-center mb-8">
                  <div className="inline-block mb-4">
                    <div className="relative w-32 h-32 flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full shadow-2xl">
                      <span className="text-6xl font-black text-white">{level}</span>
                    </div>
                  </div>
                  <h2 className="text-4xl font-black text-gray-900 mb-2">
                    {userLevel?.current_title || 'Newbie'}
                  </h2>
                  <p className="text-gray-600 text-lg">{userLevel?.lifetime_surveys_completed || 0} surveys completed</p>
                  {userLevel?.profile_frame && (
                    <Badge className="mt-4 bg-blue-600 text-white text-sm px-4 py-2">
                      🖼️ {userLevel.profile_frame}
                    </Badge>
                  )}
                </div>

                <div className="space-y-6 mt-8">
                  {/* XP Progress */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-gray-700">Total XP</span>
                      <span className="font-bold text-purple-600">{totalXp.toLocaleString()} / {(xpToNextLevel * level).toLocaleString()}</span>
                    </div>
                    <Progress value={xpProgress} className="h-3" />
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.round(xpProgress)}% to level {level + 1}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="bg-white p-4">
                      <p className="text-xs text-gray-600 font-semibold">SURVEYS COMPLETED</p>
                      <p className="text-3xl font-black text-blue-600 mt-1">
                        {userLevel?.lifetime_surveys_completed || 0}
                      </p>
                    </Card>
                    <Card className="bg-white p-4">
                      <p className="text-xs text-gray-600 font-semibold">CURRENT STREAK</p>
                      <p className="text-3xl font-black text-red-600 mt-1">
                        🔥 {userLevel?.current_streak || 0}
                      </p>
                    </Card>
                    <Card className="bg-white p-4">
                      <p className="text-xs text-gray-600 font-semibold">LONGEST STREAK</p>
                      <p className="text-3xl font-black text-orange-600 mt-1">
                        {userLevel?.longest_streak || 0}
                      </p>
                    </Card>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Unlocked Categories */}
            {userLevel?.unlocked_survey_categories?.length > 0 && (
              <Card className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">🔓 Unlocked Survey Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {userLevel.unlocked_survey_categories.map((cat, idx) => (
                    <Badge key={idx} className="bg-green-600 text-white text-sm px-3 py-1.5">
                      {cat.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Badges Tab */}
          <TabsContent value="badges">
            <div className="grid md:grid-cols-2 gap-6">
              {ALL_BADGES.map((badge, idx) => {
                const isUnlocked = unlockedBadges.includes(badge.id);
                return (
                  <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}>
                    <Card className={`p-6 border-2 transition-all ${isUnlocked ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <span className={`text-5xl ${isUnlocked ? '' : 'grayscale opacity-50'}`}>{badge.icon}</span>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{badge.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{badge.description}</p>
                            <p className="text-xs text-gray-500 mt-2 font-semibold">
                              {badge.requirement.replace(/_/g, ' ').toUpperCase()}: {badge.value}
                            </p>
                          </div>
                        </div>
                        {!isUnlocked && <Lock className="w-5 h-5 text-gray-400" />}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard">
            <Card className="p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">🏆 Global XP Leaderboard</h3>
              <div className="space-y-3">
                {leaderboard.map((entry, idx) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      entry.user_id === user?.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="text-2xl font-black w-12 text-center">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900 text-lg">Level {entry.current_level}</p>
                        <span className="text-sm font-semibold text-purple-600">
                          {entry.current_title}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{entry.lifetime_surveys_completed} surveys</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-lg text-yellow-600">{entry.total_xp.toLocaleString()} XP</p>
                      <Star className="w-4 h-4 text-yellow-500 mx-auto mt-1" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}