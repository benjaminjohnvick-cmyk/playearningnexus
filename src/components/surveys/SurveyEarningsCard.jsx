import React from 'react';
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function SurveyEarningsCard({ totalEarnings, todayEarnings, surveysCompleted }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6 border-0 shadow-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-emerald-100 text-sm mb-1">Your Total Earnings</p>
            <p className="text-4xl font-bold">${totalEarnings.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
            <DollarSign className="w-8 h-8" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
          <div>
            <div className="flex items-center gap-2 text-emerald-100 text-sm mb-1">
              <Calendar className="w-4 h-4" />
              <span>Today</span>
            </div>
            <p className="text-2xl font-bold">${todayEarnings.toFixed(2)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-emerald-100 text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Completed</span>
            </div>
            <p className="text-2xl font-bold">{surveysCompleted}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}