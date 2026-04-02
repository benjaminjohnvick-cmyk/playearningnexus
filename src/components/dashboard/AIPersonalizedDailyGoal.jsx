import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Zap, Target, TrendingUp, Gift, Flame, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function AIPersonalizedDailyGoal({ user }) {
  const today = new Date().toISOString().split('T')[0];
  const [earnedToday, setEarnedToday] = useState(0);
  const [unlockedMilestones, setUnlockedMilestones] = useState([]);

  useEffect(() => {
    // Simulate real-time earnings tracking
    const interval = setInterval(async () => {
      try {
        const dailyEarnings = await base44.entities.DailyEarnings.filter({
          user_id: user?.id,
          date: today
        });
        if (dailyEarnings[0]) {
          setEarnedToday(dailyEarnings[0].total_earned || 0);
        }
      } catch (e) {
        // Silently fail
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.id, today]);

  const fallbackGoal = {
    daily_goal_amount: 3.00,
    rationale: "Earn $3 today through surveys and tasks",
    motivational_message: "Complete a few surveys to hit your daily goal!",
    milestone_incentives: [
      { amount: 1.00, incentive: "Great start! Keep going." },
      { amount: 2.00, incentive: "Halfway there!" },
      { amount: 3.00, incentive: "Daily goal reached! 🎉" },
    ],
    recommended_tasks: [
      { task_name: "Complete a Survey", time_estimate: 10, priority: "High", reward: 1.50 },
      { task_name: "PPC Ad Search", time_estimate: 5, priority: "Medium", reward: 0.50 },
      { task_name: "Refer a Friend", time_estimate: 2, priority: "Low", reward: 1.00 },
    ],
  };

  const { data: dailyGoal, isLoading, isError } = useQuery({
    queryKey: ['daily-goal', user?.id, today],
    queryFn: async () => {
      const res = await base44.functions.invoke('generateAIDailyGoal', {});
      return res.data.goal;
    },
    enabled: !!user,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    retryDelay: 2000,
  });

  const goal = (dailyGoal && dailyGoal.daily_goal_amount) ? dailyGoal : (isLoading ? null : fallbackGoal);

  if (!goal) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
        <CardContent className="pt-6 flex justify-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Use resolved goal
  const dailyGoalData = goal;

  const goalAmount = dailyGoalData.daily_goal_amount;
  const progressPercent = Math.min((earnedToday / goalAmount) * 100, 100);
  const remainingAmount = Math.max(goalAmount - earnedToday, 0);

  // Determine unlocked milestones
  const activeMilestones = dailyGoalData.milestone_incentives.map((m, idx) => ({
    ...m,
    unlocked: earnedToday >= m.amount,
    id: idx,
  }));

  // Calculate dynamic incentive bonus
  const isCloseToGoal = progressPercent >= 80;
  const bonusMultiplier = isCloseToGoal ? 1.25 : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Main Goal Card */}
      <Card className="bg-gradient-to-br from-purple-600 to-pink-600 border-0 text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6" />
              <CardTitle>Today's AI Goal</CardTitle>
            </div>
            {isCloseToGoal && (
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                <Flame className="w-6 h-6 text-yellow-300" />
              </motion.div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Goal Amount Display */}
          <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
            <p className="text-sm opacity-90 mb-1">Today's Target Earnings</p>
            <motion.p 
              className="text-4xl font-bold"
              key={goalAmount}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
            >
              ${goalAmount.toFixed(2)}
            </motion.p>
            <p className="text-xs opacity-75 mt-1">{dailyGoalData.rationale}</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Progress</p>
                <p className="text-xs opacity-75">${earnedToday.toFixed(2)} of ${goalAmount.toFixed(2)}</p>
              </div>
              <motion.p 
                className="text-2xl font-bold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {Math.round(progressPercent)}%
              </motion.p>
            </div>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1 }}
              className="origin-left"
            >
              <Progress value={progressPercent} className="h-3 bg-white/30" />
            </motion.div>
          </div>

          {/* Motivational Message */}
          <motion.div 
            className="bg-white/20 rounded-lg p-3 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-sm font-semibold">
              {earnedToday >= goalAmount
                ? '🎉 Goal Reached!'
                : isCloseToGoal
                ? `Almost there! ${remainingAmount.toFixed(2)} more to go`
                : dailyGoalData.motivational_message}
            </p>
          </motion.div>

          {/* Dynamic Incentive Bonus */}
          {isCloseToGoal && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-yellow-300/30 border-2 border-yellow-300 rounded-lg p-3 flex items-center gap-2"
            >
              <Gift className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-semibold">+{Math.round((bonusMultiplier - 1) * 100)}% Bonus Active!</span>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Milestone Incentives */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {activeMilestones.map((milestone) => (
          <motion.div
            key={milestone.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: milestone.id * 0.1 }}
            className={`rounded-lg p-3 border-2 transition-all ${
              milestone.unlocked
                ? 'bg-green-50 border-green-300 shadow-md'
                : 'bg-gray-50 border-gray-300'
            }`}
          >
            <div className="flex items-start gap-2">
              {milestone.unlocked ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Lock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${milestone.unlocked ? 'text-green-900' : 'text-gray-700'}`}>
                  Reach ${milestone.amount.toFixed(2)}
                </p>
                <p className={`text-xs mt-1 line-clamp-2 ${milestone.unlocked ? 'text-green-800' : 'text-gray-600'}`}>
                  {milestone.incentive}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recommended Tasks */}
      {dailyGoalData.recommended_tasks && dailyGoalData.recommended_tasks.length > 0 && (
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" />
              AI Recommended Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dailyGoalData.recommended_tasks.map((task, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">{task.task_name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">~{task.time_estimate}m • {task.priority}</p>
                  </div>
                  <motion.div whileHover={{ scale: 1.05 }}>
                    <Badge className="bg-green-600 text-white">${task.reward.toFixed(2)}</Badge>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}