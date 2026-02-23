import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Star } from "lucide-react";

export default function PointsDisplay({ user }) {
  const pointsToNextLevel = (user.level * 1000) - (user.points || 0);
  const progressPercentage = ((user.points || 0) % 1000) / 10;

  const getLevelBadge = (level) => {
    if (level >= 10) return { name: 'Diamond', color: 'bg-blue-600', icon: '💎' };
    if (level >= 5) return { name: 'Gold', color: 'bg-yellow-600', icon: '🥇' };
    if (level >= 3) return { name: 'Silver', color: 'bg-gray-400', icon: '🥈' };
    return { name: 'Bronze', color: 'bg-orange-600', icon: '🥉' };
  };

  const badge = getLevelBadge(user.level || 1);

  return (
    <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full ${badge.color} flex items-center justify-center text-2xl`}>
            {badge.icon}
          </div>
          <div>
            <p className="text-sm text-gray-600">Level {user.level || 1}</p>
            <p className="font-bold text-lg text-gray-900">{badge.name} Member</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Points</p>
          <p className="text-2xl font-bold text-purple-600">{user.points || 0}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Progress to Level {(user.level || 1) + 1}</span>
          <span className="font-medium text-gray-900">{pointsToNextLevel} points to go</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
        <div className="text-center">
          <Trophy className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
          <p className="text-xs text-gray-600">Rank</p>
          <p className="font-bold text-sm">#{user.rank || 'N/A'}</p>
        </div>
        <div className="text-center">
          <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <p className="text-xs text-gray-600">Earnings</p>
          <p className="font-bold text-sm">${(user.total_earnings || 0).toFixed(0)}</p>
        </div>
        <div className="text-center">
          <Star className="w-5 h-5 text-purple-600 mx-auto mb-1" />
          <p className="text-xs text-gray-600">Badges</p>
          <p className="font-bold text-sm">{user.badge_count || 0}</p>
        </div>
      </div>
    </Card>
  );
}