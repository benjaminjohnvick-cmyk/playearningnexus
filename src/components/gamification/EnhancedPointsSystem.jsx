import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  Star, 
  Target, 
  Zap,
  Award,
  TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";

export default function EnhancedPointsSystem({ user, recentActivities = [] }) {
  // Calculate level progress
  const pointsPerLevel = 1000;
  const currentLevelPoints = (user.total_points || 0) % pointsPerLevel;
  const levelProgress = (currentLevelPoints / pointsPerLevel) * 100;
  const pointsToNextLevel = pointsPerLevel - currentLevelPoints;

  // Define action points
  const actionPoints = {
    game_played: 50,
    survey_completed: 100,
    user_referred: 250,
    business_referred: 500,
    daily_login: 25,
    achievement_unlocked: 150
  };

  // Quick actions to earn points
  const quickActions = [
    { label: 'Play a Game', points: 50, icon: Trophy, color: 'blue' },
    { label: 'Complete Survey', points: 100, icon: Target, color: 'green' },
    { label: 'Refer a User', points: 250, icon: Star, color: 'purple' },
    { label: 'Refer Business', points: 500, icon: Zap, color: 'amber' }
  ];

  return (
    <div className="space-y-4">
      {/* Level Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6" />
              Level {user.level || 1}
            </div>
            <Badge className="bg-white text-purple-600 font-bold">
              {user.total_points || 0} pts
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress to Level {(user.level || 1) + 1}</span>
              <span>{pointsToNextLevel} pts to go</span>
            </div>
            <Progress value={levelProgress} className="h-3 bg-purple-700" />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Earn Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.05 }}
                  className={`p-4 rounded-lg bg-gradient-to-br from-${action.color}-50 to-${action.color}-100 border-2 border-${action.color}-200`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-5 h-5 text-${action.color}-600`} />
                    <span className="font-semibold text-sm text-gray-900">
                      +{action.points}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{action.label}</p>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Points Activity */}
      {recentActivities.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivities.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.created_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-700">
                    +{activity.points_earned}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}