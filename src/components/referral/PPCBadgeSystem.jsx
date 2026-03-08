import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame, Star, Shield, Crown, Zap, Users, DollarSign, Award, Target } from 'lucide-react';

const BADGES = [
  // Survey Streak badges
  { id: 'streak_3', icon: Flame, label: '3-Day Streak', desc: 'Complete surveys 3 days in a row', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', check: ({ streak }) => streak >= 3 },
  { id: 'streak_7', icon: Flame, label: '7-Day Streak', desc: 'Complete surveys 7 days in a row', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', check: ({ streak }) => streak >= 7 },
  { id: 'streak_30', icon: Flame, label: '30-Day Streak', desc: 'Complete surveys 30 days in a row', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300', check: ({ streak }) => streak >= 30 },
  // Referral badges
  { id: 'first_ref', icon: Users, label: 'First Referral', desc: 'Successfully refer your first user', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', check: ({ refs }) => refs >= 1 },
  { id: 'refs_5', icon: Users, label: 'Team Builder', desc: '5 active referrals', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', check: ({ refs }) => refs >= 5 },
  { id: 'refs_10', icon: Users, label: 'Community Leader', desc: '10 active referrals — Tier 2 unlocked!', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', check: ({ refs }) => refs >= 10 },
  { id: 'refs_50', icon: Users, label: 'Empire Builder', desc: '50 active referrals — Tier 3 unlocked!', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', check: ({ refs }) => refs >= 50 },
  // PPC Tier badges
  { id: 'tier1', icon: Shield, label: 'Tier 1 Member', desc: 'Active on BitLabs survey network', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', check: ({ tier }) => tier >= 1 },
  { id: 'tier2', icon: Star, label: 'Tier 2 Unlocked', desc: 'Reached PPC Network tier', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', check: ({ tier }) => tier >= 2 },
  { id: 'tier3', icon: Crown, label: 'Tier 3 — Elite', desc: 'Advertising Partner tier', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-300', check: ({ tier }) => tier >= 3 },
  // Earnings badges
  { id: 'earn_10', icon: DollarSign, label: 'First $10', desc: 'Earned $10 in commissions', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', check: ({ commission }) => commission >= 10 },
  { id: 'earn_100', icon: DollarSign, label: '$100 Club', desc: 'Earned $100 in commissions', color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-300', check: ({ commission }) => commission >= 100 },
  { id: 'earn_1000', icon: Trophy, label: '$1,000 Elite', desc: 'Earned $1,000 in commissions', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300', check: ({ commission }) => commission >= 1000 },
];

function calcStreak(dailyEarnings) {
  if (!dailyEarnings.length) return 0;
  const sorted = [...dailyEarnings]
    .filter(d => d.total_surveys_completed > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!sorted.length) return 0;
  let streak = 0;
  let prev = null;
  for (const day of sorted) {
    const d = new Date(day.date);
    if (!prev) { streak = 1; prev = d; continue; }
    const diff = (prev - d) / (1000 * 60 * 60 * 24);
    if (diff === 1) { streak++; prev = d; } else break;
  }
  return streak;
}

export default function PPCBadgeSystem({ user, referrals = [], currentTier = 1, dailyEarnings = [] }) {
  const streak = calcStreak(dailyEarnings);
  const activeRefs = referrals.filter(r => r.status === 'active').length;
  const commission = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);

  const ctx = { streak, refs: activeRefs, tier: currentTier, commission };
  const earned = BADGES.filter(b => b.check(ctx));
  const locked = BADGES.filter(b => !b.check(ctx));

  return (
    <div className="space-y-6">
      {/* Streak Counter */}
      <Card className="border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-sm text-orange-700 font-medium">Daily Survey Streak</p>
            <p className="text-4xl font-bold text-orange-600">{streak} <span className="text-lg font-normal text-orange-500">day{streak !== 1 ? 's' : ''}</span></p>
            <p className="text-xs text-orange-500 mt-0.5">Complete surveys daily to grow your streak & unlock badges</p>
          </div>
          {streak >= 7 && (
            <div className="ml-auto flex-shrink-0">
              <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1">🔥 On Fire!</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Earned Badges */}
      {earned.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> Earned Badges ({earned.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {earned.map(badge => (
              <Card key={badge.id} className={`border-2 ${badge.border} ${badge.bg}`}>
                <CardContent className="p-4 text-center">
                  <div className={`w-12 h-12 ${badge.bg} rounded-full flex items-center justify-center mx-auto mb-2 border-2 ${badge.border}`}>
                    <badge.icon className={`w-6 h-6 ${badge.color}`} />
                  </div>
                  <p className={`text-sm font-bold ${badge.color}`}>{badge.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{badge.desc}</p>
                  <Badge className="mt-2 text-xs bg-white text-gray-600 border">Earned ✓</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Locked Badges */}
      {locked.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-500 mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-gray-400" /> Locked Badges ({locked.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {locked.map(badge => (
              <Card key={badge.id} className="border-2 border-gray-200 bg-gray-50 opacity-60">
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <badge.icon className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-500">{badge.label}</p>
                  <p className="text-xs text-gray-400 mt-1">{badge.desc}</p>
                  <Badge variant="secondary" className="mt-2 text-xs">Locked 🔒</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}