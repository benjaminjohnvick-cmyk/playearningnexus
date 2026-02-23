import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Star, Crown, Zap } from "lucide-react";

export default function TieredRewardsDisplay({ user, referralStats }) {
  const tiers = [
    {
      name: 'Bronze',
      level: 1,
      minReferrals: 0,
      minCommission: 0,
      multiplier: 1,
      icon: '🥉',
      color: 'bg-orange-600',
      perks: ['Basic commission']
    },
    {
      name: 'Silver',
      level: 2,
      minReferrals: 5,
      minCommission: 50,
      multiplier: 1.1,
      icon: '🥈',
      color: 'bg-gray-400',
      perks: ['10% bonus', 'Priority support']
    },
    {
      name: 'Gold',
      level: 3,
      minReferrals: 10,
      minCommission: 100,
      multiplier: 1.25,
      icon: '🥇',
      color: 'bg-yellow-600',
      perks: ['25% bonus', 'Featured profile']
    },
    {
      name: 'Platinum',
      level: 4,
      minReferrals: 25,
      minCommission: 500,
      multiplier: 1.5,
      icon: '💎',
      color: 'bg-blue-600',
      perks: ['50% bonus', 'Custom tools']
    },
    {
      name: 'Diamond',
      level: 5,
      minReferrals: 50,
      minCommission: 1000,
      multiplier: 2,
      icon: '👑',
      color: 'bg-purple-600',
      perks: ['100% bonus', 'VIP access']
    }
  ];

  const getCurrentTier = () => {
    const totalReferrals = referralStats?.totalReferrals || 0;
    const totalCommission = referralStats?.commissionEarned || 0;

    for (let i = tiers.length - 1; i >= 0; i--) {
      const tier = tiers[i];
      if (totalReferrals >= tier.minReferrals && totalCommission >= tier.minCommission) {
        return tier;
      }
    }
    return tiers[0];
  };

  const getNextTier = () => {
    const currentTier = getCurrentTier();
    const currentIndex = tiers.findIndex(t => t.level === currentTier.level);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  };

  const currentTier = getCurrentTier();
  const nextTier = getNextTier();

  return (
    <div className="space-y-6">
      {/* Current Tier Display */}
      <Card className={`${currentTier.color} text-white`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-4xl">
                {currentTier.icon}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{currentTier.name} Tier</h3>
                <p className="opacity-90">Level {currentTier.level}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{currentTier.multiplier}x</p>
              <p className="text-sm opacity-90">Commission Multiplier</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {currentTier.perks.map((perk, idx) => (
              <Badge key={idx} variant="outline" className="bg-white/20 border-white/40 text-white">
                {perk}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress to Next Tier */}
      {nextTier && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Star className="w-6 h-6 text-yellow-600" />
              <h3 className="text-xl font-bold text-gray-900">Progress to {nextTier.name}</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Referrals</span>
                  <span className="font-medium">
                    {referralStats?.totalReferrals || 0} / {nextTier.minReferrals}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-green-600 h-3 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(((referralStats?.totalReferrals || 0) / nextTier.minReferrals) * 100, 100)}%` 
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Commission Earned</span>
                  <span className="font-medium">
                    ${(referralStats?.commissionEarned || 0).toFixed(2)} / ${nextTier.minCommission}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(((referralStats?.commissionEarned || 0) / nextTier.minCommission) * 100, 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Tiers Overview */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">All Tiers</h3>
          <div className="space-y-3">
            {tiers.map((tier) => (
              <div 
                key={tier.level}
                className={`p-4 rounded-lg border-2 ${
                  tier.level === currentTier.level 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{tier.icon}</div>
                    <div>
                      <p className="font-bold text-gray-900">{tier.name}</p>
                      <p className="text-sm text-gray-600">
                        {tier.minReferrals} referrals · ${tier.minCommission}+ commission
                      </p>
                    </div>
                  </div>
                  <Badge className={tier.color}>
                    {tier.multiplier}x
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}