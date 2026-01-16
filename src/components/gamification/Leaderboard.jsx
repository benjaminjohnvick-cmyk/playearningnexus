import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, TrendingDown, Medal, Crown, Flame } from "lucide-react";
import { motion } from "framer-motion";

export default function Leaderboard({ entries, currentUserId }) {
  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);
  const currentUserEntry = entries.find(e => e.user_id === currentUserId);

  const getRankIcon = (rank) => {
    switch(rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400" />;
      case 3: return <Medal className="w-6 h-6 text-amber-600" />;
      default: return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-8 h-8 text-purple-600" />
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Top Earners</h3>
            <p className="text-sm text-gray-600">Weekly leaderboard - compete for the top spot!</p>
          </div>
        </div>

        {currentUserEntry && (
          <Card className="p-4 mb-4 bg-gradient-to-r from-red-100 to-pink-100 border-2 border-red-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-red-600">#{currentUserEntry.rank}</div>
                <div>
                  <p className="font-bold text-gray-900">Your Rank</p>
                  <p className="text-sm text-gray-600">${(currentUserEntry.total_earnings || 0).toFixed(2)} earned</p>
                </div>
              </div>
              {currentUserEntry.rank_change !== 0 && (
                <Badge className={currentUserEntry.rank_change > 0 ? 'bg-green-600' : 'bg-red-600'}>
                  {currentUserEntry.rank_change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {Math.abs(currentUserEntry.rank_change)}
                </Badge>
              )}
            </div>
          </Card>
        )}

        <div className="space-y-3">
          {topThree.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className={`p-4 ${
                entry.rank === 1 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300' :
                entry.rank === 2 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-300' :
                'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getRankIcon(entry.rank)}
                    <div>
                      <p className="font-bold text-lg">{entry.user_name || `User ${entry.user_id.slice(0, 8)}`}</p>
                      <div className="flex gap-3 text-sm text-gray-600">
                        <span>${(entry.total_earnings || 0).toFixed(2)}</span>
                        <span>•</span>
                        <span>{entry.surveys_completed} surveys</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-red-500" />
                          {entry.current_streak}d
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-purple-600 text-white flex items-center gap-1">
                    {entry.achievements_count}
                    <Trophy className="w-3 h-3" />
                  </Badge>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {rest.length > 0 && (
          <div className="mt-4 space-y-2">
            {rest.slice(0, 7).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-600 w-8">#{entry.rank}</span>
                  <span className="font-medium text-gray-900">{entry.user_name || `User ${entry.user_id.slice(0, 8)}`}</span>
                </div>
                <span className="text-sm font-bold text-green-600">${(entry.total_earnings || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}