import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Target, TrendingUp } from "lucide-react";

export default function DailyEarningsMeter({ todaysEarnings = 0, dailyGoal = 8 }) {
  const percentage = Math.min((todaysEarnings / dailyGoal) * 100, 100);
  
  // Color progression: red (0-2), orange (2-4), yellow (4-6), green (6-8)
  const getColor = () => {
    if (todaysEarnings >= 6) return 'from-green-500 to-green-600';
    if (todaysEarnings >= 4) return 'from-yellow-500 to-yellow-600';
    if (todaysEarnings >= 2) return 'from-orange-500 to-orange-600';
    return 'from-red-500 to-red-600';
  };

  const getTextColor = () => {
    if (todaysEarnings >= 6) return 'text-green-600';
    if (todaysEarnings >= 4) return 'text-yellow-600';
    if (todaysEarnings >= 2) return 'text-orange-600';
    return 'text-red-600';
  };

  const getMeterColor = () => {
    if (todaysEarnings >= 6) return 'bg-green-600';
    if (todaysEarnings >= 4) return 'bg-yellow-600';
    if (todaysEarnings >= 2) return 'bg-orange-500';
    return 'bg-red-600';
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Daily Earnings Goal</h3>
            <p className="text-sm text-gray-600">Premium Member</p>
          </div>
          <Badge className={`bg-gradient-to-r ${getColor()}`}>
            ${todaysEarnings.toFixed(2)} / ${dailyGoal}
          </Badge>
        </div>

        {/* Progress Bar with Arrow */}
        <div className="mb-4 relative">
          <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden relative">
            <div
              className={`${getMeterColor()} h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
              style={{ width: `${percentage}%` }}
            >
              {percentage > 10 && (
                <span className="text-white text-xs font-bold">
                  {percentage.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          {/* Moving Arrow indicator */}
          <div
            className="absolute -top-8 transform -translate-x-1/2 transition-all duration-500"
            style={{ left: `${percentage}%` }}
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl animate-bounce">⬇️</span>
              <span className="text-xs font-bold text-gray-700">${todaysEarnings.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Color indicators */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className={`p-2 rounded-lg ${todaysEarnings >= 2 ? 'bg-red-100 border-2 border-red-500' : 'bg-gray-100'}`}>
            <p className="text-xs text-center font-medium">$0–$2</p>
            <p className="text-center text-lg">🔴</p>
          </div>
          <div className={`p-2 rounded-lg ${todaysEarnings >= 4 ? 'bg-orange-100 border-2 border-orange-500' : 'bg-gray-100'}`}>
            <p className="text-xs text-center font-medium">$2–$4</p>
            <p className="text-center text-lg">🟠</p>
          </div>
          <div className={`p-2 rounded-lg ${todaysEarnings >= 6 ? 'bg-yellow-100 border-2 border-yellow-500' : 'bg-gray-100'}`}>
            <p className="text-xs text-center font-medium">$4–$6</p>
            <p className="text-center text-lg">🟡</p>
          </div>
          <div className={`p-2 rounded-lg ${todaysEarnings >= 8 ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100'}`}>
            <p className="text-xs text-center font-medium">$6–$8 🔓</p>
            <p className="text-center text-lg">🟢</p>
          </div>
        </div>

        {/* Status message */}
        <div className={`p-3 rounded-lg ${todaysEarnings >= dailyGoal ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
          <div className="flex items-center gap-2">
            {todaysEarnings >= dailyGoal ? (
              <>
                <Target className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  Goal achieved! Keep it up for premium benefits!
                </p>
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <p className="text-sm font-medium text-blue-800">
                  ${(dailyGoal - todaysEarnings).toFixed(2)} more to reach your daily goal
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-xs font-medium text-purple-800 mb-1">📱 Premium Benefits</p>
          <p className="text-xs text-gray-600">
            • Daily SMS reminders to stay on track<br />
            • Earn $8 total in PPC ads to unlock games & purchases<br />
            • You keep $4 · GamerGain keeps $4 (50/50 split)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}