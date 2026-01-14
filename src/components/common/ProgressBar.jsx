import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function ProgressBar({ 
  current, 
  max, 
  label, 
  color = "red", 
  showPercentage = true,
  animated = true,
  size = "md"
}) {
  const percentage = Math.min((current / max) * 100, 100);
  
  const colorClasses = {
    red: "from-red-500 to-red-600",
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
    yellow: "from-yellow-500 to-yellow-600",
    pink: "from-pink-500 to-pink-600"
  };

  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4"
  };

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm font-bold text-gray-900">
              {current}/{max} ({percentage.toFixed(0)}%)
            </span>
          )}
        </div>
      )}
      <div className={cn("w-full bg-gray-200 rounded-full overflow-hidden", sizeClasses[size])}>
        {animated ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn("h-full bg-gradient-to-r rounded-full", colorClasses[color])}
          />
        ) : (
          <div
            style={{ width: `${percentage}%` }}
            className={cn("h-full bg-gradient-to-r rounded-full", colorClasses[color])}
          />
        )}
      </div>
    </div>
  );
}