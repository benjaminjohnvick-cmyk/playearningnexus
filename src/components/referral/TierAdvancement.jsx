import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Lock, TrendingUp, Trophy, Star, Zap, ArrowRight } from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList
} from 'recharts';

const TIERS = [
  {
    level: 1,
    name: 'Tier 1',
    subtitle: 'Starter',
    icon: Star,
    color: '#64748b',
    gradient: 'from-slate-400 to-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    text: 'text-slate-700',
    commissionRate: 5,
    dailyEarning: 3,
    requirements: null,
    perks: ['$3/day from surveys', '5% referral commission', 'Access to Tier 1 PPC'],
  },
  {
    level: 2,
    name: 'Tier 2',
    subtitle: 'PPC Network',
    icon: TrendingUp,
    color: '#7c3aed',
    gradient: 'from-purple-500 to-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    text: 'text-purple-700',
    commissionRate: 15,
    dailyEarning: 8,
    requirements: [
      { label: 'Active Referrals', key: 'activeReferrals', target: 20, unit: '' },
      { label: 'Commission Earned', key: 'totalCommission', target: 2190, unit: '$', isMoney: true },
    ],
    perks: ['$8/day from PPC sessions', '15% referral commission (+10%)', '$292/yr per referral'],
    commissionBoost: '+200%',
  },
  {
    level: 3,
    name: 'Tier 3',
    subtitle: 'Brand Partners',
    icon: Trophy,
    color: '#d97706',
    gradient: 'from-yellow-500 to-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
    commissionRate: 30,
    dailyEarning: 240,
    requirements: [
      { label: 'Tier 2 Days', key: 'tier2Days', target: 365, unit: ' days' },
      { label: 'Active Referrals', key: 'activeReferrals', target: 200, unit: '' },
    ],
    perks: ['$240/day from brand sessions', '30% referral commission (+100%)', '$24/referral/day'],
    commissionBoost: '+500%',
  },
];

const COMMISSION_DATA = TIERS.map(t => ({
  name: t.name,
  rate: t.commissionRate,
  daily: t.dailyEarning,
  color: t.color,
}));

export default function TierAdvancement({ currentTier = 1, activeReferrals = 0, totalCommission = 0, tier2Days = 0 }) {
  const stats = { activeReferrals, totalCommission, tier2Days };
  const nextTier = TIERS.find(t => t.level > currentTier);

  return (
    <div className="space-y-6">
      {/* Commission comparison bar chart */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Commission Rate by Tier
          </CardTitle>
          <p className="text-xs text-gray-400">See how much more you earn as you advance</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={COMMISSION_DATA} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 35]} />
              <Tooltip formatter={(v, name) => name === 'rate' ? `${v}%` : `$${v}`} />
              <Bar dataKey="rate" name="Commission Rate" radius={[6, 6, 0, 0]}>
                {COMMISSION_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} opacity={TIERS[i].level <= currentTier ? 1 : 0.35} />
                ))}
                <LabelList dataKey="rate" position="top" formatter={v => `${v}%`} style={{ fontSize: 11, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Boost badges */}
          <div className="flex gap-3 mt-3 flex-wrap">
            {TIERS.filter(t => t.commissionBoost).map(t => (
              <div key={t.level} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${t.border} ${t.bg}`}>
                <t.icon className={`w-3.5 h-3.5 ${t.text}`} />
                <span className={`text-xs font-bold ${t.text}`}>{t.name}: {t.commissionBoost} vs Tier 1</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tier cards */}
      <div className="space-y-4">
        {TIERS.map(tier => {
          const Icon = tier.icon;
          const isUnlocked = currentTier >= tier.level;
          const isActive = currentTier === tier.level;
          const isNext = nextTier?.level === tier.level;

          return (
            <Card key={tier.level} className={`border-2 overflow-hidden transition-shadow ${isActive ? 'border-green-400 shadow-lg' : isNext ? `${tier.border} shadow-md` : 'border-gray-200'}`}>
              <div className={`h-1 bg-gradient-to-r ${tier.gradient}`} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${tier.gradient} shadow`}>
                      {isUnlocked
                        ? <CheckCircle2 className="w-5 h-5 text-white" />
                        : <Icon className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{tier.name}</p>
                        <span className="text-xs text-gray-400">— {tier.subtitle}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isActive && <Badge className="bg-green-100 text-green-700 border-0 text-xs">✓ Active</Badge>}
                        {isUnlocked && !isActive && <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">Completed</Badge>}
                        {!isUnlocked && isNext && <Badge className={`${tier.bg} ${tier.text} border-0 text-xs`}>Next Level</Badge>}
                        {!isUnlocked && !isNext && <Badge className="bg-gray-100 text-gray-400 border-0 text-xs flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Locked</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${tier.text}`}>{tier.commissionRate}%</p>
                    <p className="text-xs text-gray-400">commission</p>
                  </div>
                </div>

                {/* Requirements with progress */}
                {!isUnlocked && tier.requirements && (
                  <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Requirements to unlock</p>
                    {tier.requirements.map((req, i) => {
                      const current = stats[req.key] || 0;
                      const pct = Math.min(100, (current / req.target) * 100);
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{req.label}</span>
                            <span className="font-semibold text-gray-800">
                              {req.isMoney
                                ? `$${current.toFixed(0)} / $${req.target.toLocaleString()}`
                                : `${current}${req.unit} / ${req.target}${req.unit}`}
                            </span>
                          </div>
                          <Progress value={pct} className="h-2" />
                          <p className="text-xs text-gray-400 mt-0.5 text-right">{pct.toFixed(0)}% there</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Perks */}
                <div className={`p-3 ${tier.bg} rounded-xl`}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Perks</p>
                  <div className="grid grid-cols-1 gap-1">
                    {tier.perks.map((perk, i) => (
                      <p key={i} className={`text-xs flex items-center gap-1.5 ${isUnlocked ? tier.text : 'text-gray-400'}`}>
                        <ArrowRight className="w-3 h-3 flex-shrink-0" />{perk}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Daily earning highlight */}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Daily earning potential</span>
                  <span className={`text-sm font-bold ${isUnlocked ? tier.text : 'text-gray-400'}`}>
                    ${tier.dailyEarning}/day
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}