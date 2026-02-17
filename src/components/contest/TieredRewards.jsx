import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trophy, Star, Award, Crown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function TieredRewards({ userReferrals = 0, businessReferrals = 0 }) {
  const { data: userTiers = [] } = useQuery({
    queryKey: ['userTiers'],
    queryFn: async () => {
      const tiers = await base44.entities.RewardTier.filter({ referral_type: 'user', is_active: true });
      // Add mega tier if not exists
      const megaTier = tiers.find(t => t.minimum_referrals === 7000000);
      if (!megaTier) {
        tiers.push({
          id: 'mega-tier',
          tier_name: '💎 MEGA MILLIONAIRE',
          referral_type: 'user',
          minimum_referrals: 7000000,
          maximum_referrals: null,
          reward_per_referral: 0,
          bonus_reward: 0,
          tier_color: 'rainbow',
          is_active: true,
          description: '10% profit share on all referred users - Estimated $1M+ payout!'
        });
      }
      return tiers.sort((a, b) => a.minimum_referrals - b.minimum_referrals);
    }
  });

  const { data: businessTiers = [] } = useQuery({
    queryKey: ['businessTiers'],
    queryFn: async () => {
      const tiers = await base44.entities.RewardTier.filter({ referral_type: 'business', is_active: true });
      return tiers.sort((a, b) => a.minimum_referrals - b.minimum_referrals);
    }
  });

  const getCurrentTier = (referrals, tiers) => {
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (referrals >= tiers[i].minimum_referrals) {
        return tiers[i];
      }
    }
    return null;
  };

  const getNextTier = (referrals, tiers) => {
    return tiers.find(tier => tier.minimum_referrals > referrals);
  };

  const getTierIcon = (tierName) => {
    if (tierName.toLowerCase().includes('mega') || tierName.toLowerCase().includes('millionaire')) 
      return <Crown className="w-5 h-5 text-transparent bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text" style={{filter: 'drop-shadow(0 0 8px rgba(234, 179, 8, 0.5))'}} />;
    if (tierName.toLowerCase().includes('platinum')) return <Crown className="w-5 h-5 text-purple-600" />;
    if (tierName.toLowerCase().includes('gold')) return <Trophy className="w-5 h-5 text-yellow-600" />;
    if (tierName.toLowerCase().includes('silver')) return <Award className="w-5 h-5 text-gray-400" />;
    return <Star className="w-5 h-5 text-blue-600" />;
  };

  const currentUserTier = getCurrentTier(userReferrals, userTiers);
  const nextUserTier = getNextTier(userReferrals, userTiers);
  const currentBusinessTier = getCurrentTier(businessReferrals, businessTiers);
  const nextBusinessTier = getNextTier(businessReferrals, businessTiers);

  return (
    <div className="space-y-6">
      {/* User Referral Tiers */}
      <Card>
        <CardHeader>
          <CardTitle>User Referral Tiers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {userTiers.map((tier, index) => {
              const isAchieved = userReferrals >= tier.minimum_referrals;
              const isCurrent = currentUserTier?.id === tier.id;
              const isMegaTier = tier.minimum_referrals === 7000000;
              
              return (
                <div
                  key={tier.id}
                  className={`p-4 rounded-lg border-2 ${
                    isMegaTier
                      ? 'bg-gradient-to-r from-yellow-50 via-pink-50 to-purple-50 border-purple-500 shadow-lg'
                      : isCurrent
                      ? 'bg-blue-50 border-blue-500'
                      : isAchieved
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTierIcon(tier.tier_name)}
                      <span className={`font-bold ${isMegaTier ? 'text-lg bg-gradient-to-r from-yellow-600 via-pink-600 to-purple-600 bg-clip-text text-transparent' : ''}`}>
                        {tier.tier_name}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {isMegaTier ? (
                        <div>
                          <p className="font-bold text-transparent bg-gradient-to-r from-yellow-600 via-pink-600 to-purple-600 bg-clip-text">
                            10% Profit Share
                          </p>
                          <p className="text-xs text-purple-600 font-bold">
                            Est. $1M+ Payout
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="font-bold text-green-600">
                            ${tier.reward_per_referral}/referral
                          </p>
                          {tier.bonus_reward > 0 && (
                            <p className="text-xs text-purple-600">
                              +${tier.bonus_reward} bonus
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {tier.minimum_referrals.toLocaleString()} - {tier.maximum_referrals?.toLocaleString() || '∞'} referrals
                  </p>
                  {isMegaTier && tier.description && (
                    <p className="text-xs text-purple-700 mt-2 font-medium">
                      {tier.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {nextUserTier && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progress to {nextUserTier.tier_name}</span>
                <span className="font-medium">
                  {userReferrals}/{nextUserTier.minimum_referrals}
                </span>
              </div>
              <Progress
                value={(userReferrals / nextUserTier.minimum_referrals) * 100}
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Referral Tiers */}
      <Card>
        <CardHeader>
          <CardTitle>Business Referral Tiers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {businessTiers.map((tier) => {
              const isAchieved = businessReferrals >= tier.minimum_referrals;
              const isCurrent = currentBusinessTier?.id === tier.id;
              
              return (
                <div
                  key={tier.id}
                  className={`p-4 rounded-lg border-2 ${
                    isCurrent
                      ? 'bg-purple-50 border-purple-500'
                      : isAchieved
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTierIcon(tier.tier_name)}
                      <span className="font-bold">{tier.tier_name}</span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">
                        ${tier.reward_per_referral}/referral
                      </p>
                      {tier.bonus_reward > 0 && (
                        <p className="text-xs text-green-600">
                          +${tier.bonus_reward} bonus
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {tier.minimum_referrals} - {tier.maximum_referrals || '∞'} referrals
                  </p>
                </div>
              );
            })}
          </div>

          {nextBusinessTier && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progress to {nextBusinessTier.tier_name}</span>
                <span className="font-medium">
                  {businessReferrals}/{nextBusinessTier.minimum_referrals}
                </span>
              </div>
              <Progress
                value={(businessReferrals / nextBusinessTier.minimum_referrals) * 100}
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}