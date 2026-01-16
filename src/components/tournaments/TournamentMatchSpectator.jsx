import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Eye, Trophy, Zap, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TournamentMatchSpectator({ match, tournament }) {
  const [liveUpdates, setLiveUpdates] = useState([]);

  const { data: player1 } = useQuery({
    queryKey: ['player', match.participant1_id],
    queryFn: () => base44.entities.User.filter({ id: match.participant1_id }).then(u => u[0]),
    enabled: !!match.participant1_id
  });

  const { data: player2 } = useQuery({
    queryKey: ['player', match.participant2_id],
    queryFn: () => base44.entities.User.filter({ id: match.participant2_id }).then(u => u[0]),
    enabled: !!match.participant2_id
  });

  const { data: matchData, refetch } = useQuery({
    queryKey: ['matchLive', match.id],
    queryFn: () => base44.entities.TournamentMatch.filter({ id: match.id }).then(m => m[0]),
    refetchInterval: 2000
  });

  useEffect(() => {
    if (!match) return;

    const unsubscribe = base44.entities.TournamentMatch.subscribe((event) => {
      if (event.data?.id === match.id && event.type === 'update') {
        setLiveUpdates(prev => [
          {
            timestamp: Date.now(),
            message: `Score update: ${event.data.participant1_score} - ${event.data.participant2_score}`
          },
          ...prev.slice(0, 4)
        ]);
        refetch();
      }
    });

    return unsubscribe;
  }, [match?.id]);

  if (!matchData || !player1 || !player2) return null;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-purple-600 to-pink-600 text-white">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span>{tournament.title}</span>
            </div>
            <Badge className="bg-white/20">
              {matchData.status === 'in_progress' ? 'LIVE' : matchData.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Player 1 */}
            <div className="text-center">
              <Avatar className="w-16 h-16 mx-auto mb-2">
                <AvatarImage src={player1.avatar_url} />
                <AvatarFallback>{player1.full_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="font-bold">{player1.full_name}</p>
              <div className="text-3xl font-bold mt-2">{matchData.participant1_score}</div>
            </div>

            {/* VS */}
            <div className="text-center">
              <div className="text-2xl font-bold">VS</div>
              {matchData.status === 'in_progress' && (
                <Badge className="mt-2 bg-red-600 animate-pulse">
                  <Zap className="w-3 h-3 mr-1" />
                  LIVE
                </Badge>
              )}
            </div>

            {/* Player 2 */}
            <div className="text-center">
              <Avatar className="w-16 h-16 mx-auto mb-2">
                <AvatarImage src={player2.avatar_url} />
                <AvatarFallback>{player2.full_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="font-bold">{player2.full_name}</p>
              <div className="text-3xl font-bold mt-2">{matchData.participant2_score}</div>
            </div>
          </div>

          {matchData.status === 'completed' && matchData.winner_id && (
            <div className="mt-4 p-3 bg-yellow-400 text-gray-900 rounded-lg text-center font-bold">
              Winner: {matchData.winner_id === player1.id ? player1.full_name : player2.full_name}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Updates */}
      {liveUpdates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              Live Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {liveUpdates.map((update, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-2 bg-gray-50 rounded-lg text-sm"
                >
                  <span className="text-gray-600">
                    {new Date(update.timestamp).toLocaleTimeString()} - {update.message}
                  </span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spectator Options */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-4 h-4" />
              <span className="text-sm">Spectating this match</span>
            </div>
            <Button size="sm" className="bg-gradient-to-r from-purple-600 to-pink-600">
              <Eye className="w-4 h-4 mr-2" />
              Watch Live
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}