import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Lock, Zap, TrendingUp, Trophy, Gift } from 'lucide-react';

const TIERS = [
  {
    num: 2,
    name: 'Tier 2 — PPC Network',
    color: 'from-purple-500 to-purple-700',
    bgLight: 'bg-purple-50',
    border: 'border-purple-300',
    textColor: 'text-purple-700',
    icon: TrendingUp,
    requirements: [
      { label: 'Active referrals needed', current_key: 'activeReferrals', target: 20 },
      { label: 'Commission earned ($2,190 goal)', current_key: 'totalCommission', target: 2190, isMoney: true },
    ],
    perks: [
      '💰 Earn $8/day from PPC sessions',
      '📈 $292/year per active referral',
      '🎯 $58,400/year referral potential',
      '⚡ 8-minute daily session format',
    ],
  },
  {
    num: 3,
    name: 'Tier 3 — Brand Partners',
    color: 'from-yellow-500 to-yellow-700',
    bgLight: 'bg-yellow-50',
    border: 'border-yellow-300',
    textColor: 'text-yellow-700',
    icon: Trophy,
    requirements: [
      { label: 'Tier 2 days completed', current_key: 'tier2Days', target: 365 },
      { label: 'Active referrals needed', current_key: 'activeReferrals', target: 200 },
    ],
    perks: [
      '🏆 Earn $240/day from brand sessions',
      '💎 $24/referral/day commission',
      '🌟 $3.5M/year referral potential',
      '🛍️ Exclusive brand partner access',
    ],
  },
];

export default function TierMilestoneProgress({ activeReferrals, totalCommission, tier2Days, currentTier }) {
  const stats = { activeReferrals, totalCommission, tier2Days };

  return (
    <div className="space-y-4">
      {TIERS.map(tier => {
        const Icon = tier.icon;
        const isUnlocked = currentTier >= tier.num;
        const isCurrent = currentTier === tier.num;

        return (
          <Card key={tier.num} className={`border-2 ${isUnlocked ? 'border-green-300' : tier.border} overflow-hidden`}>
            <div className={`h-1.5 bg-gradient-to-r ${tier.color}`} />
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${tier.color} rounded-xl flex items-center justify-center`}>
                    {isUnlocked ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{tier.name}</p>
                    {isUnlocked && <Badge className="bg-green-100 text-green-700 text-xs">✓ Unlocked</Badge>}
                    {!isUnlocked && <Badge className="bg-gray-100 text-gray-500 text-xs flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Locked</Badge>}
                  </div>
                </div>
                {isCurrent && <Badge className={`${tier.bgLight} ${tier.textColor}`}>Active</Badge>}
              </div>

              {/* Progress bars */}
              {!isUnlocked && (
                <div className="space-y-3 mb-4">
                  {tier.requirements.map((req, i) => {
                    const current = stats[req.current_key] || 0;
                    const pct = Math.min(100, (current / req.target) * 100);
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{req.label}</span>
                          <span className="font-semibold text-gray-800">
                            {req.isMoney ? `$${current.toFixed(0)} / $${req.target.toLocaleString()}` : `${current} / ${req.target}`}
                          </span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Perks */}
              <div className={`p-3 ${tier.bgLight} rounded-xl`}>
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Gift className="w-3 h-3" /> Unlocked Perks
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {tier.perks.map((perk, i) => (
                    <p key={i} className={`text-xs ${isUnlocked ? tier.textColor : 'text-gray-400'}`}>{perk}</p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}