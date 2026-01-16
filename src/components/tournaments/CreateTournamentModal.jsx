import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function CreateTournamentModal({ isOpen, onClose, user }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    game_id: '',
    bracket_type: 'single_elimination',
    max_participants: 16,
    prize_pool_type: 'virtual_currency',
    prize_pool_amount: 1000,
    start_time: '',
    registration_end: '',
    rules: ''
  });

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.filter({ status: { $in: ['approved', 'featured'] } })
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const tournament = await base44.entities.Tournament.create({
        ...data,
        host_user_id: user.id,
        registration_start: new Date().toISOString(),
        prize_distribution: {
          first: data.prize_pool_amount * 0.5,
          second: data.prize_pool_amount * 0.3,
          third: data.prize_pool_amount * 0.2
        }
      });

      await base44.entities.Notification.create({
        user_id: user.id,
        title: 'Tournament Created',
        message: `Your tournament "${data.title}" has been created`,
        notification_type: 'tournament_created',
        related_entity_id: tournament.id
      });

      return tournament;
    },
    onSuccess: () => {
      toast.success('Tournament created successfully!');
      queryClient.invalidateQueries(['tournaments']);
      onClose();
      setFormData({
        title: '',
        description: '',
        game_id: '',
        bracket_type: 'single_elimination',
        max_participants: 16,
        prize_pool_type: 'virtual_currency',
        prize_pool_amount: 1000,
        start_time: '',
        registration_end: '',
        rules: ''
      });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Tournament</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tournament Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Summer Championship 2026"
              required
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Join us for an epic tournament..."
              rows={3}
            />
          </div>

          <div>
            <Label>Game</Label>
            <Select value={formData.game_id} onValueChange={(value) => setFormData({ ...formData, game_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {games.map(game => (
                  <SelectItem key={game.id} value={game.id}>{game.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bracket Type</Label>
              <Select value={formData.bracket_type} onValueChange={(value) => setFormData({ ...formData, bracket_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_elimination">Single Elimination</SelectItem>
                  <SelectItem value="double_elimination">Double Elimination</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Max Participants</Label>
              <Select value={formData.max_participants.toString()} onValueChange={(value) => setFormData({ ...formData, max_participants: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                  <SelectItem value="32">32</SelectItem>
                  <SelectItem value="64">64</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prize Type</Label>
              <Select value={formData.prize_pool_type} onValueChange={(value) => setFormData({ ...formData, prize_pool_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual_currency">Virtual Currency</SelectItem>
                  <SelectItem value="real_money">Real Money</SelectItem>
                  <SelectItem value="none">No Prize</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prize Pool Amount</Label>
              <Input
                type="number"
                value={formData.prize_pool_amount}
                onChange={(e) => setFormData({ ...formData, prize_pool_amount: parseFloat(e.target.value) })}
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Registration Ends</Label>
              <Input
                type="datetime-local"
                value={formData.registration_end}
                onChange={(e) => setFormData({ ...formData, registration_end: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Tournament Start</Label>
              <Input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label>Rules</Label>
            <Textarea
              value={formData.rules}
              onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
              placeholder="Tournament rules and guidelines..."
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Tournament'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}