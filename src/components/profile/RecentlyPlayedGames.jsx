import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function RecentlyPlayedGames({ userId }) {
  const { data: recentEngagements = [] } = useQuery({
    queryKey: ['recentGames', userId],
    queryFn: async () => {
      const engagements = await base44.entities.GameEngagement.filter(
        { user_id: userId },
        '-updated_date',
        5
      );
      
      const gameIds = [...new Set(engagements.map(e => e.game_id))];
      if (gameIds.length === 0) return [];
      
      const games = await base44.entities.Game.filter({ id: { $in: gameIds } });
      
      return engagements.map(e => ({
        ...e,
        game: games.find(g => g.id === e.game_id)
      })).filter(e => e.game);
    },
    enabled: !!userId
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recently Played
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentEngagements.length === 0 ? (
          <div className="text-center py-8">
            <Gamepad2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No recent games</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentEngagements.map((engagement, idx) => (
              <motion.div
                key={engagement.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Link to={createPageUrl('GameDetail') + `?id=${engagement.game.id}`}>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    {engagement.game.icon_url && (
                      <img src={engagement.game.icon_url} alt={engagement.game.title} className="w-12 h-12 rounded object-cover" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold">{engagement.game.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{engagement.time_spent || 0}m played</span>
                        <span>•</span>
                        <span>{new Date(engagement.updated_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Session {engagement.session_count || 1}
                    </Badge>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}