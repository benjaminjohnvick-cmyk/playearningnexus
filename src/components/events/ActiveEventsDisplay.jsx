import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Users, Trophy, Gift, Clock, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ActiveEventsDisplay({ compact = false }) {
  const { data: events = [] } = useQuery({
    queryKey: ['activeEvents'],
    queryFn: async () => {
      const allEvents = await base44.entities.LiveEvent.list('-start_time');
      const now = new Date();
      return allEvents.filter(e => 
        new Date(e.start_time) <= now && 
        new Date(e.end_time) >= now &&
        e.is_active
      );
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const eventTypeIcons = {
    double_xp: <Zap className="w-4 h-4 text-yellow-500" />,
    guild_war: <Users className="w-4 h-4 text-red-500" />,
    special_challenge: <Trophy className="w-4 h-4 text-purple-500" />,
    bonus_rewards: <Gift className="w-4 h-4 text-green-500" />,
    tournament: <Trophy className="w-4 h-4 text-blue-500" />,
    flash_sale: <Zap className="w-4 h-4 text-orange-500" />
  };

  const getTimeRemaining = (endTime) => {
    const diff = new Date(endTime) - new Date();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (events.length === 0) return null;

  if (compact) {
    return (
      <div className="flex gap-2 flex-wrap">
        {events.map((event) => (
          <Badge key={event.id} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            {eventTypeIcons[event.event_type]}
            <span className="ml-1">{event.title}</span>
            <span className="ml-2 opacity-75">{event.reward_multiplier}x</span>
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        Active Events
      </h3>
      
      <div className="grid gap-3">
        {events.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {eventTypeIcons[event.event_type]}
                  <h4 className="font-bold text-gray-900">{event.title}</h4>
                  <Badge className="bg-green-600">LIVE</Badge>
                </div>
                <Badge variant="outline" className="text-purple-700 border-purple-300">
                  {event.reward_multiplier}x Rewards
                </Badge>
              </div>
              
              <p className="text-sm text-gray-700 mb-3">{event.description}</p>
              
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {getTimeRemaining(event.end_time)} left
                </div>
                {event.participants_count > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {event.participants_count} joined
                  </div>
                )}
                {event.reward_credits > 0 && (
                  <div className="flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    +{event.reward_credits} credits
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}