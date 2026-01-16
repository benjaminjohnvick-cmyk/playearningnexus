import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gamepad2, Eye, Clock } from 'lucide-react';

export default function CurrentActivity({ userId }) {
  const { data: recentEngagement } = useQuery({
    queryKey: ['recentEngagement', userId],
    queryFn: async () => {
      const sessions = await base44.entities.GameEngagement.filter(
        { user_id: userId },
        '-session_start',
        1
      );
      return sessions[0];
    },
    refetchInterval: 10000
  });

  const { data: spectators = [] } = useQuery({
    queryKey: ['spectators', recentEngagement?.game_id],
    queryFn: () => base44.entities.GameEngagement.filter({
      game_id: recentEngagement.game_id,
      session_type: 'spectating'
    }).then(sessions => sessions.filter(s => {
      const sessionEnd = new Date(s.session_end || Date.now());
      return Date.now() - sessionEnd.getTime() < 60000;
    })),
    enabled: !!recentEngagement?.game_id,
    refetchInterval: 5000
  });

  const { data: game } = useQuery({
    queryKey: ['game', recentEngagement?.game_id],
    queryFn: () => base44.entities.Game.filter({ id: recentEngagement.game_id }).then(g => g[0]),
    enabled: !!recentEngagement?.game_id
  });

  if (!recentEngagement || !game) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Not currently playing</p>
        </CardContent>
      </Card>
    );
  }

  const isActive = recentEngagement.session_end 
    ? Date.now() - new Date(recentEngagement.session_end).getTime() < 300000 // 5 minutes
    : true;

  if (!isActive) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Last played {new Date(recentEngagement.session_start).toLocaleString()}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-purple-600" />
            Currently Playing
          </CardTitle>
          <Badge className="bg-green-600 animate-pulse">LIVE</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <img 
            src={game.icon_url} 
            alt={game.title}
            className="w-20 h-20 rounded-lg shadow-md"
          />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">{game.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{game.description}</p>
            {spectators.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-purple-700">
                <Eye className="w-4 h-4" />
                <span>{spectators.length} watching</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}