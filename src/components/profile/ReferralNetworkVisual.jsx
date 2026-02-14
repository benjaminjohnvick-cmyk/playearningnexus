import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, TrendingUp, DollarSign, Award, Network } from "lucide-react";

export default function ReferralNetworkVisual({ userId }) {
  const { data: referrals = [] } = useQuery({
    queryKey: ['user-referrals', userId],
    queryFn: async () => {
      return await base44.entities.Referral.filter({
        referrer_id: userId,
        status: 'active'
      });
    },
    enabled: !!userId
  });

  const { data: ltvData = [] } = useQuery({
    queryKey: ['referral-ltv', userId],
    queryFn: async () => {
      return await base44.entities.ReferralLifetimeValue.filter({
        referrer_user_id: userId
      });
    },
    enabled: !!userId
  });

  const { data: tier } = useQuery({
    queryKey: ['referral-tier', userId],
    queryFn: async () => {
      const tiers = await base44.entities.ReferralTier.filter({
        user_id: userId
      });
      return tiers[0] || null;
    },
    enabled: !!userId
  });

  const userReferrals = ltvData.filter(ltv => ltv.referral_type === 'user');
  const businessReferrals = ltvData.filter(ltv => ltv.referral_type === 'business');
  
  const totalLTV = ltvData.reduce((sum, ltv) => sum + (ltv.total_value || 0), 0);
  const avgLTV = ltvData.length > 0 ? totalLTV / ltvData.length : 0;

  const tierProgress = tier 
    ? ((tier.total_referrals % 10) / 10) * 100 
    : 0;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <Network className="w-6 h-6" />
          Referral Network
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Tier Progress */}
        <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-900">Tier Level {tier?.tier_level || 1}</span>
            <Badge className="bg-purple-600">{tier?.bonus_multiplier || 1}x Multiplier</Badge>
          </div>
          <Progress value={tierProgress} className="h-2 mb-2" />
          <p className="text-xs text-gray-600">
            {tier?.total_referrals || 0} total referrals • {10 - (tier?.total_referrals % 10 || 0)} to next level
          </p>
        </div>

        {/* Network Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-blue-600">{userReferrals.length}</p>
            <p className="text-sm text-gray-600">User Referrals</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <p className="text-2xl font-bold text-green-600">{businessReferrals.length}</p>
            <p className="text-sm text-gray-600">Business Referrals</p>
          </div>
        </div>

        {/* Lifetime Value */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Total Network Value</span>
            <span className="text-xl font-bold text-green-600">${totalLTV.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Avg Value Per Referral</span>
            <span className="text-lg font-semibold text-blue-600">${avgLTV.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Active Referrals</span>
            <span className="text-lg font-semibold text-purple-600">{tier?.active_referrals || 0}</span>
          </div>
        </div>

        {/* Top Referrals */}
        {ltvData.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Top Performers
            </h4>
            <div className="space-y-2">
              {ltvData
                .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
                .slice(0, 5)
                .map((ltv, idx) => (
                  <div key={ltv.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-500">#{idx + 1}</span>
                      <Badge variant="outline" className="capitalize">{ltv.referral_type}</Badge>
                    </div>
                    <span className="font-semibold text-green-600">${ltv.total_value.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}