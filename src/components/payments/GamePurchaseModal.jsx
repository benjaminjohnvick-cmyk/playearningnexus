import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GamePurchaseModal({ game, open, onClose, onSuccess }) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [processing, setProcessing] = useState(false);
  const queryClient = useQueryClient();

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      setProcessing(true);

      // Validate card details
      if (!cardNumber || !expiry || !cvc || !cardName) {
        throw new Error('Please fill in all payment details');
      }

      // Simulate payment processing (in production, use Stripe API)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const user = await base44.auth.me();

      // Create transaction
      await base44.entities.Transaction.create({
        user_id: user.id,
        game_id: game.id,
        transaction_type: 'game_purchase',
        amount: game.price || 0,
        status: 'completed',
        payment_method: 'credit_card'
      });

      // Track purchase
      await base44.analytics.track({
        eventName: 'game_purchased_credit_card',
        properties: {
          game_id: game.id,
          game_title: game.title,
          amount: game.price || 0
        }
      });

      // Update game stats
      await base44.entities.Game.update(game.id, {
        total_installs: (game.total_installs || 0) + 1,
        total_revenue: (game.total_revenue || 0) + (game.price || 0)
      });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['games'] });
      setProcessing(false);
      toast.success('Purchase successful! Game added to your library.');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      setProcessing(false);
      toast.error(error.message || 'Payment failed. Please try again.');
    }
  });

  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.substring(0, 19);
  };

  const formatExpiry = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Purchase {game?.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Game Info */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold">{game?.title}</p>
                <Badge className="mt-1 capitalize">{game?.category}</Badge>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                ${(game?.price || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Payment Form */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Card Number
              </label>
              <Input
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                maxLength={19}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Cardholder Name
              </label>
              <Input
                placeholder="John Doe"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Expiry Date
                </label>
                <Input
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  maxLength={5}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  CVC
                </label>
                <Input
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').substring(0, 3))}
                  maxLength={3}
                />
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
            <Lock className="w-4 h-4 text-green-600" />
            <span>Your payment is secure and encrypted</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={processing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => purchaseMutation.mutate()}
              disabled={processing}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Pay ${(game?.price || 0).toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}