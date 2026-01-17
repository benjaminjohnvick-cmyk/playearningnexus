import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Users, TrendingUp, Zap } from 'lucide-react';
import CreateEventModal from '../components/events/CreateEventModal';
import AIEventSuggestions from '../components/events/AIEventSuggestions';
import EventLeaderboard from '../components/events/EventLeaderboard';
import { toast } from 'sonner';

export default function DeveloperEventManagement() {
  const [user, setUser] = useState(null);
  const [businessClient, setBusinessClient] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        const clients = await base44.entities.BusinessClient.filter({ owner_user_id: currentUser.id });
        if (clients[0]) {
          setBusinessClient(clients[0]);
        }
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: myGames = [] } = useQuery({
    queryKey: ['myGames', businessClient?.id],
    queryFn: () => base44.entities.Game.filter({ developer_id: businessClient.id }),
    enabled: !!businessClient
  });

  const { data: gameEvents = [] } = useQuery({
    queryKey: ['gameEvents', selectedGame?.id],
    queryFn: () => base44.entities.LiveEvent.filter({ game_id: selectedGame.id }, '-start_time'),
    enabled: !!selectedGame
  });

  const handleAISuggestion = (suggestion) => {
    const startTime = new Date();
    if (suggestion.optimal_start_time) {
      const [hours, minutes] = suggestion.optimal_start_time.split(':');
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      if (startTime < new Date()) startTime.setDate(startTime.getDate() + 1);
    }
    
    const endTime = new Date(startTime.getTime() + suggestion.duration_hours * 60 * 60 * 1000);

    setShowAISuggestions(false);
    setShowCreateModal(true);
  };

  if (!user || !businessClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const now = new Date();
  const activeEvents = gameEvents.filter(e => new Date(e.start_time) <= now && new Date(e.end_time) >= now);
  const upcomingEvents = gameEvents.filter(e => new Date(e.start_time) > now);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent mb-2">
            Event Management
          </h1>
          <p className="text-gray-600">Create time-limited in-game events to boost engagement</p>
        </div>

        {/* Game Selection */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Select Game</h3>
          <div className="grid md:grid-cols-4 gap-3">
            {myGames.map(game => (
              <Button
                key={game.id}
                variant={selectedGame?.id === game.id ? "default" : "outline"}
                onClick={() => setSelectedGame(game)}
                className="justify-start"
              >
                {game.title}
              </Button>
            ))}
          </div>
        </div>

        {selectedGame && (
          <>
            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <Zap className="w-8 h-8 text-purple-600 mb-2" />
                  <p className="text-sm text-gray-600">Active Events</p>
                  <p className="text-3xl font-bold">{activeEvents.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <Calendar className="w-8 h-8 text-blue-600 mb-2" />
                  <p className="text-sm text-gray-600">Upcoming</p>
                  <p className="text-3xl font-bold">{upcomingEvents.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <Users className="w-8 h-8 text-green-600 mb-2" />
                  <p className="text-sm text-gray-600">Total Participants</p>
                  <p className="text-3xl font-bold">
                    {gameEvents.reduce((sum, e) => sum + (e.participants_count || 0), 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <TrendingUp className="w-8 h-8 text-orange-600 mb-2" />
                  <p className="text-sm text-gray-600">Avg Engagement</p>
                  <p className="text-3xl font-bold">
                    {gameEvents.length > 0 
                      ? Math.round(gameEvents.reduce((sum, e) => sum + (e.participants_count || 0), 0) / gameEvents.length)
                      : 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Create Event
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAISuggestions(!showAISuggestions)}
                className="bg-gradient-to-r from-purple-50 to-pink-50"
              >
                <Trophy className="w-4 h-4 mr-2" />
                AI Suggestions
              </Button>
            </div>

            {/* AI Suggestions */}
            {showAISuggestions && (
              <div className="mb-6">
                <AIEventSuggestions gameId={selectedGame.id} onSelectSuggestion={handleAISuggestion} />
              </div>
            )}

            {/* Events Tabs */}
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">Active Events</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4">
                {activeEvents.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-gray-500">
                      No active events
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {activeEvents.map(event => (
                      <Card key={event.id} className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle>{event.title}</CardTitle>
                              <Badge className="bg-green-600 mt-2">LIVE</Badge>
                            </div>
                            <Trophy className="w-6 h-6 text-green-600" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-700 mb-3">{event.description}</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Participants</span>
                              <span className="font-bold">{event.participants_count || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Reward Multiplier</span>
                              <span className="font-bold">{event.reward_multiplier}x</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Ends</span>
                              <span className="font-medium">{new Date(event.end_time).toLocaleString()}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-4">
                {upcomingEvents.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-gray-500">
                      No upcoming events scheduled
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {upcomingEvents.map(event => (
                      <Card key={event.id}>
                        <CardHeader>
                          <CardTitle>{event.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-600 mb-3">{event.description}</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Starts</span>
                              <span className="font-medium">{new Date(event.start_time).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Reward</span>
                              <span className="font-bold">{event.reward_multiplier}x</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="leaderboards">
                {activeEvents.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-gray-500">
                      No active events with leaderboards
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    {activeEvents.map(event => (
                      <EventLeaderboard key={event.id} eventId={event.id} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        <CreateEventModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          gameId={selectedGame?.id}
          onAISuggest={() => {
            setShowCreateModal(false);
            setShowAISuggestions(true);
          }}
        />
      </div>
    </div>
  );
}