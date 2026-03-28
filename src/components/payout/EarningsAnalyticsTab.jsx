import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line
} from 'recharts';
import { TrendingUp, DollarSign, Users, Zap } from 'lucide-react';
import { format, subDays, startOfWeek, eachDayOfInterval } from 'date-fns';

export default function EarningsAnalyticsTab({ user }) {
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions-analytics', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 200),
    enabled: !!user?.id,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-analytics', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  // Daily earnings for last 30 days
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEarnings = transactions
        .filter(t => t.created_date?.startsWith(dayStr) && t.transaction_type !== 'platform_fee')
        .reduce((sum, t) => sum + (t.net_amount || t.amount || 0), 0);
      const referralEarnings = transactions
        .filter(t => t.created_date?.startsWith(dayStr) && t.transaction_type === 'referral_commission')
        .reduce((sum, t) => sum + (t.net_amount || t.amount || 0), 0);
      return {
        date: format(day, 'MMM d'),
        earnings: parseFloat(dayEarnings.toFixed(2)),
        referral: parseFloat(referralEarnings.toFixed(2)),
        survey: parseFloat((dayEarnings - referralEarnings).toFixed(2)),
      };
    });
  }, [transactions]);

  // Weekly data
  const weeklyData = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7));
      const weekDays = eachDayOfInterval({ start: weekStart, end: subDays(weekStart, -6) });
      const weekEarnings = weekDays.reduce((sum, day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        return sum + transactions
          .filter(t => t.created_date?.startsWith(dayStr))
          .reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);
      }, 0);
      weeks.push({ week: `Wk ${format(weekStart, 'MMM d')}`, earnings: parseFloat(weekEarnings.toFixed(2)) });
    }
    return weeks;
  }, [transactions]);

  // Projected earnings — linear regression on last 14 days
  const projectedData = useMemo(() => {
    const last14 = dailyData.slice(-14);
    const n = last14.length;
    if (n < 2) return [];
    const sumX = last14.reduce((s, _, i) => s + i, 0);
    const sumY = last14.reduce((s, d) => s + d.earnings, 0);
    const sumXY = last14.reduce((s, d, i) => s + i * d.earnings, 0);
    const sumX2 = last14.reduce((s, _, i) => s + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n;

    const future = [];
    for (let i = 1; i <= 14; i++) {
      const projected = Math.max(intercept + slope * (n + i - 1), 0);
      future.push({
        date: format(subDays(new Date(), -i), 'MMM d'),
        projected: parseFloat(projected.toFixed(2)),
      });
    }
    return future;
  }, [dailyData]);

  const totalEarnings = transactions.reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);
  const referralTotal = transactions
    .filter(t => t.transaction_type === 'referral_commission')
    .reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);
  const avgDaily = dailyData.length > 0 ? dailyData.reduce((s, d) => s + d.earnings, 0) / dailyData.length : 0;
  const projectedMonthly = avgDaily * 30;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Earned', value: `$${totalEarnings.toFixed(2)}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'From Referrals', value: `$${referralTotal.toFixed(2)}`, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Avg Daily', value: `$${avgDaily.toFixed(2)}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Projected / Month', value: `$${projectedMonthly.toFixed(2)}`, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Earnings Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Earnings — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="surveyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="referralGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v, name) => [`$${v.toFixed(2)}`, name === 'survey' ? 'Survey' : 'Referral']} />
              <Area type="monotone" dataKey="survey" stackId="1" stroke="#7c3aed" fill="url(#surveyGrad)" name="survey" />
              <Area type="monotone" dataKey="referral" stackId="1" stroke="#059669" fill="url(#referralGrad)" name="referral" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Weekly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => [`$${v.toFixed(2)}`, 'Earnings']} />
              <Bar dataKey="earnings" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Projected Earnings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projected Earnings — Next 14 Days</CardTitle>
          <p className="text-xs text-gray-500">Based on your historical growth rate</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={projectedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => [`$${v.toFixed(2)}`, 'Projected']} />
              <Line type="monotone" dataKey="projected" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Estimated monthly earnings at current pace: <span className="font-semibold text-amber-600">${projectedMonthly.toFixed(2)}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}