import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, Zap, Star } from 'lucide-react';

export default function DailyGoalProgress({ earned = 0, goal = 3, surveysToday = 0 }) {
  const pct = Math.min(100, (earned / goal) * 100);
  const goalMet = earned >= goal;

  const getColor = () => {
    if (goalMet) return 'text-green-600';
    if (earned >= 2) return 'text-yellow-600';
    if (earned >= 1) return 'text-orange-500';
    return 'text-red-500';
  };

  const getBarClass = () => {
    if (goalMet) return 'bg-green-500';
    if (earned >= 2) return 'bg-yellow-500';
    if (earned >= 1) return 'bg-orange-400';
    return 'bg-red-400';
  };

  return (
    <Card className={`border-2 ${goalMet ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className={`w-5 h-5 ${getColor()}`} />
            <span className="font-semibold text-gray-800">Daily Goal</span>
          </div>
          <div className="flex items-center gap-2">
            {goalMet && <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✓ UNLOCKED</span>}
            <span className={`text-lg font-bold ${getColor()}`}>${earned.toFixed(2)} / ${goal.toFixed(2)}</span>
          </div>
        </div>

        {/* Custom progress bar */}
        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarClass()}`}
            style={{ width: `${pct}%` }}
          />
          {/* Milestone markers */}
          {[33, 66].map(mark => (
            <div key={mark} className="absolute top-0 bottom-0 w-0.5 bg-white opacity-60" style={{ left: `${mark}%` }} />
          ))}
        </div>

        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>$0</span>
          <span className={earned >= 1 ? 'text-orange-500 font-medium' : ''}>$1</span>
          <span className={earned >= 2 ? 'text-yellow-500 font-medium' : ''}>$2</span>
          <span className={goalMet ? 'text-green-600 font-bold' : ''}>$3 🔓</span>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-blue-500" />
            <span>{surveysToday} surveys today</span>
          </div>
          {!goalMet && (
            <span>${(goal - earned).toFixed(2)} more to unlock store</span>
          )}
          {goalMet && (
            <div className="flex items-center gap-1 text-green-600 font-medium">
              <Star className="w-3 h-3" />
              <span>+15 pts earned!</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}