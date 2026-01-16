import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Coins, Plus, Gem, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function VirtualCurrencyWidget({ user }) {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: currencies = [] } = useQuery({
    queryKey: ['virtualCurrency', user?.id],
    queryFn: () => base44.entities.VirtualCurrency.filter({ user_id: user.id }),
    enabled: !!user
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ currencyType, amount, price }) => {
      // Check if user has enough credits from surveys
      const userCredits = user?.total_earnings || 0;
      if (userCredits < price) {
        throw new Error('Insufficient survey credits');
      }

      // Find or create virtual currency record
      const existingCurrency = currencies.find(c => c.currency_type === currencyType);
      
      if (existingCurrency) {
        await base44.entities.VirtualCurrency.update(existingCurrency.id, {
          balance: existingCurrency.balance + amount,
          total_earned: existingCurrency.total_earned + amount
        });
      } else {
        await base44.entities.VirtualCurrency.create({
          user_id: user.id,
          currency_type: currencyType,
          balance: amount,
          total_earned: amount,
          total_spent: 0
        });
      }

      // Deduct survey credits
      await base44.auth.updateMe({
        total_earnings: userCredits - price
      });

      // Create transaction record
      await base44.entities.Transaction.create({
        user_id: user.id,
        amount: price,
        currency: 'CREDITS',
        transaction_type: 'credit_purchase',
        status: 'completed'
      });

      return { currencyType, amount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['virtualCurrency']);
      toast.success(`Purchased ${data.amount} ${data.currencyType}!`);
      setShowPurchaseModal(false);
    },
    onError: (error) => {
      toast.error('Purchase failed', { description: error.message });
    }
  });

  const currencyPackages = [
    { type: 'coins', amount: 100, price: 10, icon: Coins, color: 'yellow' },
    { type: 'coins', amount: 500, price: 45, icon: Coins, color: 'yellow', bonus: 50 },
    { type: 'coins', amount: 1000, price: 80, icon: Coins, color: 'yellow', bonus: 150 },
    { type: 'gems', amount: 50, price: 20, icon: Gem, color: 'purple' },
    { type: 'gems', amount: 200, price: 70, icon: Gem, color: 'purple', bonus: 30 },
    { type: 'tokens', amount: 25, price: 15, icon: Zap, color: 'blue' },
  ];

  const getCurrencyBalance = (type) => {
    const currency = currencies.find(c => c.currency_type === type);
    return currency?.balance || 0;
  };

  const currencyIcons = { coins: Coins, gems: Gem, tokens: Zap };
  const currencyColors = { coins: 'text-yellow-400', gems: 'text-purple-400', tokens: 'text-blue-400' };

  return (
    <>
      <div className="flex items-center gap-3">
        {['coins', 'gems', 'tokens'].map((type) => {
          const Icon = currencyIcons[type];
          return (
            <div key={type} className="flex items-center gap-1 bg-black/30 px-3 py-1.5 rounded-full">
              <Icon className={`w-4 h-4 ${currencyColors[type]}`} />
              <span className="font-bold text-sm">{getCurrencyBalance(type)}</span>
            </div>
          );
        })}
        <Button
          size="sm"
          onClick={() => setShowPurchaseModal(true)}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
        >
          <Plus className="w-4 h-4 mr-1" />
          Buy
        </Button>
      </div>

      <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase Virtual Currency</DialogTitle>
          </DialogHeader>

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💰 Your Survey Credits: <strong>{(user?.total_earnings || 0).toFixed(2)}</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {currencyPackages.map((pkg, idx) => {
              const Icon = pkg.icon;
              const totalAmount = pkg.amount + (pkg.bonus || 0);
              const canAfford = (user?.total_earnings || 0) >= pkg.price;

              const colorClasses = {
                yellow: 'text-yellow-500',
                purple: 'text-purple-500',
                blue: 'text-blue-500'
              };

              return (
                <Card
                  key={idx}
                  className={cn(
                    "p-4 cursor-pointer transition-all",
                    !canAfford && "opacity-50"
                  )}
                >
                  <div className="text-center">
                    <div className="mb-3">
                      <Icon className={`w-12 h-12 mx-auto ${colorClasses[pkg.color]}`} />
                    </div>
                    <div className="mb-2">
                      <p className="text-2xl font-bold">{totalAmount}</p>
                      <p className="text-xs text-gray-600 capitalize">{pkg.type}</p>
                      {pkg.bonus && (
                        <Badge className="mt-1 bg-green-500">+{pkg.bonus} Bonus</Badge>
                      )}
                    </div>
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-gray-700">
                        {pkg.price} Survey Credits
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!canAfford || purchaseMutation.isPending}
                      onClick={() => purchaseMutation.mutate({
                        currencyType: pkg.type,
                        amount: totalAmount,
                        price: pkg.price
                      })}
                    >
                      {!canAfford ? 'Not Enough Credits' : 'Purchase'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Earn Survey Credits by completing surveys in the Surveys section
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}