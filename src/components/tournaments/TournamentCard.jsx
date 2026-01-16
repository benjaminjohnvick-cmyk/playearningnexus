import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, Trophy, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function TournamentCard({ tournament, user }) {
  const queryClient = useQueryClient();

  const { data: game } = useQuery({
    queryKey: ['game', tournament.game_id],
    queryFn: () => base44.entities.Game.filter({ id: tournament.game_id }).then(g => g[0])
  });

  const { data: isRegistered } = useQuery({
    queryKey: ['tournamentRegistration', tournament.id, user.id],
    queryFn: async () => {
      const registrations = await base44.entities.TournamentParticipant.filter({
        tournament_id: tournament.id,
        user_id: user.id
      });
      return registrations.length > 0;
    }
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.TournamentParticipant.create({
        tournament_id: tournament.id,
        user_id: user.id,
        seed: tournament.current_participants + 1
      });

      await base44.entities.Tournament.update(tournament.id, {
        current_participants: tournament.current_participants + 1
      });

      await base44.entities.Notification.create({
        user_id: tournament.host_user_id,
        title: 'New Tournament Registration',
        message: `${user.full_name} registered for ${tournament.title}`,
        notification_type: 'tournament_registration',
        related_entity_id: tournament.id
      });

      await base44.entities.Notification.create({
        user_id: user.id,
        title: 'Tournament Registration Confirmed',
        message: `You're registered for ${tournament.title}`,
        notification_type: 'tournament_confirmation',
        related_entity_id: tournament.id
      });
    },
    onSuccess: () => {
      toast.success('Successfully registered!');
      queryClient.invalidateQueries(['tournamentRegistration']);
      queryClient.invalidateQueries(['tournaments']);
    }
  });

  const statusColors = {
    registration: 'bg-green-600',
    in_progress: 'bg-blue-600',
    completed: 'bg-gray-600',
    cancelled: 'bg-red-600'
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        {game?.icon_url && (
          <img src={game.icon_url} alt={game.title} className="w-full h-32 object-cover rounded-lg mb-4" />
        )}
        
        <div className="space-y-3">
          <div>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-lg">{tournament.title}</h3>
              <Badge className={statusColors[tournament.status]}>
                {tournament.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">{game?.title}</p>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{tournament.current_participants}/{tournament.max_participants}</span>
            </div>
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4" />
              <span>{tournament.bracket_type.replace('_', ' ')}</span>
            </div>
          </div>

          {tournament.prize_pool_amount > 0 && (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
              <DollarSign className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-yellow-700">
                {tournament.prize_pool_type === 'real_money' ? '$' : ''}{tournament.prize_pool_amount} Prize Pool
              </span>
            </div>
          )}

          <div className="text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Starts: {new Date(tournament.start_time).toLocaleString()}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Link to={createPageUrl('TournamentDetails') + `?id=${tournament.id}`} className="flex-1">
              <Button variant="outline" className="w-full">View Details</Button>
            </Link>
            {tournament.status === 'registration' && !isRegistered && (
              <Button 
                onClick={() => registerMutation.mutate()}
                disabled={registerMutation.isPending || tournament.current_participants >= tournament.max_participants}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {tournament.current_participants >= tournament.max_participants ? 'Full' : 'Register'}
              </Button>
            )}
            {isRegistered && (
              <Badge className="flex-1 flex items-center justify-center bg-green-600">Registered</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}