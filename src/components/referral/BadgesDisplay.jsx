import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Lock } from "lucide-react";

export default function BadgesDisplay({ user, referralStats }) {
  const { data: earnedBadges = [] } = useQuery({
    queryKey: ['referral-badges', user?.id],
    queryFn: async () => {
      return await base44.entities.ReferralBadge.filter({
        user_id: user.id
      });
    },
    enabled: !!user
  });

  const allBadges = [
    {
      type: 'first_referral',
      name: 'First Steps',
      description: 'Made your first referral',
      icon: '🎯',
      requirement: 1
    },
    {
      type: '5_referrals',
      name: 'Rising Star',
      description: 'Referred 5 users',
      icon: '⭐',
      requirement: 5
    },
    {
      type: '10_referrals',
      name: 'Network Builder',
      description: 'Referred 10 users',
      icon: '🌟',
      requirement: 10
    },
    {
      type: '25_referrals',
      name: 'Influencer',
      description: 'Referred 25 users',
      icon: '🔥',
      requirement: 25
    },
    {
      type: '50_referrals',
      name: 'Ambassador',
      description: 'Referred 50 users',
      icon: '👑',
      requirement: 50
    },
    {
      type: '100_referrals',
      name: 'Legend',
      description: 'Referred 100 users',
      icon: '💎',
      requirement: 100
    },
    {
      type: 'commission_50',
      name: 'Earner',
      description: 'Earned $50 in commission',
      icon: '💵',
      requirement: 50
    },
    {
      type: 'commission_100',
      name: 'Money Maker',
      description: 'Earned $100 in commission',
      icon: '💰',
      requirement: 100
    },
    {
      type: 'commission_500',
      name: 'High Roller',
      description: 'Earned $500 in commission',
      icon: '🤑',
      requirement: 500
    },
    {
      type: 'commission_1000',
      name: 'Millionaire Track',
      description: 'Earned $1000 in commission',
      icon: '💸',
      requirement: 1000
    }
  ];

  const isBadgeEarned = (badge) => {
    return earnedBadges.some(b => b.badge_type === badge.type);
  };

  const canEarnBadge = (badge) => {
    if (badge.type.includes('referrals')) {
      return (referralStats?.totalReferrals || 0) >= badge.requirement;
    }
    if (badge.type.includes('commission')) {
      return (referralStats?.commissionEarned || 0) >= badge.requirement;
    }
    return false;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Award className="w-6 h-6 text-yellow-600" />
          <h3 className="text-xl font-bold text-gray-900">Achievement Badges</h3>
          <Badge variant="outline">
            {earnedBadges.length} / {allBadges.length}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allBadges.map((badge) => {
            const earned = isBadgeEarned(badge);
            const canEarn = canEarnBadge(badge);

            return (
              <div
                key={badge.type}
                className={`p-4 rounded-lg border-2 transition-all ${
                  earned
                    ? 'border-yellow-500 bg-yellow-50'
                    : canEarn
                    ? 'border-green-500 bg-green-50 animate-pulse'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl">
                    {earned || canEarn ? badge.icon : <Lock className="w-8 h-8 text-gray-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{badge.name}</p>
                    {earned && (
                      <Badge className="bg-yellow-600 text-xs mt-1">Earned</Badge>
                    )}
                    {!earned && canEarn && (
                      <Badge className="bg-green-600 text-xs mt-1">Ready to Claim!</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600">{badge.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}