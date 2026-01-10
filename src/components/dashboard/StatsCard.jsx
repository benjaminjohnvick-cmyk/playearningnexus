import React from 'react';
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function StatsCard({ icon: Icon, label, value, trend, color = "blue" }) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    green: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    purple: "from-purple-500 to-purple-600"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="relative overflow-hidden border-0 shadow-lg">
        <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} opacity-5`} />
        <div className="relative p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {trend && (
                <p className="text-xs text-green-600 font-medium mt-2">{trend}</p>
              )}
            </div>
            <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}