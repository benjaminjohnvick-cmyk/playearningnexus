import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TournamentBracket({ tournament, matches, participants }) {
  if (tournament.status === 'registration') {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-gray-500">Bracket will be generated when tournament starts</p>
        </CardContent>
      </Card>
    );
  }

  const rounds = Math.ceil(Math.log2(tournament.max_participants));
  const matchesByRound = {};
  
  for (let i = 1; i <= rounds; i++) {
    matchesByRound[i] = matches.filter(m => m.round === i);
  }

  const getRoundName = (round) => {
    if (round === rounds) return 'Finals';
    if (round === rounds - 1) return 'Semi-Finals';
    if (round === rounds - 2) return 'Quarter-Finals';
    return `Round ${round}`;
  };

  return (
    <div className="space-y-6">
      {Object.keys(matchesByRound).sort().map(round => (
        <Card key={round}>
          <CardHeader>
            <CardTitle>{getRoundName(parseInt(round))}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {matchesByRound[round].map(match => (
                <MatchCard key={match.id} match={match} participants={participants} />
              ))}
            </div>
            {matchesByRound[round].length === 0 && (
              <p className="text-center text-gray-500 py-4">No matches scheduled</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MatchCard({ match, participants }) {
  const [player1, setPlayer1] = useState(null);
  const [player2, setPlayer2] = useState(null);

  useEffect(() => {
    const fetchPlayers = async () => {
      if (match.participant1_id) {
        const users1 = await base44.entities.User.filter({ id: match.participant1_id });
        setPlayer1(users1[0]);
      }
      if (match.participant2_id) {
        const users2 = await base44.entities.User.filter({ id: match.participant2_id });
        setPlayer2(users2[0]);
      }
    };
    fetchPlayers();
  }, [match]);

  const statusColors = {
    pending: 'bg-gray-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500'
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-600">Match {match.match_number}</span>
        <Badge className={statusColors[match.status]}>{match.status}</Badge>
      </div>
      
      <div className="space-y-2">
        <div className={`flex items-center justify-between p-2 rounded ${match.winner_id === match.participant1_id ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
          <span className="font-medium">{player1?.full_name || 'TBD'}</span>
          <span className="font-bold">{match.participant1_score}</span>
        </div>
        
        <div className="text-center text-xs text-gray-500">VS</div>
        
        <div className={`flex items-center justify-between p-2 rounded ${match.winner_id === match.participant2_id ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
          <span className="font-medium">{player2?.full_name || 'TBD'}</span>
          <span className="font-bold">{match.participant2_score}</span>
        </div>
      </div>

      {match.scheduled_time && (
        <p className="text-xs text-gray-500 mt-3">
          {new Date(match.scheduled_time).toLocaleString()}
        </p>
      )}
    </div>
  );
}