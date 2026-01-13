import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AchievementsList({ achievements }) {
  const allAchievements = [
    { type: 'first_game', title: 'First Steps', description: 'Install your first game', icon: '🎮', reward: 2 },
    { type: 'games_explorer', title: 'Game Explorer', description: 'Try 5 different games', icon: '🗺️', reward: 5 },
    { type: 'games_master', title: 'Game Master', description: 'Try 20 different games', icon: '👑', reward: 20 },
    { type: 'early_earner', title: 'Early Earner', description: 'Earn your first $10', icon: '💵', reward: 3 },
    { type: 'money_maker', title: 'Money Maker', description: 'Earn $100 total', icon: '💰', reward: 10 },
    { type: 'big_spender', title: 'Big Spender', description: 'Earn $500 total', icon: '💎', reward: 50 },
    { type: 'survey_novice', title: 'Survey Novice', description: 'Complete 10 surveys', icon: '📝', reward: 2 },
    { type: 'survey_pro', title: 'Survey Pro', description: 'Complete 50 surveys', icon: '⭐', reward: 10 },
    { type: 'survey_legend', title: 'Survey Legend', description: 'Complete 200 surveys', icon: '🏆', reward: 25 },
    { type: 'streak_warrior', title: 'Streak Warrior', description: '7-day streak', icon: '🔥', reward: 5 },
    { type: 'streak_champion', title: 'Streak Champion', description: '30-day streak', icon: '⚡', reward: 25 },
    { type: 'referral_starter', title: 'Social Butterfly', description: 'Refer 3 friends', icon: '🦋', reward: 5 },
    { type: 'referral_expert', title: 'Influencer', description: 'Refer 10 friends', icon: '🌟', reward: 20 }
  ];

  const unlockedAchievements = achievements.filter(a => a.is_unlocked);
  const inProgressAchievements = achievements.filter(a => !a.is_unlocked && a.progress > 0);

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-600" />
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Achievements</h3>
              <p className="text-sm text-gray-600">Unlock badges and earn rewards</p>
            </div>
          </div>
          <Badge className="bg-amber-600 text-white text-lg px-4 py-2">
            {unlockedAchievements.length}/{allAchievements.length}
          </Badge>
        </div>
      </Card>

      {unlockedAchievements.length > 0 && (
        <div>
          <h4 className="text-lg font-bold mb-3 text-gray-900">🏆 Unlocked</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <AnimatePresence>
              {unlockedAchievements.map((achievement) => {
                const info = allAchievements.find(a => a.type === achievement.achievement_type);
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    <Card className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300">
                      <div className="flex items-start gap-3">
                        <div className="text-4xl">{info?.icon}</div>
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-900">{info?.title}</h5>
                          <p className="text-sm text-gray-600 mb-2">{info?.description}</p>
                          <Badge className="bg-green-100 text-green-700">
                            +${info?.reward} earned
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {inProgressAchievements.length > 0 && (
        <div>
          <h4 className="text-lg font-bold mb-3 text-gray-900">📊 In Progress</h4>
          <div className="grid md:grid-cols-2 gap-4">
            {inProgressAchievements.map((achievement) => {
              const info = allAchievements.find(a => a.type === achievement.achievement_type);
              return (
                <Card key={achievement.id} className="p-4 bg-white border-2 border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="text-4xl opacity-50">{info?.icon}</div>
                    <div className="flex-1">
                      <h5 className="font-bold text-gray-900">{info?.title}</h5>
                      <p className="text-sm text-gray-600 mb-2">{info?.description}</p>
                      <Progress value={achievement.progress} className="h-2 mb-1" />
                      <p className="text-xs text-gray-500">{achievement.progress}% complete</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-lg font-bold mb-3 text-gray-900 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Locked
        </h4>
        <div className="grid md:grid-cols-3 gap-3">
          {allAchievements
            .filter(a => !achievements.find(ach => ach.achievement_type === a.type))
            .map((achievement, idx) => (
              <Card key={idx} className="p-3 bg-gray-50 border border-gray-200 opacity-60">
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{achievement.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h6 className="font-bold text-sm text-gray-700 truncate">{achievement.title}</h6>
                    <p className="text-xs text-gray-500 truncate">{achievement.description}</p>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}