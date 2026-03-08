import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Lock, Zap, TrendingUp, Trophy, Star, ArrowRight, Info } from "lucide-react";

const TIERS = [
  {
    num: 1,
    name: 'Tier 1 — BitLabs',
    color: 'from-blue-500 to-blue-700',
    bgLight: 'bg-blue-50',
    border: 'border-blue-200',
    textColor: 'text-blue-700',
    icon: Zap,
    requirements: [
      { label: 'Daily earnings $3+ for 365 days', key: 'tier1_days_active', target: 365 },
      { label: 'OR $2,190 in referral fees', key: 'tier1_referral_earnings', target: 2190, isMoney: true },
    ],
    projections: ['$3/day personal → $1,095/year', '$109.50/referral (20 active users)', '$2,190 total referral target'],
    daysLabel: 'Days with $3+ earned',
  },
  {
    num: 2,
    name: 'Tier 2 — PPC Network',
    color: 'from-purple-500 to-purple-700',
    bgLight: 'bg-purple-50',
    border: 'border-purple-200',
    textColor: 'text-purple-700',
    icon: TrendingUp,
    requirements: [
      { label: '8-min sessions for 365 days', key: 'tier2_days_active', target: 365 },
    ],
    projections: ['$8/day personal → $2,920/year', '$292/referral (200 active users)', '$58,400/year referral target'],
    daysLabel: '8-min session days',
  },
  {
    num: 3,
    name: 'Tier 3 — Brand Partners',
    color: 'from-yellow-500 to-yellow-700',
    bgLight: 'bg-yellow-50',
    border: 'border-yellow-200',
    textColor: 'text-yellow-700',
    icon: Trophy,
    requirements: [
      { label: '4-hr sessions for 365 days', key: 'tier3_days_active', target: 365 },
    ],
    projections: ['$240/day personal → $87,600/year', '$24/referral/day (4,000 active users)', '$3,504,000/year referral target'],
    daysLabel: '4-hour session days',
  },
];

export default function TierProgressDashboard({ tierRecord, currentTier, onViewDetails }) {
  const tr = tierRecord || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" /> Your Tier Progress
        </h3>
        <Badge className={`text-sm px-3 py-1 ${
          currentTier === 3 ? 'bg-yellow-100 text-yellow-800' :
          currentTier === 2 ? 'bg-purple-100 text-purple-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          Currently on Tier {currentTier}
        </Badge>
      </div>

      {TIERS.map((tier) => {
        const Icon = tier.icon;
        const isCompleted = currentTier > tier.num;
        const isCurrent = currentTier === tier.num;
        const isLocked = currentTier < tier.num;

        return (
          <Card key={tier.num} className={`border-2 ${isCompleted ? 'border-green-300' : isCurrent ? tier.border : 'border-gray-100'} ${isLocked ? 'opacity-60' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center flex-shrink-0`}>
                    {isCompleted ? <CheckCircle2 className="w-6 h-6 text-white" /> : isLocked ? <Lock className="w-6 h-6 text-white" /> : <Icon className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900">{tier.name}</h4>
                      {isCompleted && <Badge className="bg-green-100 text-green-700 text-xs">✓ Completed</Badge>}
                      {isCurrent && <Badge className={`${tier.bgLight} ${tier.textColor} text-xs`}>Active</Badge>}
                      {isLocked && <Badge className="bg-gray-100 text-gray-500 text-xs">Locked</Badge>}
                    </div>

                    {/* Progress bars for requirements */}
                    <div className="mt-3 space-y-2">
                      {tier.requirements.map((req, i) => {
                        const current = tr[req.key] || 0;
                        const pct = Math.min(100, (current / req.target) * 100);
                        const displayCurrent = req.isMoney ? `$${current.toFixed(2)}` : current;
                        const displayTarget = req.isMoney ? `$${req.target.toLocaleString()}` : req.target;

                        return (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{req.label}</span>
                              <span className="font-semibold text-gray-800">{displayCurrent} / {displayTarget}</span>
                            </div>
                            <Progress value={pct} className="h-2" />
                          </div>
                        );
                      })}
                    </div>

                    {/* Earnings projections */}
                    <div className={`mt-3 p-2 ${tier.bgLight} rounded-lg`}>
                      <p className="text-xs font-semibold text-gray-600 mb-1">💰 Earnings Projections:</p>
                      <ul className="space-y-0.5">
                        {tier.projections.map((p, i) => (
                          <li key={i} className={`text-xs ${tier.textColor}`}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <Button size="sm" variant="ghost" onClick={() => onViewDetails(tier.num)} className="flex-shrink-0">
                  <Info className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}