import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Clock, TrendingUp, Target, Zap, CheckCircle2 } from 'lucide-react';

const PAYOUT_THRESHOLDS = [10, 25, 50, 100, 250, 500];

function getNextThreshold(balance) {
  return PAYOUT_THRESHOLDS.find(t => t > balance) || null;
}

function getPrevThreshold(balance) {
  const passed = PAYOUT_THRESHOLDS.filter(t => t <= balance);
  return passed.length > 0 ? passed[passed.length - 1] : 0;
}

export default function PayoutProgressDashboard({ user, transactions = [], payouts = [], dailyEarnings = [] }) {
  const balance = user?.current_balance || 0;
  const lifetimeEarned = user?.total_earnings || 0;

  const pendingAmount = payouts
    .filter(p => p.status === 'pending' || p.status === 'processing')
    .reduce((s, p) => s + (p.amount || 0), 0);

  const completedPayouts = payouts
    .filter(p => p.status === 'completed')
    .reduce((s, p) => s + (p.amount || 0), 0);

  // Projected monthly earnings based on last 7 days avg
  const projected = useMemo(() => {
    const last7 = dailyEarnings.slice(0, 7);
    if (last7.length === 0) return 0;
    const avg = last7.reduce((s, d) => s + (d.total_earned || 0), 0) / last7.length;
    return avg * 30;
  }, [dailyEarnings]);

  // Days until next payout threshold at current rate
  const daysUntilNext = useMemo(() => {
    const next = getNextThreshold(balance);
    if (!next) return null;
    const gap = next - balance;
    const last7 = dailyEarnings.slice(0, 7);
    if (last7.length === 0) return null;
    const dailyAvg = last7.reduce((s, d) => s + (d.total_earned || 0), 0) / last7.length;
    if (dailyAvg <= 0) return null;
    return Math.ceil(gap / dailyAvg);
  }, [balance, dailyEarnings]);

  const nextThreshold = getNextThreshold(balance);
  const prevThreshold = getPrevThreshold(balance);
  const progressPct = nextThreshold
    ? Math.min(100, ((balance - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Payout Progress Bar */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-green-600" />
            Next Payout Threshold
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between mb-1">
            <div>
              <p className="text-3xl font-black text-green-700">${balance.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Available balance</p>
            </div>
            {nextThreshold ? (
              <div className="text-right">
                <p className="text-xl font-bold text-gray-700">${nextThreshold}</p>
                <p className="text-xs text-gray-400">next threshold</p>
              </div>
            ) : (
              <Badge className="bg-green-600">Max Threshold Reached! 🎉</Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <Progress value={progressPct} className="h-4 rounded-full" />
            <div className="flex justify-between text-xs text-gray-400">
              <span>${prevThreshold}</span>
              {nextThreshold && <span className="text-green-600 font-semibold">${(nextThreshold - balance).toFixed(2)} to go</span>}
              {nextThreshold && <span>${nextThreshold}</span>}
            </div>
          </div>

          {daysUntilNext && (
            <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-100 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4 flex-shrink-0" />
              At your current rate, you'll reach ${nextThreshold} in approximately <strong>{daysUntilNext} day{daysUntilNext !== 1 ? 's' : ''}</strong>
            </div>
          )}

          {/* Milestone badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PAYOUT_THRESHOLDS.map(t => (
              <Badge key={t}
                className={balance >= t
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-gray-100 text-gray-400 border border-gray-200'}>
                {balance >= t && <CheckCircle2 className="w-3 h-3 mr-1" />}
                ${t}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Lifetime Earned', value: `$${lifetimeEarned.toFixed(2)}`, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Pending Payout', value: `$${pendingAmount.toFixed(2)}`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Total Paid Out', value: `$${completedPayouts.toFixed(2)}`, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Projected Monthly', value: `$${projected.toFixed(2)}`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`${bg} p-2.5 rounded-xl flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 truncate">{label}</p>
                <p className={`text-base font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent payouts */}
      {payouts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" /> Recent Payout Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payouts.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium capitalize">{(p.payout_type || 'payout').replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-400">{new Date(p.created_date).toLocaleDateString()} · {p.method || 'PayPal'}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="font-bold text-green-600">${(p.amount || 0).toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === 'completed' ? 'bg-green-100 text-green-700' :
                      p.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}