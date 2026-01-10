import React from 'react';
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, CheckCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function SurveyProgress({ dailyGoal = 2, currentEarnings = 0, todayCompleted = false }) {
  const progress = (currentEarnings / dailyGoal) * 100;
  
  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Daily Survey Goal</h3>
              <p className="text-sm text-white/90">Complete to unlock games</p>
            </div>
          </div>
          {todayCompleted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              <CheckCircle className="w-8 h-8 text-white" />
            </motion.div>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/90">Progress</span>
            <span className="font-bold">${currentEarnings.toFixed(2)} / ${dailyGoal.toFixed(2)}</span>
          </div>
          <Progress value={progress} className="h-3 bg-white/20" />
        </div>
        
        {!todayCompleted && (
          <div className="mt-4 flex items-center gap-2 text-sm text-white/90">
            <Clock className="w-4 h-4" />
            <span>${(dailyGoal - currentEarnings).toFixed(2)} remaining for today</span>
          </div>
        )}
      </div>
    </Card>
  );
}