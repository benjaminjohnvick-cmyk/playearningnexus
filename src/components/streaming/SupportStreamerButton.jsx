import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, DollarSign, Coins } from 'lucide-react';
import { toast } from 'sonner';

export default function SupportStreamerButton({ streamer, game, viewer }) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const queryClient = useQueryClient();

  const tipMutation = useMutation({
    mutationFn: async ({ currency }) => {
      const tipAmount = parseFloat(amount);
      
      if (currency === 'CREDITS' && viewer.virtual_currency < tipAmount) {
        throw new Error('Insufficient credits');
      }

      // Create tip record
      await base44.entities.StreamerTip.create({
        tipper_user_id: viewer.id,
        streamer_user_id: streamer.id,
        amount: tipAmount,
        currency,
        message,
        is_anonymous: isAnonymous,
        game_id: game?.id,
        display_on_stream: true
      });

      // Update balances
      if (currency === 'CREDITS') {
        await base44.auth.updateMe({ 
          virtual_currency: viewer.virtual_currency - tipAmount 
        });
        
        const streamerData = await base44.entities.User.filter({ id: streamer.id });
        await base44.entities.User.update(streamer.id, {
          virtual_currency: (streamerData[0].virtual_currency || 0) + tipAmount
        });
      } else {
        // USD transaction
        await base44.entities.Transaction.create({
          user_id: streamer.id,
          amount: tipAmount,
          currency: 'USD',
          transaction_type: 'streamer_tip',
          status: 'completed'
        });
      }

      // Create notification
      if (!isAnonymous) {
        await base44.entities.Notification.create({
          user_id: streamer.id,
          title: `${viewer.full_name} sent you a tip!`,
          message: `${tipAmount} ${currency}${message ? ': ' + message : ''}`,
          notification_type: 'tip_received',
          related_entity_id: viewer.id
        });
      }

      // Track analytics
      await base44.analytics.track({
        eventName: 'streamer_tip_sent',
        properties: { 
          amount: tipAmount, 
          currency,
          anonymous: isAnonymous,
          has_message: !!message
        }
      });
    },
    onSuccess: () => {
      toast.success(`Tip sent to ${streamer.full_name}! 💝`);
      setIsOpen(false);
      setAmount('');
      setMessage('');
      queryClient.invalidateQueries(['user']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send tip');
    }
  });

  const handleTip = (currency) => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    tipMutation.mutate({ currency });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="border-pink-300 text-pink-600 hover:bg-pink-50"
      >
        <Heart className="w-4 h-4 mr-2" />
        Support
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              Support {streamer.full_name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="credits" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="credits">
                <Coins className="w-4 h-4 mr-2" />
                Credits
              </TabsTrigger>
              <TabsTrigger value="usd">
                <DollarSign className="w-4 h-4 mr-2" />
                Real Money
              </TabsTrigger>
            </TabsList>

            <TabsContent value="credits" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Amount (Credits)</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your balance: {viewer.virtual_currency?.toFixed(0) || 0} credits
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Message (Optional)</label>
                <Textarea
                  placeholder="Keep up the great work!"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={200}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="anonymous" className="text-sm">Send anonymously</label>
              </div>

              <Button
                onClick={() => handleTip('CREDITS')}
                disabled={tipMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500"
              >
                {tipMutation.isPending ? 'Sending...' : `Send ${amount || '0'} Credits`}
              </Button>
            </TabsContent>

            <TabsContent value="usd" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Amount (USD)</label>
                <Input
                  type="number"
                  placeholder="5.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Message (Optional)</label>
                <Textarea
                  placeholder="Keep up the great work!"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={200}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymous-usd"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="anonymous-usd" className="text-sm">Send anonymously</label>
              </div>

              <Button
                onClick={() => handleTip('USD')}
                disabled={tipMutation.isPending}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
              >
                {tipMutation.isPending ? 'Processing...' : `Send $${amount || '0.00'}`}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}