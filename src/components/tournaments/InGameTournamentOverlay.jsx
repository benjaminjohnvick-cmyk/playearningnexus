import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InGameTournamentOverlay({ game, user }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMatch, setActiveMatch] = useState(null);

  const { data: userTournaments = [] } = useQuery({
    queryKey: ['userActiveTournaments', user?.id, game?.id],
    queryFn: async () => {
      const participants = await base44.entities.TournamentParticipant.filter({
        user_id: user.id,
        status: { $in: ['registered', 'checked_in'] }
      });
      
      if (participants.length === 0) return [];
      
      const tournaments = await base44.entities.Tournament.filter({
        id: { $in: participants.map(p => p.tournament_id) },
        game_id: game.id,
        status: { $in: ['registration', 'in_progress'] }
      });
      
      return tournaments;
    },
    enabled: !!user && !!game,
    refetchInterval: 10000
  });

  const { data: currentMatch } = useQuery({
    queryKey: ['userCurrentMatch', user?.id, userTournaments],
    queryFn: async () => {
      if (userTournaments.length === 0) return null;
      
      for (const tournament of userTournaments) {
        const matches = await base44.entities.TournamentMatch.filter({
          tournament_id: tournament.id,
          status: { $in: ['pending', 'in_progress'] },
          $or: [
            { participant1_id: user.id },
            { participant2_id: user.id }
          ]
        });
        
        if (matches.length > 0) {
          const match = matches[0];
          const opponent1 = await base44.entities.User.filter({ id: match.participant1_id });
          const opponent2 = await base44.entities.User.filter({ id: match.participant2_id });
          return {
            ...match,
            tournament,
            opponent: opponent1[0]?.id === user.id ? opponent2[0] : opponent1[0]
          };
        }
      }
      return null;
    },
    enabled: userTournaments.length > 0,
    refetchInterval: 5000
  });

  useEffect(() => {
    if (currentMatch) {
      setActiveMatch(currentMatch);
    }
  }, [currentMatch]);

  if (userTournaments.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-20 right-4 z-50"
    >
      <Card className="bg-gradient-to-br from-purple-600 to-pink-600 text-white border-2 border-white/20 shadow-2xl w-80">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="font-bold">Tournament Active</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-white hover:bg-white/20"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3"
              >
                {userTournaments.map(tournament => (
                  <div key={tournament.id} className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                    <p className="font-bold text-sm mb-1">{tournament.title}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="bg-white/20">
                        {tournament.status.replace('_', ' ')}
                      </Badge>
                      <span>{tournament.current_participants}/{tournament.max_participants} players</span>
                    </div>
                  </div>
                ))}

                {activeMatch && (
                  <div className="p-4 bg-white/20 rounded-lg border-2 border-yellow-400">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="font-bold text-sm">Your Match</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-white/10 rounded">
                        <span className="font-medium text-sm">{user.full_name}</span>
                        <span className="font-bold text-lg">{activeMatch.participant1_id === user.id ? activeMatch.participant1_score : activeMatch.participant2_score}</span>
                      </div>
                      
                      <div className="text-center text-xs font-bold">VS</div>
                      
                      <div className="flex items-center justify-between p-2 bg-white/10 rounded">
                        <span className="font-medium text-sm">{activeMatch.opponent?.full_name || 'TBD'}</span>
                        <span className="font-bold text-lg">{activeMatch.participant1_id === user.id ? activeMatch.participant2_score : activeMatch.participant1_score}</span>
                      </div>
                    </div>

                    {activeMatch.status === 'pending' && activeMatch.scheduled_time && (
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3" />
                        Starts: {new Date(activeMatch.scheduled_time).toLocaleTimeString()}
                      </div>
                    )}

                    {activeMatch.status === 'in_progress' && (
                      <Badge className="mt-3 bg-green-500 w-full justify-center">
                        Match In Progress
                      </Badge>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!isExpanded && userTournaments.length > 0 && (
            <div className="text-sm text-white/80">
              {userTournaments.length} active tournament{userTournaments.length > 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}