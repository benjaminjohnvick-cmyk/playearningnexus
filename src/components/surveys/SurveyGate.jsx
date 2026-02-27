import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, DollarSign, TrendingUp, CheckCircle } from "lucide-react";

export default function SurveyGate({ todaysEarnings = 0, dailyGoal = 3, onGoToSurveys }) {
  const earned = Math.min(todaysEarnings, dailyGoal);
  const percentage = (earned / dailyGoal) * 100;

  const getBarColor = () => {
    if (earned >= 3) return 'bg-green-500';
    if (earned >= 2) return 'bg-green-400';
    if (earned >= 1) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-start justify-center pt-4">
      <div className="w-full">
      {/* Lock overlay */}
        <Card className="max-w-lg w-full mx-4 border-2 border-red-400 shadow-2xl bg-white">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Locked</h2>
            <p className="text-gray-600 mb-6">
              Complete <strong>$3 in surveys</strong> today to unlock the game store.
              <br />
              <span className="text-sm text-gray-500">(50/50 split — you complete $6 worth, you keep $3)</span>
            </p>

            {/* Progress meter */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Today's Earnings</span>
                <span className="font-bold">${earned.toFixed(2)} / $3.00</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  className={`${getBarColor()} h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                >
                  {percentage > 15 && (
                    <span className="text-white text-xs font-bold">{percentage.toFixed(0)}%</span>
                  )}
                </div>
              </div>
              {/* Color zones */}
              <div className="flex justify-between text-xs mt-1 text-gray-500">
                <span className="text-red-500">$0</span>
                <span className="text-yellow-500">$1</span>
                <span className="text-yellow-600">$2</span>
                <span className="text-green-600">$3 🔓</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6 text-center">
              <div className={`p-2 rounded-lg border-2 ${earned >= 0 && earned < 1 ? 'border-red-500 bg-red-50' : earned >= 1 ? 'border-gray-200 bg-gray-50' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-lg">🔴</div>
                <div className="text-xs font-medium">$0–$1</div>
              </div>
              <div className={`p-2 rounded-lg border-2 ${earned >= 1 && earned < 2 ? 'border-yellow-500 bg-yellow-50' : earned >= 2 ? 'border-gray-200 bg-gray-50' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-lg">🟡</div>
                <div className="text-xs font-medium">$1–$2</div>
              </div>
              <div className={`p-2 rounded-lg border-2 ${earned >= 2 && earned < 3 ? 'border-yellow-400 bg-yellow-50' : earned >= 3 ? 'border-green-500 bg-green-50' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-lg">🟢</div>
                <div className="text-xs font-medium">$2–$3</div>
              </div>
            </div>

            <Button
              onClick={onGoToSurveys}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 text-lg"
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Complete Surveys to Unlock
            </Button>

            <p className="text-xs text-gray-500 mt-3">
              ${(dailyGoal - earned).toFixed(2)} more needed today
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function isSurveyGoalMet(todaysEarnings = 0, dailyGoal = 3) {
  return todaysEarnings >= dailyGoal;
}