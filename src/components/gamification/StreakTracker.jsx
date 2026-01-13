import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, Award, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function StreakTracker({ streak }) {
  const milestones = [
    { days: 7, reward: 5, icon: "🔥" },
    { days: 14, reward: 10, icon: "⚡" },
    { days: 30, reward: 25, icon: "💎" },
    { days: 60, reward: 50, icon: "👑" },
    { days: 100, reward: 100, icon: "🏆" }
  ];

  const nextMilestone = milestones.find(m => m.days > (streak?.current_streak || 0));
  const daysToNext = nextMilestone ? nextMilestone.days - (streak?.current_streak || 0) : 0;

  return (
    <Card className="p-6 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            <Flame className="w-8 h-8 text-red-600" />
          </motion.div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Daily Streak</h3>
            <p className="text-sm text-gray-600">Complete surveys every day to earn bonuses!</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-red-600">{streak?.current_streak || 0}</div>
          <div className="text-sm text-gray-600">days</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Best Streak</span>
          <Badge className="bg-amber-100 text-amber-700">
            <Award className="w-3 h-3 mr-1" />
            {streak?.longest_streak || 0} days
          </Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Total Bonus Earned</span>
          <Badge className="bg-green-100 text-green-700">
            ${(streak?.total_bonus_earned || 0).toFixed(2)}
          </Badge>
        </div>

        {nextMilestone && (
          <div className="pt-4 border-t border-red-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Next Milestone</span>
              <Badge className="bg-red-600 text-white">
                {nextMilestone.icon} ${nextMilestone.reward} bonus
              </Badge>
            </div>
            <div className="relative h-3 bg-red-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((streak?.current_streak || 0) / nextMilestone.days) * 100}%` }}
                className="h-full bg-gradient-to-r from-red-500 to-red-600"
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {daysToNext} {daysToNext === 1 ? 'day' : 'days'} to {nextMilestone.days}-day milestone
            </p>
          </div>
        )}

        <div className="grid grid-cols-5 gap-2 pt-4">
          {milestones.map((milestone, idx) => (
            <div
              key={idx}
              className={`text-center p-2 rounded-lg ${
                (streak?.streak_milestones || []).includes(milestone.days)
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <div className="text-xl mb-1">{milestone.icon}</div>
              <div className="text-xs font-bold">{milestone.days}d</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}