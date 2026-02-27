import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Flame, Gift, CheckCircle, Clock, Star, Zap } from 'lucide-react';
import { toast } from 'sonner';

const DAILY_GOALS = [
  { id: 'complete_survey',    label: 'Complete a Survey',    points: 100, icon: '📋', action: 'survey' },
  { id: 'refer_someone',      label: 'Share a Referral Link',points: 50,  icon: '🔗', action: 'referral' },
  { id: 'earn_dollar',        label: 'Earn $1 Today',        points: 75,  icon: '💵', action: 'earn' },
  { id: 'hit_daily_goal',     label: 'Hit Your $3 Daily Goal',points: 150,icon: '🎯', action: 'goal' },
  { id: 'login',              label: 'Daily Login',          points: 25,  icon: '✅', action: 'login' },
];

export default function DailyGoalSystem({ user, todayEarnings = 0, todaySurveys = 0, referrals = [] }) {
  const today = new Date().toISOString().split('T')[0];

  // Determine completed goals based on available data
  const completedGoals = DAILY_GOALS.filter(g => {
    if (g.action === 'survey')   return todaySurveys >= 1;
    if (g.action === 'earn')     return todayEarnings >= 1;
    if (g.action === 'goal')     return todayEarnings >= 3;
    if (g.action === 'login')    return true; // They're here
    if (g.action === 'referral') return referrals.length > 0;
    return false;
  });

  const totalDailyPoints = completedGoals.reduce((s, g) => s + g.points, 0);
  const maxDailyPoints = DAILY_GOALS.reduce((s, g) => s + g.points, 0);
  const progress = Math.round((completedGoals.length / DAILY_GOALS.length) * 100);
  const allDone = completedGoals.length === DAILY_GOALS.length;

  return (
    <Card className={`border-2 ${allDone ? 'border-green-300 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className={`w-5 h-5 ${allDone ? 'text-green-600' : 'text-orange-600'}`} />
            <span className="text-base">Daily Goals</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={allDone ? 'bg-green-600' : 'bg-orange-500'}>
              {completedGoals.length}/{DAILY_GOALS.length} done
            </Badge>
            <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50">
              +{totalDailyPoints} pts
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Today's progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Goals list */}
        <div className="space-y-2">
          {DAILY_GOALS.map((goal) => {
            const done = completedGoals.some(g => g.id === goal.id);
            return (
              <div
                key={goal.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  done ? 'bg-white border-green-200' : 'bg-white/60 border-gray-100'
                }`}
              >
                <span className="text-xl flex-shrink-0">{goal.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {goal.label}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold text-yellow-600">+{goal.points}</span>
                  {done
                    ? <CheckCircle className="w-5 h-5 text-green-500" />
                    : <Clock className="w-5 h-5 text-gray-300" />
                  }
                </div>
              </div>
            );
          })}
        </div>

        {allDone && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-4 p-3 bg-green-100 border border-green-300 rounded-xl text-center"
          >
            <p className="font-bold text-green-700">🎉 All daily goals completed!</p>
            <p className="text-sm text-green-600">+{maxDailyPoints} bonus points earned today</p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}