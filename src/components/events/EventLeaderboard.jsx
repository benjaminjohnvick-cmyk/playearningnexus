import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Medal, Award, Crown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function EventLeaderboard({ eventId }) {
  const { data: leaderboard = [] } = useQuery({
    queryKey: ['eventLeaderboard', eventId],
    queryFn: async () => {
      // Get all game engagements during event period
      const event = await base44.entities.LiveEvent.filter({ id: eventId });
      if (!event[0]) return [];

      const engagements = await base44.entities.GameEngagement.filter({
        game_id: event[0].game_id,
        updated_date: { $gte: event[0].start_time }
      });

      // Aggregate by user
      const userScores = {};
      for (const eng of engagements) {
        if (!userScores[eng.user_id]) {
          userScores[eng.user_id] = {
            user_id: eng.user_id,
            score: 0,
            sessions: 0,
            total_time: 0
          };
        }
        userScores[eng.user_id].score += eng.score_achieved || 0;
        userScores[eng.user_id].sessions += 1;
        userScores[eng.user_id].total_time += eng.time_spent || 0;
      }

      const sortedUsers = Object.values(userScores).sort((a, b) => b.score - a.score);

      // Fetch user details
      const userIds = sortedUsers.map(u => u.user_id);
      const users = await base44.entities.User.filter({ id: { $in: userIds } });

      return sortedUsers.map(score => ({
        ...score,
        user: users.find(u => u.id === score.user_id)
      }));
    },
    enabled: !!eventId,
    refetchInterval: 10000
  });

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-orange-600" />;
    return <Trophy className="w-5 h-5 text-gray-300" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-600" />
          Event Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No participants yet
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((entry, idx) => (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  idx < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center w-10">
                  {getRankIcon(idx + 1)}
                </div>
                
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-purple-100 text-purple-700">
                    {entry.user?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <p className="font-semibold">{entry.user?.full_name || 'Anonymous'}</p>
                  <p className="text-xs text-gray-500">
                    {entry.sessions} sessions • {Math.round(entry.total_time)}m played
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-600">
                    {entry.score.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">points</p>
                </div>

                {idx === 0 && (
                  <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500">
                    Champion
                  </Badge>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}