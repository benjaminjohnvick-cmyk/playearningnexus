import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, CheckCircle2, TrendingUp, Target } from "lucide-react";

export default function SurveyStatsBar({ earned, dailyGoal, surveysCompleted, totalEarnings, progressPct, goalMet }) {
  const stats = [
    {
      icon: DollarSign,
      label: "Today's Earnings",
      value: `$${earned.toFixed(2)}`,
      sub: `of $${dailyGoal.toFixed(2)} goal`,
      color: goalMet ? "text-green-600" : "text-blue-600",
      bg: goalMet ? "bg-green-50" : "bg-blue-50",
    },
    {
      icon: CheckCircle2,
      label: "Surveys Today",
      value: surveysCompleted,
      sub: "completed today",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      icon: TrendingUp,
      label: "All-Time Earnings",
      value: `$${totalEarnings.toFixed(2)}`,
      sub: "lifetime total",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: Target,
      label: "Daily Progress",
      value: `${Math.min(progressPct, 100).toFixed(0)}%`,
      sub: goalMet ? "🎉 Goal met!" : "toward goal",
      color: goalMet ? "text-green-600" : "text-amber-600",
      bg: goalMet ? "bg-green-50" : "bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label} className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}