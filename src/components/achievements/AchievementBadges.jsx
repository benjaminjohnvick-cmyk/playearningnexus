import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trophy, Star, Award } from 'lucide-react';

export default function AchievementBadges({ achievements = [], userAchievements = [] }) {
  const earnedKeys = new Set(userAchievements.map(a => a.achievement_key));
  const earnedAchievements = achievements.filter(a => earnedKeys.has(a.achievement_key));

  if (earnedAchievements.length === 0) {
    return (
      <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-white">
        <CardContent className="p-6 text-center">
          <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Earn achievements by completing surveys, building streaks, and referrals!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-500" /> Achievements
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {earnedAchievements.map(achievement => (
          <TooltipProvider key={achievement.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center p-3 rounded-lg bg-white border-2 hover:shadow-md transition-shadow cursor-pointer"
                  style={{ borderColor: achievement.badge_color }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                    style={{ backgroundColor: achievement.badge_color + '20' }}>
                    {achievement.badge_icon_url ? (
                      <img src={achievement.badge_icon_url} alt={achievement.title} className="w-8 h-8" />
                    ) : (
                      <Award className="w-6 h-6" style={{ color: achievement.badge_color }} />
                    )}
                  </div>
                  <p className="text-xs font-bold text-center text-gray-900">{achievement.title}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold">{achievement.title}</p>
                <p className="text-xs text-gray-400 mt-1">{achievement.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}