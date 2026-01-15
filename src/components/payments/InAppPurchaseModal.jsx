import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Lock, CheckCircle2, FileText, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

export default function InAppPurchaseModal({ item, game, open, onClose, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [processing, setProcessing] = useState(false);
  const queryClient = useQueryClient();

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      setProcessing(true);

      const user = await base44.auth.me();

      if (paymentMethod === 'credit_card') {
        // Validate card details
        if (!cardNumber || !expiry || !cvc || !cardName) {
          throw new Error('Please fill in all payment details');
        }

        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create transaction
        await base44.entities.Transaction.create({
          user_id: user.id,
          game_id: game.id,
          transaction_type: 'in_app_purchase',
          amount: item.price || 0,
          status: 'completed',
          payment_method: 'credit_card',
          description: `${item.item_name} - ${game.title}`
        });

        // Track purchase
        await base44.analytics.track({
          eventName: 'in_app_purchase_credit_card',
          properties: {
            game_id: game.id,
            item_id: item.id,
            item_name: item.item_name,
            amount: item.price || 0
          }
        });
      } else {
        // Pay with survey
        await base44.entities.Transaction.create({
          user_id: user.id,
          game_id: game.id,
          transaction_type: 'in_app_purchase',
          amount: item.price || 0,
          status: 'pending_survey',
          payment_method: 'survey',
          description: `${item.item_name} - ${game.title}`
        });

        // Track purchase
        await base44.analytics.track({
          eventName: 'in_app_purchase_survey',
          properties: {
            game_id: game.id,
            item_id: item.id,
            item_name: item.item_name,
            amount: item.price || 0
          }
        });
      }

      // Update item stats
      await base44.entities.InAppPurchase.update(item.id, {
        total_purchases: (item.total_purchases || 0) + 1
      });

      // Update user's virtual currency if applicable
      if (item.item_type === 'currency' && paymentMethod === 'credit_card') {
        const currentUser = await base44.auth.me();
        await base44.auth.updateMe({
          virtual_currency: (currentUser.virtual_currency || 0) + (item.currency_amount || 0)
        });
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inAppPurchases'] });
      setProcessing(false);
      if (paymentMethod === 'survey') {
        toast.success('Survey payment initiated! Complete surveys to unlock your purchase.');
      } else {
        toast.success('Purchase successful!');
      }
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
            <ShoppingBag className="w-5 h-5 text-purple-600" />
            Purchase {item?.item_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Info */}
          <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold">{item?.item_name}</p>
                <Badge className="mt-1 capitalize">{item?.item_type}</Badge>
                {item?.item_type === 'currency' && (
                  <p className="text-xs text-gray-600 mt-1">
                    Get {item?.currency_amount} coins
                  </p>
                )}
              </div>
              <p className="text-2xl font-bold text-purple-600">
                ${(item?.price || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Payment Method
            </label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit_card">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Credit Card
                  </div>
                </SelectItem>
                <SelectItem value="survey">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Pay with Surveys
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Form */}
          {paymentMethod === 'credit_card' ? (
            <>
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
            </>
          ) : (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 mb-2">Pay with Surveys</h4>
              <p className="text-sm text-purple-700 mb-3">
                Complete surveys worth ${(item?.price || 0).toFixed(2)} to unlock this item. 
                Surveys will be available after purchase confirmation.
              </p>
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <FileText className="w-4 h-4" />
                <span>Estimated time: {Math.ceil((item?.price || 0) * 5)} minutes</span>
              </div>
            </div>
          )}

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
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : paymentMethod === 'survey' ? (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Unlock with Surveys
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Pay ${(item?.price || 0).toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}