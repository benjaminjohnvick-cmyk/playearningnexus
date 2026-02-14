import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Calendar, DollarSign, Plus, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CreateTournamentModal from '../components/tournaments/CreateTournamentModal';
import TournamentCard from '../components/tournaments/TournamentCard';
import AITournamentMatchmaking from '../components/tournaments/AITournamentMatchmaking';
import EnhancedTournamentSystem from '../components/tournaments/EnhancedTournamentSystem';

export default function Tournaments() {
  const [user, setUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: activeTournaments = [] } = useQuery({
    queryKey: ['tournaments', 'active'],
    queryFn: () => base44.entities.Tournament.filter({
      status: { $in: ['registration', 'in_progress'] },
      is_public: true
    }, '-start_time'),
    enabled: !!user
  });

  const { data: myTournaments = [] } = useQuery({
    queryKey: ['myTournaments', user?.id],
    queryFn: async () => {
      const participations = await base44.entities.TournamentParticipant.filter({
        user_id: user.id
      });
      const tournamentIds = participations.map(p => p.tournament_id);
      if (tournamentIds.length === 0) return [];
      return await base44.entities.Tournament.filter({
        id: { $in: tournamentIds }
      }, '-start_time');
    },
    enabled: !!user
  });

  const { data: upcomingTournaments = [] } = useQuery({
    queryKey: ['tournaments', 'upcoming'],
    queryFn: () => base44.entities.Tournament.filter({
      status: 'registration',
      registration_end: { $gte: new Date().toISOString() }
    }, 'start_time', 10),
    enabled: !!user
  });

  const [selectedTournamentForAI, setSelectedTournamentForAI] = useState(null);

  const { data: tournamentParticipants = [] } = useQuery({
    queryKey: ['tournamentParticipants', selectedTournamentForAI?.id],
    queryFn: () => base44.entities.TournamentParticipant.filter({
      tournament_id: selectedTournamentForAI.id
    }),
    enabled: !!selectedTournamentForAI
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Tournaments</h1>
            <p className="text-gray-600">Compete for glory and prizes</p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Tournament
          </Button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Tournaments</p>
                  <p className="text-2xl font-bold text-purple-600">{activeTournaments.length}</p>
                </div>
                <Trophy className="w-8 h-8 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">My Tournaments</p>
                  <p className="text-2xl font-bold text-blue-600">{myTournaments.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Upcoming</p>
                  <p className="text-2xl font-bold text-green-600">{upcomingTournaments.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Prizes</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    ${activeTournaments.reduce((sum, t) => sum + (t.prize_pool_amount || 0), 0).toFixed(0)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-yellow-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Tournaments</TabsTrigger>
            <TabsTrigger value="my">My Tournaments</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {/* AI Matchmaking for Tournament Hosts */}
            {activeTournaments.some(t => t.host_user_id === user.id) && (
              <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 mb-6">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">🤖 AI Tournament Management</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Select one of your tournaments to use AI-powered matchmaking and bracket generation
                  </p>
                  <div className="flex gap-2">
                    {activeTournaments
                      .filter(t => t.host_user_id === user.id)
                      .map(t => (
                        <Button
                          key={t.id}
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTournamentForAI(t)}
                        >
                          {t.title}
                        </Button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedTournamentForAI && (
              <AITournamentMatchmaking 
                tournament={selectedTournamentForAI} 
                participants={tournamentParticipants}
              />
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeTournaments.map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} user={user} />
              ))}
            </div>
            {activeTournaments.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No active tournaments</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="my" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myTournaments.map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} user={user} />
              ))}
            </div>
            {myTournaments.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">You haven't joined any tournaments</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingTournaments.map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} user={user} />
              ))}
            </div>
            {upcomingTournaments.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No upcoming tournaments</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateTournamentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        user={user}
      />
    </div>
  );
}