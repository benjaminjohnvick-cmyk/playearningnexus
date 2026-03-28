import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, Zap, CheckCircle2, Clock, AlertCircle, Target } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';

const PAYOUT_METHODS = [
  {
    id: 'paypal',
    label: 'PayPal',
    icon: '💳',
    feeFlat: 0,
    feePct: 0,           // personal transfer: free
    minThreshold: 1,
    speed: '1-2 business days',
    pros: ['No fees for personal transfers', 'Fast processing', 'Widely accepted'],
    cons: ['Requires PayPal account', 'Can hold funds'],
    score: 95,
  },
  {
    id: 'venmo',
    label: 'Venmo',
    icon: '💸',
    feeFlat: 0,
    feePct: 1.75,        // instant transfer fee
    minThreshold: 1,
    speed: '1-3 business days (free) / instant (1.75% fee)',
    pros: ['Very fast instant transfer option', 'Popular in the US'],
    cons: ['1.75% instant transfer fee', 'US only'],
    score: 82,
  },
  {
    id: 'cashapp',
    label: 'Cash App',
    icon: '💵',
    feeFlat: 0,
    feePct: 1.5,
    minThreshold: 1,
    speed: '1-3 business days (free) / instant (1.5% fee)',
    pros: ['Simple to use', 'Instant transfer available'],
    cons: ['1.5% instant transfer fee', 'US only'],
    score: 80,
  },
  {
    id: 'gift_card',
    label: 'Gift Card',
    icon: '🎁',
    feeFlat: 0,
    feePct: 0,
    minThreshold: 5,
    speed: 'Instant delivery',
    pros: ['Instant', 'No fees', 'Available at lower thresholds'],
    cons: ['Less flexible than cash', 'Cannot be re-sold easily'],
    score: 72,
  },
  {
    id: 'bank_transfer',
    label: 'Bank Transfer (ACH)',
    icon: '🏦',
    feeFlat: 0,
    feePct: 0,
    minThreshold: 25,
    speed: '3-5 business days',
    pros: ['No fees', 'Direct to bank account'],
    cons: ['Slow processing (3-5 days)', 'Higher minimum threshold'],
    score: 78,
  },
];

function methodFee(method, amount) {
  return method.feeFlat + (amount * method.feePct / 100);
}

export default function PayoutOptimizer({ user, payoutPref }) {
  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['optimizer-daily', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 30),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['optimizer-payouts', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 30),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const stats = useMemo(() => {
    const last30 = dailyEarnings.slice(0, 30);
    const daysActive = last30.filter(d => d.total_earned > 0).length;
    const totalEarned30 = last30.reduce((s, d) => s + (d.total_earned || 0), 0);
    const avgDaily = daysActive > 0 ? totalEarned30 / daysActive : 0;
    const avgWeekly = avgDaily * 7;
    const currentBalance = user?.total_earnings || 0;
    return { avgDaily, avgWeekly, daysActive, currentBalance, totalEarned30 };
  }, [dailyEarnings, user]);

  // Payout projection: days until each common threshold
  const thresholds = [10, 25, 50, 100];
  const projections = thresholds.map(goal => {
    const needed = Math.max(0, goal - stats.currentBalance);
    const days = stats.avgDaily > 0 ? Math.ceil(needed / stats.avgDaily) : null;
    return { goal, needed, days, date: days != null ? format(addDays(new Date(), days), 'MMM d, yyyy') : null };
  }).filter(p => p.needed > 0);

  // Best method for current balance
  const currentBalance = stats.currentBalance;
  const rankedMethods = [...PAYOUT_METHODS]
    .filter(m => currentBalance >= m.minThreshold)
    .map(m => ({
      ...m,
      fee: methodFee(m, currentBalance),
      netAmount: currentBalance - methodFee(m, currentBalance),
      recommended: m.id === (payoutPref?.payout_method || 'paypal'),
    }))
    .sort((a, b) => b.score - a.score);

  const bestMethod = rankedMethods[0];
  const currentMethod = rankedMethods.find(m => m.id === payoutPref?.payout_method) || bestMethod;

  const nextGoal = projections[0];
  const progressToNextGoal = nextGoal ? Math.min((currentBalance / nextGoal.goal) * 100, 100) : 100;

  return (
    <div className="space-y-5">
      {/* Earnings velocity */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Avg Daily Earnings', value: `$${stats.avgDaily.toFixed(2)}`, sub: 'last 30 days', color: 'text-green-600', bg: 'bg-green-50', icon: DollarSign },
          { label: 'Avg Weekly Earnings', value: `$${stats.avgWeekly.toFixed(2)}`, sub: 'projected', color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingUp },
          { label: 'Active Survey Days', value: `${stats.daysActive}/30`, sub: 'this month', color: 'text-purple-600', bg: 'bg-purple-50', icon: Target },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-2">
                <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400">{s.sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payout Projection */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" /> Payout Projection
          </CardTitle>
          <p className="text-xs text-gray-500">Based on your avg daily rate of ${stats.avgDaily.toFixed(2)}/day</p>
        </CardHeader>
        <CardContent>
          {stats.avgDaily === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Complete surveys to see your payout projections
            </div>
          ) : (
            <div className="space-y-4">
              {nextGoal && (
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-indigo-900">Next Redemption Goal: ${nextGoal.goal}</p>
                      <p className="text-sm text-indigo-700">Need ${nextGoal.needed.toFixed(2)} more · Est. {nextGoal.date}</p>
                    </div>
                    <Badge className="bg-indigo-200 text-indigo-800">{nextGoal.days} days</Badge>
                  </div>
                  <Progress value={progressToNextGoal} className="h-2.5" />
                  <p className="text-xs text-indigo-500 mt-1">${currentBalance.toFixed(2)} / ${nextGoal.goal}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {projections.slice(1).map(p => (
                  <div key={p.goal} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="font-bold text-gray-800">${p.goal} goal</p>
                    <p className="text-xs text-gray-500">Need ${p.needed.toFixed(2)}</p>
                    <p className="text-sm font-semibold text-blue-600 mt-1">{p.date || '—'}</p>
                    {p.days && <p className="text-xs text-gray-400">~{p.days} days away</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Method Optimizer */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Best Withdrawal Method for ${currentBalance.toFixed(2)}
          </CardTitle>
          <p className="text-xs text-gray-500">Ranked by cost-efficiency and speed for your current balance</p>
        </CardHeader>
        <CardContent>
          {rankedMethods.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              Keep earning to unlock withdrawal options
            </div>
          ) : (
            <div className="space-y-3">
              {rankedMethods.map((method, i) => (
                <div
                  key={method.id}
                  className={`p-4 rounded-xl border-2 transition-all ${i === 0 ? 'border-green-300 bg-green-50' : method.recommended ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{method.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900">{method.label}</p>
                          {i === 0 && <Badge className="bg-green-200 text-green-800 text-xs">⭐ Best Option</Badge>}
                          {method.recommended && i !== 0 && <Badge className="bg-blue-100 text-blue-700 text-xs">Your Current</Badge>}
                        </div>
                        <p className="text-xs text-gray-500">{method.speed}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-black text-gray-900">${method.netAmount.toFixed(2)}</p>
                      {method.fee > 0 && <p className="text-xs text-red-500">-${method.fee.toFixed(2)} fee</p>}
                      {method.fee === 0 && <p className="text-xs text-green-600">No fees</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {method.pros.map(p => (
                      <span key={p} className="text-xs bg-white border border-green-200 text-green-700 px-2 py-0.5 rounded-full">✓ {p}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}