import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame } from 'lucide-react';

export default function LiveLeaderboard({ tournamentId }) {
  const { data: leaderboard = [] } = useQuery({
    queryKey: ['tournamentLeaderboard', tournamentId],
    queryFn: async () => {
      const res = await base44.entities.TournamentLeaderboard.filter({ tournament_id: tournamentId });
      return res.sort((a, b) => {
        // Primary: wins
        if (b.wins !== a.wins) return b.wins - a.wins;
        // Secondary: win streak
        if (b.streak !== a.streak) return b.streak - a.streak;
        // Tertiary: total score
        return b.total_score - a.total_score;
      });
    },
    refetchInterval: 3000, // Real-time updates
  });

  const medalEmojis = ['🥇', '🥈', '🥉'];

  return (
    <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-600" />
          Live Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {leaderboard.slice(0, 10).map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                idx < 3 ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-2xl font-bold text-gray-400 w-8 text-center">
                  {medalEmojis[idx] || `#${idx + 1}`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{entry.user_name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    {entry.streak > 0 && (
                      <Badge className="bg-orange-100 text-orange-800 text-xs flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5" /> {entry.streak} streak
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0 text-right">
                <div>
                  <p className="text-lg font-bold text-purple-600">{entry.wins}W</p>
                  <p className="text-xs text-gray-500">{entry.losses || 0}L</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700">{entry.total_score}</p>
                  <p className="text-xs text-gray-500">pts</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}