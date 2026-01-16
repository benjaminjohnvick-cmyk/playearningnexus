import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Users, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import SupportStreamerButton from '../streaming/SupportStreamerButton';
import SubscriptionManager from '../streaming/SubscriptionManager';
import VirtualGiftsPanel from '../streaming/VirtualGiftsPanel';
import StreamNotifications from '../streaming/StreamNotifications';

export default function SpectateMode({ game, user, onSpectatorUpdate, tournamentMatch = null }) {
  const [isSpectatable, setIsSpectatable] = useState(false);
  const [spectators, setSpectators] = useState([]);
  const [isTournamentMatch, setIsTournamentMatch] = useState(!!tournamentMatch);

  // Subscribe to spectator updates
  useEffect(() => {
    if (!game || !user) return;

    const unsubscribe = base44.entities.GameEngagement.subscribe((event) => {
      if (event.data?.game_id === game.id && event.data?.session_type === 'spectating') {
        // Update spectators list
        fetchSpectators();
      }
    });

    return unsubscribe;
  }, [game?.id, user?.id]);

  const { data: connections = [] } = useQuery({
    queryKey: ['connections', user?.id],
    queryFn: () => base44.entities.SocialConnection.filter({ user_id: user.id }),
    enabled: !!user
  });

  const { data: currentSpectators = [] } = useQuery({
    queryKey: ['spectators', game?.id],
    queryFn: () => base44.entities.GameEngagement.filter({
      game_id: game.id,
      session_type: 'spectating'
    }).then(sessions => sessions.filter(s => {
      const sessionEnd = new Date(s.session_end || Date.now());
      return Date.now() - sessionEnd.getTime() < 60000; // Active in last minute
    })),
    enabled: !!game,
    refetchInterval: 5000
  });

  useEffect(() => {
    setSpectators(currentSpectators);
    if (onSpectatorUpdate) {
      onSpectatorUpdate(currentSpectators.length);
    }
  }, [currentSpectators]);

  const toggleSpectatable = async () => {
    const newState = !isSpectatable;
    setIsSpectatable(newState);
    
    if (newState) {
      toast.success('Your gameplay is now spectatable by friends');
      
      // Notify friends
      connections.forEach(async (connection) => {
        await base44.entities.Notification.create({
          user_id: connection.friend_id,
          title: `${user.full_name} is playing ${game.title}`,
          message: 'Join and watch their gameplay!',
          notification_type: 'spectate_invite',
          related_entity_id: game.id
        });
      });
    } else {
      toast.info('Spectating disabled');
    }
  };

  const fetchSpectators = async () => {
    const sessions = await base44.entities.GameEngagement.filter({
      game_id: game.id,
      session_type: 'spectating'
    });
    setSpectators(sessions.filter(s => {
      const sessionEnd = new Date(s.session_end || Date.now());
      return Date.now() - sessionEnd.getTime() < 60000;
    }));
  };

  return (
    <>
      {isSpectatable && <StreamNotifications streamerId={user.id} />}
      
      <div className="flex items-center gap-3">
        {isTournamentMatch && (
          <Badge className="bg-purple-600 flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            Tournament Match
          </Badge>
        )}
        
        <Button
          size="sm"
          variant={isSpectatable ? "default" : "outline"}
          onClick={toggleSpectatable}
          className={isSpectatable ? "bg-purple-600 hover:bg-purple-700" : ""}
        >
          {isSpectatable ? (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Spectatable
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4 mr-2" />
              Private
            </>
          )}
        </Button>

        {spectators.length > 0 && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {spectators.length} watching
          </Badge>
        )}
      </div>
    </>
  );
}