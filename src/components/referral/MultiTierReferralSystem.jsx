import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  Star, 
  TrendingUp, 
  Copy,
  Plus,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

const TIER_REQUIREMENTS = [
  { level: 1, name: 'Bronze', referrals: 0, multiplier: 1, color: 'amber' },
  { level: 2, name: 'Silver', referrals: 10, multiplier: 1.2, color: 'gray' },
  { level: 3, name: 'Gold', referrals: 25, multiplier: 1.5, color: 'yellow' },
  { level: 4, name: 'Platinum', referrals: 50, multiplier: 2, color: 'blue' },
  { level: 5, name: 'Diamond', referrals: 100, multiplier: 3, color: 'purple' }
];

export default function MultiTierReferralSystem({ user }) {
  const queryClient = useQueryClient();

  const { data: referralTier } = useQuery({
    queryKey: ['referral-tier', user?.id],
    queryFn: async () => {
      const tiers = await base44.entities.ReferralTier.filter({ user_id: user.id });
      if (tiers.length === 0) {
        return await base44.entities.ReferralTier.create({
          user_id: user.id,
          tier_level: 1,
          bonus_multiplier: 1
        });
      }
      return tiers[0];
    },
    enabled: !!user
  });

  const { data: customLinks = [] } = useQuery({
    queryKey: ['custom-links', user?.id],
    queryFn: async () => {
      return await base44.entities.CustomReferralLink.filter({ user_id: user.id });
    },
    enabled: !!user
  });

  const { data: lifetimeValues = [] } = useQuery({
    queryKey: ['lifetime-values', user?.id],
    queryFn: async () => {
      return await base44.entities.ReferralLifetimeValue.filter({ referrer_user_id: user.id });
    },
    enabled: !!user
  });

  const createLinkMutation = useMutation({
    mutationFn: async (data) => {
      const linkCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      return await base44.entities.CustomReferralLink.create({
        user_id: user.id,
        link_code: linkCode,
        ...data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-links']);
      toast.success('Custom referral link created!');
    }
  });

  const currentTier = TIER_REQUIREMENTS.find(t => t.level === (referralTier?.tier_level || 1));
  const nextTier = TIER_REQUIREMENTS.find(t => t.level === (referralTier?.tier_level || 1) + 1);
  const progress = nextTier 
    ? ((referralTier?.total_referrals || 0) / nextTier.referrals) * 100 
    : 100;

  const totalLTV = lifetimeValues.reduce((sum, ltv) => sum + (ltv.total_value || 0), 0);

  const copyLink = (linkCode) => {
    const url = `${window.location.origin}?ref=${linkCode}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Current Tier */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              <span>{currentTier.name} Tier</span>
            </div>
            <Badge className="bg-white text-purple-600">
              {currentTier.multiplier}x Bonus
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>{referralTier?.total_referrals || 0} referrals</span>
            {nextTier && <span>{nextTier.referrals} for {nextTier.name}</span>}
          </div>
          <Progress value={progress} className="h-3 bg-purple-700" />
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-purple-400">
            <div>
              <p className="text-sm text-purple-100">Lifetime Value</p>
              <p className="text-2xl font-bold">${totalLTV.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-purple-100">Active Referrals</p>
              <p className="text-2xl font-bold">{referralTier?.active_referrals || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Links */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Custom Referral Links</span>
            <Button
              size="sm"
              onClick={() => createLinkMutation.mutate({ link_type: 'general' })}
              className="bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Link
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {customLinks.map((link) => (
              <div key={link.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Badge className={link.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200'}>
                      {link.link_type}
                    </Badge>
                    <span className="ml-2 text-sm font-mono">{link.link_code}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyLink(link.link_code)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{link.clicks} clicks</span>
                  <span>{link.conversions} conversions</span>
                  <span className="text-green-600 font-semibold">${link.total_earned.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tier Roadmap */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Tier Roadmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {TIER_REQUIREMENTS.map((tier) => {
              const isCurrentTier = tier.level === (referralTier?.tier_level || 1);
              const isUnlocked = tier.level <= (referralTier?.tier_level || 1);
              
              return (
                <div
                  key={tier.level}
                  className={`p-4 rounded-lg border-2 ${
                    isCurrentTier
                      ? 'border-purple-500 bg-purple-50'
                      : isUnlocked
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isUnlocked ? (
                        <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <Star className="w-6 h-6 text-gray-400" />
                      )}
                      <div>
                        <h4 className="font-bold text-gray-900">{tier.name}</h4>
                        <p className="text-sm text-gray-600">
                          {tier.referrals} referrals required
                        </p>
                      </div>
                    </div>
                    <Badge className={`${isUnlocked ? 'bg-green-100 text-green-700' : 'bg-gray-200'}`}>
                      {tier.multiplier}x multiplier
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}