import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Target, TrendingUp, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DailyEarningsProgressBar({ earned = 0, goal = 8, surveysCompleted = 0, surveyMinimum = 4 }) {
  const currentEarned = Number(earned) || 0;
  const currentSurveys = Number(surveysCompleted) || 0;
  const userShare = currentEarned * 0.5;
  const platformShare = currentEarned * 0.5;
  const userGoal = goal * 0.5;

  const pct = Math.min((currentEarned / goal) * 100, 100);
  const surveyPct = Math.min((currentSurveys / surveyMinimum) * 100, 100);
  const remaining = Math.max(goal - currentEarned, 0).toFixed(2);
  const surveysRemaining = Math.max(surveyMinimum - currentSurveys, 0);
  const isComplete = currentEarned >= goal;
  const surveyGoalMet = currentSurveys >= surveyMinimum;

  return (
    <Card className={`overflow-hidden border-2 ${isComplete ? 'border-green-400' : 'border-red-200'} shadow-lg`}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={`px-5 py-3 flex items-center justify-between ${isComplete ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-600 to-red-700'} text-white`}>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            <span className="font-bold text-sm">Daily $8 Survey Earnings Requirement</span>
          </div>
          <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
            50/50 Split
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Main Progress Display */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-gray-900">
                ${currentEarned.toFixed(2)}
                <span className="text-lg text-gray-400 font-medium"> / ${goal.toFixed(2)}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isComplete ? '✅ Daily requirement complete!' : `$${remaining} remaining to unlock games`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-gray-900">{pct.toFixed(0)}%</p>
              <p className="text-xs text-gray-400">complete</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-6 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 ${isComplete ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}
              style={{ width: `${Math.max(pct, 3)}%` }}
            >
              {pct > 15 && (
                <span className="text-[10px] font-bold text-white">
                  ${currentEarned.toFixed(2)}
                </span>
              )}
            </div>
            {/* 50% midpoint marker */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-gray-300" style={{ left: '50%' }} />
          </div>

          {/* 4-Survey Minimum Tracker */}
          <div className={`rounded-xl border-2 p-4 ${surveyGoalMet ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className={`w-4 h-4 ${surveyGoalMet ? 'text-green-600' : 'text-amber-600'}`} />
                <span className="text-sm font-bold text-gray-800">Daily Survey Minimum</span>
              </div>
              <span className="text-sm font-black text-gray-900">
                {currentSurveys} / {surveyMinimum}
              </span>
            </div>
            <div className="relative h-4 rounded-full bg-white overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${surveyGoalMet ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
                style={{ width: `${Math.max(surveyPct, 3)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px]">
              <span className={surveyGoalMet ? 'text-green-600 font-bold' : 'text-amber-600'}>
                {surveyGoalMet ? '✅ Survey minimum reached!' : `${surveysRemaining} survey${surveysRemaining !== 1 ? 's' : ''} remaining`}
              </span>
              <span className="text-gray-400">~$2.00 per survey</span>
            </div>
          </div>

          {/* Split Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-bold text-green-700">Your Share (50%)</span>
              </div>
              <p className="text-xl font-black text-green-700">${userShare.toFixed(2)}</p>
              <p className="text-[10px] text-gray-500">of ${userGoal.toFixed(2)} goal</p>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-bold text-blue-700">Platform Share (50%)</span>
              </div>
              <p className="text-xl font-black text-blue-700">${platformShare.toFixed(2)}</p>
              <p className="text-[10px] text-gray-500">of ${userGoal.toFixed(2)} goal</p>
            </div>
          </div>

          {/* Action Button */}
          {!isComplete && (
            <Link to="/Surveys" className="block">
              <Button className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold h-10">
                <DollarSign className="w-4 h-4 mr-1" />
                Complete Surveys to Earn ${remaining}
              </Button>
            </Link>
          )}

          {/* Milestone markers */}
          <div className="flex justify-between text-[10px] text-gray-400 px-1">
            <span>$0</span>
            <span className={currentEarned >= 2 ? 'text-green-600 font-bold' : ''}>$2</span>
            <span className={currentEarned >= 4 ? 'text-green-600 font-bold' : ''}>$4 (50%)</span>
            <span className={currentEarned >= 6 ? 'text-green-600 font-bold' : ''}>$6</span>
            <span className={isComplete ? 'text-green-600 font-bold' : ''}>$8 ✅</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}