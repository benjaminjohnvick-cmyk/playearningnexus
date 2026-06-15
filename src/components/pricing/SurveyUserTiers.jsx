import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, DollarSign, ShieldCheck } from 'lucide-react';

const tiers = [
  {
    name: 'Tier 1 — Starter',
    emoji: '🟢',
    color: 'border-green-400 bg-green-50',
    badgeColor: 'bg-green-100 text-green-800',
    requirements: [
      'Complete a minimum of 4 surveys per day',
      'Must complete the required daily PPC ad task first',
      'Watch at least 16 video ads (30 sec each) per day',
      'Must play the featured game for 15 minutes',
    ],
    earnings: [
      { label: 'Minimum daily earnings', value: 'At least $8.00/day', bold: true },
      { label: 'Your share (50/50 split)', value: '$4.00/day to you', bold: true },
      { label: 'Platform share (50/50 split)', value: '$4.00/day to GamerGain', bold: false },
      { label: '$1.00 of your $4.00 goes to featured game', value: 'Days 3–6 of featured game', bold: false },
      { label: 'Minimum monthly earnings', value: '~$120/month', bold: false },
      { label: 'Minimum annual earnings', value: '~$1,460/year', bold: false },
    ],
    note: 'During the first 2 days a new game is featured, GamerGain keeps 100% of the $8.00. Starting day 3, the 50/50 split applies and $1.00 of your $4.00 goes to the developer for 4 of 6 featured days.',
  },
  {
    name: 'Tier 2 — Growth',
    emoji: '🔵',
    color: 'border-blue-400 bg-blue-50',
    badgeColor: 'bg-blue-100 text-blue-800',
    requirements: [
      'Complete a minimum of 4 surveys per day',
      'Must complete the required daily PPC ad task first',
      'Watch at least 16 video ads (30 sec each) per day',
      'Must play the featured game for 15 minutes',
      'Maintain 30+ day active streak',
      'Refer at least 1 active user per month',
    ],
    earnings: [
      { label: 'Minimum daily earnings', value: 'At least $8.00/day', bold: true },
      { label: 'Your share (50/50 split)', value: '$4.00/day to you', bold: true },
      { label: 'Bonus for 30-day streak', value: '+$10 bonus/month', bold: false },
      { label: 'Referral bonus (10% of referral earnings)', value: 'Lifetime passive income', bold: false },
      { label: 'Minimum monthly earnings', value: '~$130+/month', bold: false },
    ],
    note: 'Same 50/50 daily split applies. Same $1.00 featured game contribution on days 3–6. Streak and referral bonuses stack on top.',
  },
  {
    name: 'Tier 3 — Elite',
    emoji: '🟡',
    color: 'border-yellow-400 bg-yellow-50',
    badgeColor: 'bg-yellow-100 text-yellow-800',
    requirements: [
      'Complete a minimum of 4 surveys per day',
      'Must complete the required daily PPC ad task first',
      'Watch at least 16 video ads (30 sec each) per day',
      'Must play the featured game for 15 minutes',
      'Maintain 90+ day active streak',
      'Refer at least 3 active users per month',
      'Complete bonus surveys when available',
    ],
    earnings: [
      { label: 'Minimum daily earnings', value: 'At least $8.00/day', bold: true },
      { label: 'Your share (50/50 split)', value: '$4.00/day to you', bold: true },
      { label: 'Elite bonus multiplier', value: '+20% on all daily earnings', bold: false },
      { label: 'Priority survey access (higher-paying)', value: 'Early unlock', bold: false },
      { label: 'Minimum monthly earnings (with bonus)', value: '~$144+/month', bold: false },
    ],
    note: 'Same 50/50 daily split and featured game contribution rules apply. Elite multiplier adds 20% on top of your $4.00 base.',
  },
];

export default function SurveyUserTiers() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <Badge className="mb-3 bg-purple-100 text-purple-800 border-purple-200 text-sm px-4 py-1">
          📋 User Survey Tiers
        </Badge>
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          3 Survey Tiers — Everyone Earns At Least $8/Day
        </h2>
        <p className="text-gray-500 max-w-3xl mx-auto text-base">
          All users earn a minimum of <strong>$8.00 per day</strong>, split <strong>50/50</strong> — $4.00 to you, $4.00 to the platform.
          Complete at least 4 surveys per day to qualify. Featured game earnings are automatically distributed.
        </p>

        {/* Key Mechanics Summary */}
        <div className="mt-6 grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { icon: '💵', label: '$8.00 minimum/day', desc: 'Guaranteed daily earnings across all tiers' },
            { icon: '⚖️', label: '50/50 Split', desc: '$4 to you + $4 to platform — every single day' },
            { icon: '🎮', label: '$1 to featured game', desc: '$1 of your $4 goes to the game developer (days 3–6 of 6-day feature cycle)' },
          ].map((item, i) => (
            <div key={i} className="bg-white border-2 border-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">{item.icon}</div>
              <p className="font-black text-gray-900 text-sm">{item.label}</p>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((tier, i) => (
          <Card key={i} className={`border-2 ${tier.color}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{tier.emoji}</span>
                <div>
                  <Badge className={`text-xs ${tier.badgeColor}`}>{tier.name}</Badge>
                </div>
              </div>

              {/* Requirements */}
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-700 uppercase mb-2">Requirements</p>
                <ul className="space-y-1">
                  {tier.requirements.map((req, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-gray-700">
                      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Earnings */}
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-700 uppercase mb-2">Daily Earnings Breakdown</p>
                <div className="space-y-1">
                  {tier.earnings.map((e, j) => (
                    <div key={j} className="flex justify-between text-xs py-1 border-b border-gray-200 last:border-0">
                      <span className="text-gray-600">{e.label}</span>
                      <span className={`font-${e.bold ? 'black' : 'semibold'} text-gray-900 text-right ml-2`}>{e.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="bg-white/70 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 leading-relaxed">
                  <ShieldCheck className="w-3 h-3 inline mr-1 text-blue-500" />
                  {tier.note}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform Math Summary */}
      <div className="mt-8 bg-gradient-to-br from-slate-900 to-gray-900 rounded-2xl p-8 text-white">
        <h3 className="text-xl font-black mb-4 text-center">Platform Economics at Scale (100,000 Users)</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Users × $8/day', value: '$800,000/day', sub: 'Total daily platform earnings' },
            { label: 'Platform share (50%)', value: '$400,000/day', sub: 'GamerGain daily revenue' },
            { label: 'User share (50%)', value: '$400,000/day', sub: 'Distributed to all users' },
            { label: 'Developer payout/day', value: '$100,000/day', sub: '$1 × 100K users × 4 of 6 days avg' },
          ].map((item, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-lg font-black text-white">{item.value}</p>
              <p className="text-xs text-gray-400 mt-1">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">
          * Developer minimum: $1.00 × 100,000 users × 4 days = $400,000 per featured 6-day slot. 70 games/year ÷ 365 days × 6 = new game every ~5.2 days.
        </p>
      </div>
    </section>
  );
}