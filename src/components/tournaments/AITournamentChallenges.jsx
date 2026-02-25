import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Clock, Zap, Trophy, CheckCircle, XCircle } from 'lucide-react';

export default function AITournamentChallenges({ tournamentId, participantId }) {
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['tournament-challenges', tournamentId, participantId],
    queryFn: () => base44.entities.TournamentChallenge.filter({ 
      tournament_id: tournamentId,
      participant_id: participantId
    }),
    enabled: !!tournamentId && !!participantId,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-orange-100 text-orange-800',
    expert: 'bg-red-100 text-red-800'
  };

  const typeIcons = {
    time_based: Clock,
    score_based: Trophy,
    strategy_based: Target,
    restriction: XCircle,
    bonus_objective: Zap
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (challenges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            AI Challenges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">No challenges assigned yet. They will appear during matches!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-600" />
          AI-Generated Challenges
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeChallenges.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Active Challenges</h3>
            {activeChallenges.map(challenge => {
              const Icon = typeIcons[challenge.challenge_type] || Target;
              const progress = challenge.target_value 
                ? (challenge.current_value / challenge.target_value) * 100 
                : 0;

              return (
                <div key={challenge.id} className="p-4 border-2 border-purple-200 rounded-lg bg-gradient-to-r from-purple-50 to-white">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-purple-600" />
                      <h4 className="font-semibold text-gray-900">{challenge.challenge_title}</h4>
                    </div>
                    <Badge className={difficultyColors[challenge.difficulty]}>
                      {challenge.difficulty}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3">{challenge.challenge_description}</p>

                  {challenge.target_value && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{challenge.current_value}/{challenge.target_value}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex gap-3">
                      {challenge.bonus_points > 0 && (
                        <span className="text-purple-600 font-medium">
                          +{challenge.bonus_points} pts
                        </span>
                      )}
                      {challenge.bonus_prize > 0 && (
                        <span className="text-green-600 font-medium">
                          +${challenge.bonus_prize}
                        </span>
                      )}
                    </div>
                    {challenge.expires_at && (
                      <span className="text-xs text-gray-500">
                        Expires: {new Date(challenge.expires_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {completedChallenges.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Completed Challenges
            </h3>
            {completedChallenges.map(challenge => {
              const Icon = typeIcons[challenge.challenge_type] || Target;
              return (
                <div key={challenge.id} className="p-3 border rounded-lg bg-green-50 opacity-75">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-green-600" />
                      <h4 className="font-medium text-gray-900">{challenge.challenge_title}</h4>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex gap-2 text-sm">
                      {challenge.bonus_points > 0 && (
                        <Badge className="bg-purple-600">+{challenge.bonus_points} pts</Badge>
                      )}
                      {challenge.bonus_prize > 0 && (
                        <Badge className="bg-green-600">+${challenge.bonus_prize}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}