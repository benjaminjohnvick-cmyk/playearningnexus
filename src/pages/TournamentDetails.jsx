import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Users, DollarSign, Calendar, Zap } from 'lucide-react';
import BracketDisplay from '@/components/tournaments/BracketDisplay';
import LiveLeaderboard from '@/components/tournaments/LiveLeaderboard';

export default function TournamentDetails() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('id');
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: tournament, isLoading } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const res = await base44.entities.Tournament.filter({ id: tournamentId }).then(r => r[0]);
      return res;
    },
    enabled: !!tournamentId,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['tournamentParticipants', tournamentId],
    queryFn: async () => {
      const res = await base44.entities.TournamentParticipant.filter({ tournament_id: tournamentId });
      return res;
    },
    enabled: !!tournamentId,
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['tournamentMatches', tournamentId],
    queryFn: async () => {
      const res = await base44.entities.TournamentMatch.filter({ tournament_id: tournamentId });
      return res;
    },
    enabled: !!tournamentId,
  });

  if (isLoading) return <div className="text-center py-20">Loading tournament...</div>;
  if (!tournament) return <div className="text-center py-20">Tournament not found</div>;

  const topPlayers = participants.filter(p => p.final_placement && p.final_placement <= 3).sort((a, b) => a.final_placement - b.final_placement);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{tournament.tournament_name}</h1>
              <p className="text-gray-600">{tournament.description}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-yellow-600">${tournament.total_prize_pool.toFixed(0)}</div>
              <p className="text-sm text-gray-600">Prize Pool</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { icon: Users, label: 'Participants', value: tournament.current_participants },
            { icon: Trophy, label: 'Format', value: tournament.tournament_format.replace(/_/g, ' ') },
            { icon: Calendar, label: 'Status', value: tournament.status.replace(/_/g, ' ') },
            { icon: DollarSign, label: 'Entry Fee', value: `$${tournament.entry_fee}` },
          ].map((stat, idx) => (
            <Card key={idx} className="bg-white border-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-4 h-4 text-purple-600" />
                  <p className="text-xs text-gray-600">{stat.label}</p>
                </div>
                <p className="text-lg font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Winners Section */}
        {tournament.prizes_distributed && topPlayers.length > 0 && (
          <Card className="mb-8 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                Tournament Winners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {topPlayers.map((player, idx) => (
                  <div key={player.id} className={`p-4 rounded-lg text-center ${
                    idx === 0 ? 'bg-yellow-200 border-2 border-yellow-400' :
                    idx === 1 ? 'bg-gray-200 border-2 border-gray-400' :
                    'bg-orange-100 border-2 border-orange-300'
                  }`}>
                    <p className="text-2xl font-bold mb-1">{['🥇', '🥈', '🥉'][idx]}</p>
                    <p className="font-bold text-lg">{player.user_name}</p>
                    <p className="text-sm text-gray-700 mt-2 font-bold">${player.prize_awarded.toFixed(2)} won</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="bracket" className="space-y-6">
          <TabsList className="bg-white border-2 border-gray-200">
            <TabsTrigger value="bracket" className="flex items-center gap-1">
              <Zap className="w-4 h-4" /> Bracket
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-1">
              <Trophy className="w-4 h-4" /> Leaderboard
            </TabsTrigger>
            <TabsTrigger value="participants" className="flex items-center gap-1">
              <Users className="w-4 h-4" /> Participants
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bracket">
            <Card>
              <CardContent className="pt-6">
                <BracketDisplay tournamentId={tournamentId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <LiveLeaderboard tournamentId={tournamentId} />
          </TabsContent>

          <TabsContent value="participants">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  {participants.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-600">#{p.seed_number}</span>
                        <div>
                          <p className="font-semibold">{p.user_name}</p>
                          <p className="text-xs text-gray-600">{p.wins}W - {p.losses}L</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {p.status === 'won' && <div className="text-yellow-600 font-bold">🏆 Champion</div>}
                        {p.final_placement && <span className="text-sm text-gray-600">#{p.final_placement}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}