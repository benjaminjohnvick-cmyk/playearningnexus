import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gift, Heart, Trophy, Rocket, Flame, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

const VIRTUAL_GIFTS = [
  { id: 'heart', name: 'Heart', icon: Heart, cost: 10, color: 'text-red-500' },
  { id: 'trophy', name: 'Trophy', icon: Trophy, cost: 50, color: 'text-yellow-500' },
  { id: 'rocket', name: 'Rocket', icon: Rocket, cost: 100, color: 'text-blue-500' },
  { id: 'flame', name: 'Fire', icon: Flame, cost: 250, color: 'text-orange-500' },
  { id: 'sparkles', name: 'Sparkles', icon: Sparkles, cost: 500, color: 'text-purple-500' }
];

export default function VirtualGiftsPanel({ streamer, viewer, game }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const sendGiftMutation = useMutation({
    mutationFn: async (gift) => {
      if (viewer.virtual_currency < gift.cost) {
        throw new Error('Insufficient credits');
      }

      // Create gift transaction
      await base44.entities.GiftTransaction.create({
        sender_id: viewer.id,
        recipient_id: streamer.id,
        gift_type: gift.id,
        gift_name: gift.name,
        cost: gift.cost,
        game_id: game?.id
      });

      // Deduct from sender
      await base44.auth.updateMe({
        virtual_currency: viewer.virtual_currency - gift.cost
      });

      // Add to streamer
      const streamerData = await base44.entities.User.filter({ id: streamer.id });
      await base44.entities.User.update(streamer.id, {
        virtual_currency: (streamerData[0].virtual_currency || 0) + gift.cost
      });

      // Create notification
      await base44.entities.Notification.create({
        user_id: streamer.id,
        title: `${viewer.full_name} sent you a ${gift.name}!`,
        message: `You received a ${gift.name} worth ${gift.cost} credits`,
        notification_type: 'gift_received',
        related_entity_id: viewer.id
      });

      // Track analytics
      await base44.analytics.track({
        eventName: 'virtual_gift_sent',
        properties: { gift_type: gift.id, cost: gift.cost }
      });

      return gift;
    },
    onSuccess: (gift) => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success(`${gift.name} sent to ${streamer.full_name}! 🎁`);
      setIsOpen(false);
      queryClient.invalidateQueries(['user']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send gift');
    }
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="border-purple-300 text-purple-600 hover:bg-purple-50"
      >
        <Gift className="w-4 h-4 mr-2" />
        Send Gift
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-500" />
              Send a Gift to {streamer.full_name}
            </DialogTitle>
            <p className="text-sm text-gray-600">
              Your balance: {viewer.virtual_currency?.toFixed(0) || 0} credits
            </p>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
            {VIRTUAL_GIFTS.map((gift) => {
              const Icon = gift.icon;
              const canAfford = viewer.virtual_currency >= gift.cost;
              
              return (
                <button
                  key={gift.id}
                  onClick={() => canAfford && sendGiftMutation.mutate(gift)}
                  disabled={!canAfford || sendGiftMutation.isPending}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    canAfford 
                      ? 'border-purple-200 hover:border-purple-400 hover:shadow-lg cursor-pointer' 
                      : 'border-gray-200 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Icon className={`w-12 h-12 mx-auto mb-3 ${gift.color}`} />
                  <p className="font-bold text-gray-900">{gift.name}</p>
                  <p className="text-sm text-gray-600">{gift.cost} credits</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-900">
              💡 Gifts appear as on-screen animations and notify the streamer in real-time!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}