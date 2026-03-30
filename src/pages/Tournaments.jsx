import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Zap, Users, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import TournamentCard from '@/components/tournaments/TournamentCard';

export default function Tournaments() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: tournaments = [], isLoading: tournamentsLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const res = await base44.entities.Tournament.filter({});
      return res.sort((a, b) => new Date(b.tournament_starts) - new Date(a.tournament_starts));
    },
  });

  const { data: userParticipations = [] } = useQuery({
    queryKey: ['userTournaments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await base44.entities.TournamentParticipant.filter({ user_id: user.id });
      return res;
    },
    enabled: !!user,
  });

  const enterTournament = useMutation({
    mutationFn: async (tournament_id) => {
      const res = await base44.functions.invoke('enterTournament', { tournament_id });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Joined ${data.tournament_name}!`);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['userTournaments'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to join tournament');
    },
  });

  const upcomingTournaments = tournaments.filter(t =>
    new Date(t.registration_starts) <= new Date() && new Date(t.registration_ends) >= new Date()
  );

  const activeTournaments = tournaments.filter(t =>
    new Date(t.tournament_starts) <= new Date() && new Date(t.tournament_ends) >= new Date()
  );

  const pastTournaments = tournaments.filter(t => new Date(t.tournament_ends) < new Date());

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
        <div className="max-w-7xl mx-auto text-center py-20">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-600" />
          <h1 className="text-3xl font-bold mb-2">Tournament Hub</h1>
          <p className="text-gray-600 mb-6">Sign in to compete for cash jackpots</p>
          <Button onClick={() => base44.auth.redirectToLogin()} size="lg" className="bg-purple-600">
            Sign In to Play
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-yellow-600" />
            <h1 className="text-4xl font-bold">Tournament Hub</h1>
          </div>
          <p className="text-gray-600">Compete in real-time bracket tournaments for cash prizes</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { icon: Trophy, label: 'Tournaments Active', value: activeTournaments.length },
            { icon: Users, label: 'Your Entries', value: userParticipations.length },
            { icon: Zap, label: 'Available to Join', value: upcomingTournaments.length },
            { icon: DollarSign, label: 'Total Prizes', value: `$${tournaments.reduce((sum, t) => sum + t.total_prize_pool, 0).toFixed(0)}` },
          ].map((stat, idx) => (
            <motion.div key={idx} variants={item}>
              <Card className="bg-white border-2">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <stat.icon className="w-5 h-5 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Warning if insufficient balance */}
        {tournaments.some(t => t.entry_fee > 0) && user.total_earnings < tournaments[0]?.entry_fee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900">Low Balance</p>
              <p className="text-sm text-yellow-800">Complete surveys to earn balance for tournament entry fees.</p>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-white border-2 border-gray-200 p-1">
            <TabsTrigger value="active">
              ⚡ Active ({activeTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              📋 Join Now ({upcomingTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              🏆 Past ({pastTournaments.length})
            </TabsTrigger>
          </TabsList>

          {/* Active Tournaments */}
          <TabsContent value="active">
            {activeTournaments.length === 0 ? (
              <Card className="bg-gray-50">
                <CardContent className="pt-6 text-center text-gray-600">
                  No active tournaments. Check back soon!
                </CardContent>
              </Card>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {activeTournaments.map((tournament) => (
                  <motion.div key={tournament.id} variants={item}>
                    <TournamentCard
                      tournament={tournament}
                      onJoin={() => enterTournament.mutate(tournament.id)}
                      isRegistered={userParticipations.some(p => p.tournament_id === tournament.id)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </TabsContent>

          {/* Upcoming Tournaments */}
          <TabsContent value="upcoming">
            {upcomingTournaments.length === 0 ? (
              <Card className="bg-gray-50">
                <CardContent className="pt-6 text-center text-gray-600">
                  No tournaments available to join right now.
                </CardContent>
              </Card>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {upcomingTournaments.map((tournament) => (
                  <motion.div key={tournament.id} variants={item}>
                    <TournamentCard
                      tournament={tournament}
                      onJoin={() => enterTournament.mutate(tournament.id)}
                      isRegistered={userParticipations.some(p => p.tournament_id === tournament.id)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </TabsContent>

          {/* Past Tournaments */}
          <TabsContent value="past">
            {pastTournaments.length === 0 ? (
              <Card className="bg-gray-50">
                <CardContent className="pt-6 text-center text-gray-600">
                  No past tournaments yet.
                </CardContent>
              </Card>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {pastTournaments.map((tournament) => (
                  <motion.div key={tournament.id} variants={item}>
                    <TournamentCard
                      tournament={tournament}
                      onJoin={() => {}}
                      isRegistered={userParticipations.some(p => p.tournament_id === tournament.id)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}