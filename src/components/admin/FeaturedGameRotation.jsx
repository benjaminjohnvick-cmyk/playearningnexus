import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Trophy, Users, ArrowRight, DollarSign, Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function FeaturedGameRotation() {
  const queryClient = useQueryClient();
  const [autoRotating, setAutoRotating] = useState(false);

  const runAutoRotation = async () => {
    setAutoRotating(true);
    try {
      const res = await base44.functions.invoke('autoFeaturedGameRotation', {});
      const d = res.data;
      if (d?.rotations?.length > 0) {
        toast.success(`AI rotated ${d.rotations.length} group(s): ${d.rotations.map(r => r.game).join(', ')}`);
      } else {
        toast.info('All groups checked — no rotation needed yet.');
      }
      queryClient.invalidateQueries(['user-groups']);
      queryClient.invalidateQueries(['queued-games']);
    } catch (e) {
      toast.error(e.message);
    }
    setAutoRotating(false);
  };

  const { data: userGroups = [] } = useQuery({
    queryKey: ['user-groups'],
    queryFn: () => base44.entities.UserGroup.list('-group_number')
  });

  const { data: queuedGames = [] } = useQuery({
    queryKey: ['queued-games'],
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ status: 'approved' }, 'queue_position');
      return games;
    }
  });

  const { data: priorityGames = [] } = useQuery({
    queryKey: ['priority-games'],
    queryFn: () => base44.entities.Game.filter({ priority_payment: true, status: 'approved' })
  });

  const rotateFeaturedGameMutation = useMutation({
    mutationFn: async ({ groupId, gameId }) => {
      const group = userGroups.find(g => g.id === groupId);
      const game = await base44.entities.Game.get(gameId);
      
      // Set game as featured
      await base44.entities.Game.update(gameId, {
        status: 'featured',
        featured_start_date: new Date().toISOString(),
        featured_end_date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        user_group_id: groupId
      });

      // Update user group
      await base44.entities.UserGroup.update(groupId, {
        current_featured_game_id: gameId,
        featured_game_start_date: new Date().toISOString()
      });

      // Move old featured game to library if exists
      if (group.current_featured_game_id) {
        await base44.entities.Game.update(group.current_featured_game_id, {
          status: 'library'
        });
      }

      return game;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-groups']);
      queryClient.invalidateQueries(['queued-games']);
      toast.success('Featured game rotated successfully!');
    }
  });

  const calculateDaysRemaining = (startDate) => {
    if (!startDate) return 6;
    const start = new Date(startDate);
    const now = new Date();
    const diff = 6 - Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-900">Featured Game Rotation System</h3>
          <Button onClick={runAutoRotation} disabled={autoRotating} className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600">
            {autoRotating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            Run AI Auto-Rotation
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Rotation Cycle:</span>
            <p className="font-bold">Every 6 Days</p>
          </div>
          <div>
            <span className="text-gray-600">Games per Month:</span>
            <p className="font-bold">5 Games</p>
          </div>
          <div>
            <span className="text-gray-600">Games per Year:</span>
            <p className="font-bold">60 Games</p>
          </div>
        </div>
      </Card>

      {/* Priority Queue ($600k games) */}
      {priorityGames.length > 0 && (
        <Card className="p-6 border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-amber-600" />
            <h3 className="text-xl font-bold text-gray-900">Priority Queue (Paid $600k+)</h3>
            <Badge className="bg-amber-200 text-amber-800">{priorityGames.length} games</Badge>
          </div>
          <div className="space-y-3">
            {priorityGames.map((game) => (
              <div key={game.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  <img src={game.icon_url} alt={game.title} className="w-12 h-12 rounded-lg object-cover" />
                  <div>
                    <h4 className="font-bold">{game.title}</h4>
                    <p className="text-sm text-gray-600">
                      ${(game.priority_payment_amount || 600000).toLocaleString()} paid
                    </p>
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-700">Priority</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Active User Groups */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900">Active User Groups</h3>
        {userGroups.map((group) => {
          const daysRemaining = calculateDaysRemaining(group.featured_game_start_date);
          const needsRotation = daysRemaining === 0;

          return (
            <Card key={group.id} className={`p-6 ${needsRotation ? 'border-2 border-red-300 bg-red-50' : 'border'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Group {group.group_number}</h4>
                    <p className="text-sm text-gray-600">
                      {group.current_users.toLocaleString()} / {group.max_capacity.toLocaleString()} users
                    </p>
                  </div>
                </div>
                {needsRotation && (
                  <Badge className="bg-red-600 text-white">Rotation Needed!</Badge>
                )}
              </div>

              {group.current_featured_game_id ? (
                <div className="bg-white rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-amber-600" />
                    <span className="font-bold">Current Featured Game</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Days Remaining: <span className="font-bold text-gray-900">{daysRemaining} / 6</span>
                    </div>
                    <div className="w-48 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${((6 - daysRemaining) / 6) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-amber-800">No featured game assigned</p>
                </div>
              )}

              {needsRotation && queuedGames.length > 0 && (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => rotateFeaturedGameMutation.mutate({ 
                      groupId: group.id, 
                      gameId: priorityGames[0]?.id || queuedGames[0]?.id 
                    })}
                    disabled={rotateFeaturedGameMutation.isPending}
                    className="bg-gradient-to-r from-green-600 to-emerald-600"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Rotate to Next Game
                  </Button>
                  <span className="text-sm text-gray-600">
                    Next: {(priorityGames[0] || queuedGames[0])?.title}
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Game Queue */}
      <Card className="p-6 border-0 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Upcoming Game Queue</h3>
        <p className="text-sm text-gray-600 mb-4">
          Games are featured in the order received, unless priority payment ($600k) is made.
        </p>
        <div className="space-y-2">
          {queuedGames.slice(0, 10).map((game, index) => (
            <div key={game.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                {index + 1}
              </Badge>
              <img src={game.icon_url} alt={game.title} className="w-10 h-10 rounded-lg object-cover" />
              <div className="flex-1">
                <h5 className="font-medium">{game.title}</h5>
                <p className="text-xs text-gray-500">
                  Submitted: {new Date(game.submission_date || game.created_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}