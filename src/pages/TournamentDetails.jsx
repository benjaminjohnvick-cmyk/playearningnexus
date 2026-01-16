import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Users, Calendar, Info, Award, Eye } from 'lucide-react';
import TournamentBracket from '../components/tournaments/TournamentBracket';
import TournamentMatchSpectator from '../components/tournaments/TournamentMatchSpectator';

export default function TournamentDetails() {
  const [user, setUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const tournamentId = urlParams.get('id');

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: tournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => base44.entities.Tournament.filter({ id: tournamentId }).then(t => t[0]),
    enabled: !!tournamentId
  });

  const { data: game } = useQuery({
    queryKey: ['game', tournament?.game_id],
    queryFn: () => base44.entities.Game.filter({ id: tournament.game_id }).then(g => g[0]),
    enabled: !!tournament
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['tournamentParticipants', tournamentId],
    queryFn: async () => {
      const parts = await base44.entities.TournamentParticipant.filter({ tournament_id: tournamentId }, 'seed');
      const userIds = parts.map(p => p.user_id);
      if (userIds.length === 0) return [];
      const users = await base44.entities.User.filter({ id: { $in: userIds } });
      return parts.map(p => ({ ...p, user: users.find(u => u.id === p.user_id) }));
    },
    enabled: !!tournamentId,
    refetchInterval: 10000
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['tournamentMatches', tournamentId],
    queryFn: () => base44.entities.TournamentMatch.filter({ tournament_id: tournamentId }, 'round'),
    enabled: !!tournamentId,
    refetchInterval: 5000
  });

  if (tournamentLoading || !tournament || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const statusColors = {
    registration: 'bg-green-600',
    in_progress: 'bg-blue-600',
    completed: 'bg-gray-600',
    cancelled: 'bg-red-600'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Card className="mb-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <CardContent className="p-8">
            <div className="flex items-center gap-6">
              {game?.icon_url && (
                <img src={game.icon_url} alt={game.title} className="w-24 h-24 rounded-lg" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{tournament.title}</h1>
                  <Badge className={statusColors[tournament.status]}>
                    {tournament.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-purple-100 mb-4">{tournament.description}</p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-sm text-purple-200">Participants</p>
                    <p className="text-2xl font-bold">{participants.length}/{tournament.max_participants}</p>
                  </div>
                  <div>
                    <p className="text-sm text-purple-200">Prize Pool</p>
                    <p className="text-2xl font-bold">
                      {tournament.prize_pool_type === 'real_money' ? '$' : ''}{tournament.prize_pool_amount}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-purple-200">Format</p>
                    <p className="text-xl font-bold">{tournament.bracket_type.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="bracket" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="bracket">
              <Trophy className="w-4 h-4 mr-2" />
              Bracket
            </TabsTrigger>
            <TabsTrigger value="spectate">
              <Eye className="w-4 h-4 mr-2" />
              Watch Live
            </TabsTrigger>
            <TabsTrigger value="participants">
              <Users className="w-4 h-4 mr-2" />
              Participants
            </TabsTrigger>
            <TabsTrigger value="info">
              <Info className="w-4 h-4 mr-2" />
              Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bracket">
            <TournamentBracket tournament={tournament} matches={matches} participants={participants} />
          </TabsContent>

          <TabsContent value="spectate">
            <Card>
              <CardHeader>
                <CardTitle>Live Tournament Matches</CardTitle>
              </CardHeader>
              <CardContent>
                {matches.filter(m => m.status === 'in_progress').length > 0 ? (
                  <div className="space-y-4">
                    {matches.filter(m => m.status === 'in_progress').map(match => (
                      <TournamentMatchSpectator key={match.id} match={match} tournament={tournament} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Eye className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No live matches at the moment</p>
                    <p className="text-sm mt-2">Check back when tournament is in progress</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participants">
            <Card>
              <CardHeader>
                <CardTitle>Registered Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {participants.map((participant, index) => (
                    <div key={participant.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <Avatar>
                          <AvatarImage src={participant.user?.avatar_url} />
                          <AvatarFallback>{participant.user?.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{participant.user?.full_name}</p>
                          <p className="text-xs text-gray-600">Seed #{participant.seed}</p>
                        </div>
                      </div>
                      <Badge variant={participant.status === 'winner' ? 'default' : 'outline'}>
                        {participant.status}
                      </Badge>
                    </div>
                  ))}
                  {participants.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No participants yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tournament Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Game</p>
                    <p className="font-semibold">{game?.title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Registration Period</p>
                    <p className="font-semibold">
                      {new Date(tournament.registration_start).toLocaleString()} - {new Date(tournament.registration_end).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tournament Start</p>
                    <p className="font-semibold">{new Date(tournament.start_time).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Prize Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-yellow-600" />
                        <span className="font-semibold">1st Place</span>
                      </div>
                      <span className="font-bold text-yellow-600">
                        {tournament.prize_pool_type === 'real_money' ? '$' : ''}{tournament.prize_distribution?.first || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-gray-600" />
                        <span className="font-semibold">2nd Place</span>
                      </div>
                      <span className="font-bold text-gray-600">
                        {tournament.prize_pool_type === 'real_money' ? '$' : ''}{tournament.prize_distribution?.second || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-orange-600" />
                        <span className="font-semibold">3rd Place</span>
                      </div>
                      <span className="font-bold text-orange-600">
                        {tournament.prize_pool_type === 'real_money' ? '$' : ''}{tournament.prize_distribution?.third || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {tournament.rules && (
                <Card>
                  <CardHeader>
                    <CardTitle>Rules</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 whitespace-pre-wrap">{tournament.rules}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}