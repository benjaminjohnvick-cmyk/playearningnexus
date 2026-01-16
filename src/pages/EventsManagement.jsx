import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Zap, Users, Gift, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function EventsManagement() {
  const [user, setUser] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'double_xp',
    start_time: '',
    end_time: '',
    reward_multiplier: 2,
    reward_credits: 0
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser.role !== 'admin') {
          toast.error('Admin access required');
          window.location.href = '/';
          return;
        }
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.LiveEvent.list('-start_time')
  });

  const createEventMutation = useMutation({
    mutationFn: (eventData) => base44.entities.LiveEvent.create(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      toast.success('Event created!');
      setNewEvent({
        title: '',
        description: '',
        event_type: 'double_xp',
        start_time: '',
        end_time: '',
        reward_multiplier: 2,
        reward_credits: 0
      });
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId) => base44.entities.LiveEvent.delete(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries(['events']);
      toast.success('Event deleted');
    }
  });

  const eventTypeIcons = {
    double_xp: <Zap className="w-5 h-5 text-yellow-500" />,
    guild_war: <Users className="w-5 h-5 text-red-500" />,
    special_challenge: <Trophy className="w-5 h-5 text-purple-500" />,
    bonus_rewards: <Gift className="w-5 h-5 text-green-500" />,
    tournament: <Trophy className="w-5 h-5 text-blue-500" />,
    flash_sale: <Zap className="w-5 h-5 text-orange-500" />
  };

  if (!user) return null;

  const now = new Date();
  const activeEvents = events.filter(e => new Date(e.start_time) <= now && new Date(e.end_time) >= now);
  const upcomingEvents = events.filter(e => new Date(e.start_time) > now);
  const pastEvents = events.filter(e => new Date(e.end_time) < now);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-700 to-blue-700 bg-clip-text text-transparent mb-2">
              Events Management
            </h1>
            <p className="text-gray-600">Create and schedule platform-wide events</p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Event Title</label>
                  <Input
                    placeholder="Weekend XP Bonanza"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    placeholder="Earn double XP all weekend long!"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Event Type</label>
                    <Select value={newEvent.event_type} onValueChange={(value) => setNewEvent({ ...newEvent, event_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="double_xp">Double XP</SelectItem>
                        <SelectItem value="guild_war">Guild War</SelectItem>
                        <SelectItem value="special_challenge">Special Challenge</SelectItem>
                        <SelectItem value="bonus_rewards">Bonus Rewards</SelectItem>
                        <SelectItem value="tournament">Tournament</SelectItem>
                        <SelectItem value="flash_sale">Flash Sale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Reward Multiplier</label>
                    <Input
                      type="number"
                      min="1"
                      step="0.5"
                      value={newEvent.reward_multiplier}
                      onChange={(e) => setNewEvent({ ...newEvent, reward_multiplier: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Time</label>
                    <Input
                      type="datetime-local"
                      value={newEvent.start_time}
                      onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">End Time</label>
                    <Input
                      type="datetime-local"
                      value={newEvent.end_time}
                      onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Bonus Credits (optional)</label>
                  <Input
                    type="number"
                    min="0"
                    value={newEvent.reward_credits}
                    onChange={(e) => setNewEvent({ ...newEvent, reward_credits: parseInt(e.target.value) })}
                  />
                </div>

                <Button
                  onClick={() => createEventMutation.mutate({
                    ...newEvent,
                    start_time: new Date(newEvent.start_time).toISOString(),
                    end_time: new Date(newEvent.end_time).toISOString()
                  })}
                  disabled={!newEvent.title || !newEvent.start_time || !newEvent.end_time}
                  className="w-full"
                >
                  Create Event
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-6">
          {activeEvents.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Zap className="w-6 h-6 text-green-600" />
                Active Events ({activeEvents.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {activeEvents.map((event) => (
                  <Card key={event.id} className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {eventTypeIcons[event.event_type]}
                          <div>
                            <CardTitle>{event.title}</CardTitle>
                            <Badge className="bg-green-600 mt-1">LIVE NOW</Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteEventMutation.mutate(event.id)}
                        >
                          End
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 mb-3">{event.description}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Zap className="w-4 h-4" />
                          {event.reward_multiplier}x Rewards
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4" />
                          Ends {new Date(event.end_time).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="w-4 h-4" />
                          {event.participants_count || 0} participants
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {upcomingEvents.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Upcoming Events ({upcomingEvents.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {upcomingEvents.map((event) => (
                  <Card key={event.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {eventTypeIcons[event.event_type]}
                          <CardTitle>{event.title}</CardTitle>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteEventMutation.mutate(event.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-3">{event.description}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          Starts {new Date(event.start_time).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Zap className="w-4 h-4" />
                          {event.reward_multiplier}x Rewards
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-500">Past Events</h2>
              <div className="grid md:grid-cols-3 gap-3">
                {pastEvents.slice(0, 6).map((event) => (
                  <Card key={event.id} className="opacity-60">
                    <CardHeader>
                      <CardTitle className="text-sm">{event.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-gray-600">
                        {event.participants_count || 0} participants
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}