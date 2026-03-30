import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Zap, Clock, ShoppingBag, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RewardMarketplace({ user }) {
  const [selectedPerk, setSelectedPerk] = useState(null);
  const queryClient = useQueryClient();

  const { data: perks = [], isLoading } = useQuery({
    queryKey: ['rewardPerks'],
    queryFn: async () => {
      const res = await base44.entities.RewardPerk.filter({ status: 'active' });
      return res;
    },
  });

  const { data: myRedemptions = [] } = useQuery({
    queryKey: ['myRedemptions', user?.id],
    queryFn: async () => {
      const res = await base44.entities.RedemptionRecord.filter({ user_id: user.id });
      return res.filter(r => r.is_active);
    },
  });

  const redeemMutation = useMutation({
    mutationFn: async (perkId) => {
      const res = await base44.functions.invoke('redeemRewardPerk', { perk_id: perkId });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`🎉 Redeemed! Your new balance: $${data.new_balance.toFixed(2)}`);
      queryClient.invalidateQueries({ queryKey: ['rewardPerks'] });
      queryClient.invalidateQueries({ queryKey: ['myRedemptions'] });
      setSelectedPerk(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Redemption failed');
    },
  });

  const handleRedeem = (perk) => {
    if (user.commission_balance < perk.cost_balance) {
      toast.error('Insufficient balance');
      return;
    }
    redeemMutation.mutate(perk.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-600" />
            Rewards Marketplace
          </h2>
          <p className="text-sm text-gray-600 mt-1">Convert your earnings into exclusive perks</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Available Balance</p>
          <p className="text-2xl font-bold text-emerald-600">${(user.commission_balance || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Active Perks */}
      {myRedemptions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Your Active Perks
          </h3>
          <div className="grid gap-3">
            {myRedemptions.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                <div>
                  <p className="font-semibold text-sm">{r.perk_title}</p>
                  {r.expires_at && (
                    <p className="text-xs text-gray-500">
                      Expires: {new Date(r.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">Active</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Perks Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8">Loading perks...</div>
        ) : perks.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">No perks available</div>
        ) : (
          perks.map((perk) => (
            <motion.div
              key={perk.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {perk.perk_type === 'priority_survey_access' && <Zap className="w-5 h-5 text-amber-500" />}
                        {perk.perk_type === 'custom_badge' && <Star className="w-5 h-5 text-purple-500" />}
                        {perk.perk_type === 'withdrawal_fee_waiver' && <ShoppingBag className="w-5 h-5 text-green-500" />}
                        {perk.perk_type === 'survey_streak_boost' && <Sparkles className="w-5 h-5 text-blue-500" />}
                        {perk.title}
                      </CardTitle>
                    </div>
                    {perk.is_limited_edition && (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Limited</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{perk.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {perk.duration_days && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock className="w-4 h-4" />
                        {perk.duration_days} days duration
                      </div>
                    )}
                    {perk.is_limited_edition && (
                      <p className="text-xs text-orange-600">
                        {perk.available_quantity - perk.redeemed_count} of {perk.available_quantity} remaining
                      </p>
                    )}
                  </div>

                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 text-center border border-indigo-100">
                    <p className="text-xs text-gray-600">Cost</p>
                    <p className="text-2xl font-bold text-indigo-600">${perk.cost_balance.toFixed(2)}</p>
                  </div>

                  <Button
                    onClick={() => handleRedeem(perk)}
                    disabled={
                      user.commission_balance < perk.cost_balance ||
                      (perk.is_limited_edition && perk.redeemed_count >= perk.available_quantity) ||
                      redeemMutation.isPending
                    }
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {user.commission_balance < perk.cost_balance ? 'Insufficient Balance' : 'Redeem'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}