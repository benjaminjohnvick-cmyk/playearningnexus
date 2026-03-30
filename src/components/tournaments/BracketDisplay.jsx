import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Zap } from 'lucide-react';

export default function BracketDisplay({ tournamentId }) {
  const { data: matches = [] } = useQuery({
    queryKey: ['tournamentMatches', tournamentId],
    queryFn: async () => {
      const res = await base44.entities.TournamentMatch.filter({ tournament_id: tournamentId });
      return res.sort((a, b) => a.round_number - b.round_number || a.match_number - b.match_number);
    },
    refetchInterval: 5000, // Real-time updates
  });

  const rounds = {};
  matches.forEach(m => {
    if (!rounds[m.round_number]) rounds[m.round_number] = [];
    rounds[m.round_number].push(m);
  });

  const roundLabels = {
    1: 'Round of ' + (matches.filter(m => m.round_number === 1).length * 2),
    2: 'Semifinals',
    3: 'Finals',
  };

  return (
    <div className="space-y-6 overflow-x-auto">
      <div className="flex gap-6 pb-4 min-w-max">
        {Object.keys(rounds)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map((roundNum) => (
            <div key={roundNum} className="flex-shrink-0 space-y-3">
              <h3 className="text-sm font-bold text-gray-700 text-center">
                {roundLabels[roundNum] || `Round ${roundNum}`}
              </h3>
              <div className="space-y-2">
                {rounds[roundNum].map((match, idx) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className={`w-72 border-2 ${
                      match.status === 'completed' ? 'border-green-300 bg-green-50' :
                      match.is_live ? 'border-red-400 bg-red-50 animate-pulse' :
                      'border-gray-300'
                    }`}>
                      <CardContent className="p-3">
                        {/* Player 1 */}
                        <div className={`flex justify-between items-center p-2 rounded mb-2 ${
                          match.winner_id === match.player1_id ? 'bg-green-200 font-bold' : 'bg-gray-100'
                        }`}>
                          <span className="text-sm truncate">{match.player1_name || 'TBD'}</span>
                          <span className="text-sm font-bold ml-2">{match.player1_score || '-'}</span>
                        </div>

                        {/* Divider */}
                        <div className="border-t-2 border-gray-300 my-1" />

                        {/* Player 2 */}
                        <div className={`flex justify-between items-center p-2 rounded mb-2 ${
                          match.winner_id === match.player2_id ? 'bg-green-200 font-bold' : 'bg-gray-100'
                        }`}>
                          <span className="text-sm truncate">{match.player2_name || 'TBD'}</span>
                          <span className="text-sm font-bold ml-2">{match.player2_score || '-'}</span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center justify-between mt-2">
                          {match.is_live && (
                            <Badge className="bg-red-600 text-white text-xs flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" /> LIVE
                            </Badge>
                          )}
                          <Badge className={`text-xs ${
                            match.status === 'completed' ? 'bg-green-600' :
                            match.status === 'in_progress' ? 'bg-blue-600' :
                            'bg-gray-400'
                          } text-white`}>
                            {match.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}