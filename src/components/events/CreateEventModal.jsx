import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Trophy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateEventModal({ isOpen, onClose, gameId, onAISuggest }) {
  const [eventData, setEventData] = useState({
    event_type: 'special_challenge',
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    reward_multiplier: 1,
    reward_credits: 0,
    game_id: gameId,
    requirements: {}
  });

  const queryClient = useQueryClient();

  const createEventMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.LiveEvent.create({
        ...data,
        is_active: true,
        participants_count: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['gameEvents']);
      toast.success('Event created successfully!');
      onClose();
      setEventData({
        event_type: 'special_challenge',
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        reward_multiplier: 1,
        reward_credits: 0,
        game_id: gameId,
        requirements: {}
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-600" />
            Create In-Game Event
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onAISuggest}
              className="bg-gradient-to-r from-purple-50 to-pink-50"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Suggest Event
            </Button>
          </div>

          <div>
            <Label>Event Type</Label>
            <Select value={eventData.event_type} onValueChange={(v) => setEventData({...eventData, event_type: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="double_xp">Double XP Weekend</SelectItem>
                <SelectItem value="special_challenge">Special Challenge</SelectItem>
                <SelectItem value="bonus_rewards">Bonus Rewards</SelectItem>
                <SelectItem value="tournament">Tournament</SelectItem>
                <SelectItem value="flash_sale">Flash Sale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Event Title</Label>
            <Input
              placeholder="e.g., Winter Wonderland Challenge"
              value={eventData.title}
              onChange={(e) => setEventData({...eventData, title: e.target.value})}
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the event objectives and what players need to do..."
              value={eventData.description}
              onChange={(e) => setEventData({...eventData, description: e.target.value})}
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Start Date & Time</Label>
              <Input
                type="datetime-local"
                value={eventData.start_time}
                onChange={(e) => setEventData({...eventData, start_time: e.target.value})}
              />
            </div>
            <div>
              <Label>End Date & Time</Label>
              <Input
                type="datetime-local"
                value={eventData.end_time}
                onChange={(e) => setEventData({...eventData, end_time: e.target.value})}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Reward Multiplier (e.g., 2x XP)</Label>
              <Input
                type="number"
                min="1"
                step="0.1"
                value={eventData.reward_multiplier}
                onChange={(e) => setEventData({...eventData, reward_multiplier: parseFloat(e.target.value)})}
              />
            </div>
            <div>
              <Label>Bonus Credits</Label>
              <Input
                type="number"
                min="0"
                value={eventData.reward_credits}
                onChange={(e) => setEventData({...eventData, reward_credits: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => createEventMutation.mutate(eventData)}
              disabled={!eventData.title || !eventData.start_time || !eventData.end_time}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
            >
              Create Event
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}