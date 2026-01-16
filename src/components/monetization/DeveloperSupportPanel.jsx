import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, DollarSign, Coffee, Gift, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function DeveloperSupportPanel({ game, user }) {
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipMessage, setTipMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: developer } = useQuery({
    queryKey: ['developer', game?.developer_id],
    queryFn: () => base44.entities.BusinessClient.filter({ id: game.developer_id }).then(res => res[0]),
    enabled: !!game?.developer_id
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ['virtualCurrency', user?.id],
    queryFn: () => base44.entities.VirtualCurrency.filter({ user_id: user.id }),
    enabled: !!user
  });

  const tipMutation = useMutation({
    mutationFn: async ({ amount, currencyType, message }) => {
      // Check if user has enough virtual currency
      const currency = currencies.find(c => c.currency_type === currencyType);
      if (!currency || currency.balance < amount) {
        throw new Error(`Insufficient ${currencyType}`);
      }

      // Deduct from user's virtual currency
      await base44.entities.VirtualCurrency.update(currency.id, {
        balance: currency.balance - amount,
        total_spent: currency.total_spent + amount
      });

      // Create gift transaction
      await base44.entities.GiftTransaction.create({
        sender_user_id: user.id,
        recipient_user_id: game.developer_id,
        gift_type: 'developer_support',
        amount: amount,
        currency_type: currencyType,
        message: message,
        game_id: game.id
      });

      // Create transaction record
      await base44.entities.Transaction.create({
        user_id: user.id,
        business_client_id: game.developer_id,
        game_id: game.id,
        amount: amount,
        currency: currencyType.toUpperCase(),
        transaction_type: 'in_game_purchase',
        status: 'completed',
        notes: `Developer support: ${message}`
      });

      return { amount, currencyType };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['virtualCurrency']);
      toast.success(`Sent ${data.amount} ${data.currencyType} to support the developer!`, {
        description: 'Thank you for your support!'
      });
      setShowTipModal(false);
      setTipMessage('');
      setTipAmount(5);
    },
    onError: (error) => {
      toast.error('Support failed', { description: error.message });
    }
  });

  const quickTipAmounts = [
    { amount: 5, label: 'Coffee', icon: Coffee },
    { amount: 10, label: 'Snack', icon: Gift },
    { amount: 25, label: 'Thanks!', icon: Heart },
    { amount: 50, label: 'Amazing!', icon: Star },
  ];

  const getCurrencyBalance = (type) => {
    const currency = currencies.find(c => c.currency_type === type);
    return currency?.balance || 0;
  };

  if (!developer) return null;

  return (
    <>
      <Card className="bg-gradient-to-br from-pink-50 to-purple-50 border-2 border-pink-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="w-5 h-5 text-pink-500" />
            Support Developer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            {developer.logo_url && (
              <img src={developer.logo_url} alt={developer.company_name} className="w-12 h-12 rounded-full" />
            )}
            <div>
              <p className="font-semibold">{developer.company_name}</p>
              <p className="text-xs text-gray-600">{developer.tagline}</p>
            </div>
          </div>

          <Button
            onClick={() => setShowTipModal(true)}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          >
            <Heart className="w-4 h-4 mr-2" />
            Send Support
          </Button>

          <p className="text-xs text-gray-600 text-center">
            💝 Show appreciation for creating this game
          </p>
        </CardContent>
      </Card>

      <Dialog open={showTipModal} onOpenChange={setShowTipModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Support {developer.company_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm font-medium mb-2">Your Virtual Currency:</p>
              <div className="flex gap-3">
                <Badge className="bg-yellow-100 text-yellow-800">
                  {getCurrencyBalance('coins')} Coins
                </Badge>
                <Badge className="bg-purple-100 text-purple-800">
                  {getCurrencyBalance('gems')} Gems
                </Badge>
                <Badge className="bg-blue-100 text-blue-800">
                  {getCurrencyBalance('tokens')} Tokens
                </Badge>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Quick Tip</label>
              <div className="grid grid-cols-4 gap-2">
                {quickTipAmounts.map((quick) => {
                  const Icon = quick.icon;
                  return (
                    <Button
                      key={quick.amount}
                      variant="outline"
                      className="flex flex-col h-auto py-3"
                      onClick={() => setTipAmount(quick.amount)}
                    >
                      <Icon className="w-5 h-5 mb-1" />
                      <span className="text-xs">{quick.amount}</span>
                      <span className="text-xs text-gray-500">{quick.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Custom Amount</label>
              <Input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(Number(e.target.value))}
                min="1"
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Message (Optional)</label>
              <Input
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                placeholder="Say something nice..."
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pay with</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={getCurrencyBalance('coins') >= tipAmount ? 'default' : 'outline'}
                  disabled={getCurrencyBalance('coins') < tipAmount || tipMutation.isPending}
                  onClick={() => tipMutation.mutate({ amount: tipAmount, currencyType: 'coins', message: tipMessage })}
                >
                  {tipAmount} Coins
                </Button>
                <Button
                  variant={getCurrencyBalance('gems') >= tipAmount ? 'default' : 'outline'}
                  disabled={getCurrencyBalance('gems') < tipAmount || tipMutation.isPending}
                  onClick={() => tipMutation.mutate({ amount: tipAmount, currencyType: 'gems', message: tipMessage })}
                >
                  {tipAmount} Gems
                </Button>
                <Button
                  variant={getCurrencyBalance('tokens') >= tipAmount ? 'default' : 'outline'}
                  disabled={getCurrencyBalance('tokens') < tipAmount || tipMutation.isPending}
                  onClick={() => tipMutation.mutate({ amount: tipAmount, currencyType: 'tokens', message: tipMessage })}
                >
                  {tipAmount} Tokens
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}