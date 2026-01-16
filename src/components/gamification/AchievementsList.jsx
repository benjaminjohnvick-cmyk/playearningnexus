import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Lock, Gamepad2, Crown, DollarSign, Gem, FileText, Star, Flame, Zap, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AchievementsList({ achievements }) {
  const iconMap = {
    'first_game': <Trophy className="w-8 h-8 text-blue-500" />,
    'games_explorer': <Gamepad2 className="w-8 h-8 text-purple-500" />,
    'games_master': <Crown className="w-8 h-8 text-yellow-500" />,
    'early_earner': <DollarSign className="w-8 h-8 text-green-500" />,
    'money_maker': <DollarSign className="w-8 h-8 text-emerald-600" />,
    'big_spender': <Gem className="w-8 h-8 text-purple-600" />,
    'survey_novice': <FileText className="w-8 h-8 text-blue-500" />,
    'survey_pro': <Star className="w-8 h-8 text-amber-500" />,
    'survey_legend': <Trophy className="w-8 h-8 text-yellow-600" />,
    'streak_warrior': <Flame className="w-8 h-8 text-red-500" />,
    'streak_champion': <Zap className="w-8 h-8 text-yellow-500" />,
    'referral_starter': <Users className="w-8 h-8 text-purple-500" />,
    'referral_expert': <Star className="w-8 h-8 text-blue-500" />
  };

  const allAchievements = [
    { type: 'first_game', title: 'First Steps', description: 'Install your first game', reward: 2 },
    { type: 'games_explorer', title: 'Game Explorer', description: 'Try 5 different games', reward: 5 },
    { type: 'games_master', title: 'Game Master', description: 'Try 20 different games', reward: 20 },
    { type: 'early_earner', title: 'Early Earner', description: 'Earn your first $10', reward: 3 },
    { type: 'money_maker', title: 'Money Maker', description: 'Earn $100 total', reward: 10 },
    { type: 'big_spender', title: 'Big Spender', description: 'Earn $500 total', reward: 50 },
    { type: 'survey_novice', title: 'Survey Novice', description: 'Complete 10 surveys', reward: 2 },
    { type: 'survey_pro', title: 'Survey Pro', description: 'Complete 50 surveys', reward: 10 },
    { type: 'survey_legend', title: 'Survey Legend', description: 'Complete 200 surveys', reward: 25 },
    { type: 'streak_warrior', title: 'Streak Warrior', description: '7-day streak', reward: 5 },
    { type: 'streak_champion', title: 'Streak Champion', description: '30-day streak', reward: 25 },
    { type: 'referral_starter', title: 'Social Butterfly', description: 'Refer 3 friends', reward: 5 },
    { type: 'referral_expert', title: 'Influencer', description: 'Refer 10 friends', reward: 20 }
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
          <h4 className="text-lg font-bold mb-3 text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-600" />
            Unlocked
          </h4>
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
                        <div>{iconMap[achievement.achievement_type]}</div>
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
          <h4 className="text-lg font-bold mb-3 text-gray-900 flex items-center gap-2">
            <Progress className="w-5 h-5 text-blue-600" />
            In Progress
          </h4>
          <div className="grid md:grid-cols-2 gap-4">
            {inProgressAchievements.map((achievement) => {
              const info = allAchievements.find(a => a.type === achievement.achievement_type);
              return (
                <Card key={achievement.id} className="p-4 bg-white border-2 border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="opacity-50">{iconMap[achievement.achievement_type]}</div>
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
                  <div className="text-sm">{iconMap[achievement.type]}</div>
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