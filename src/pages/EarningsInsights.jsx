import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, DollarSign, Users, Zap } from 'lucide-react';
import EarningsFeed from '@/components/earnings/EarningsFeed';
import CategoryBreakdown from '@/components/earnings/CategoryBreakdown';
import { format, subDays, parseISO } from 'date-fns';

export default function EarningsInsights() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['dailyEarnings', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 30),
    enabled: !!user
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_id: user.id }, '-created_date', 60),
    enabled: !!user
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['ppcTransactions', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 60),
    enabled: !!user
  });

  // Build last-30-day chart data
  const chartData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(), 29 - i);
      return format(d, 'yyyy-MM-dd');
    });

    const earningsMap = {};
    dailyEarnings.forEach(e => { earningsMap[e.date] = e.total_earned || 0; });

    const referralMap = {};
    transactions
      .filter(t => t.transaction_type === 'referral_commission')
      .forEach(t => {
        const d = t.created_date?.split('T')[0];
        if (d) referralMap[d] = (referralMap[d] || 0) + (t.net_amount || t.amount || 0);
      });

    return days.map(date => ({
      date: format(parseISO(date), 'MMM d'),
      surveys: parseFloat((earningsMap[date] || 0).toFixed(2)),
      referrals: parseFloat((referralMap[date] || 0).toFixed(2)),
      total: parseFloat(((earningsMap[date] || 0) + (referralMap[date] || 0)).toFixed(2)),
    }));
  }, [dailyEarnings, transactions]);

  // Predictions: simple linear trend over last 7 days projected 14 days
  const predictions = useMemo(() => {
    const recent = chartData.slice(-7);
    if (recent.length < 2) return [];
    const avg = recent.reduce((sum, d) => sum + d.total, 0) / recent.length;
    const growth = recent.length > 1
      ? (recent[recent.length - 1].total - recent[0].total) / (recent.length - 1)
      : 0;

    return Array.from({ length: 14 }, (_, i) => {
      const d = subDays(new Date(), -i - 1);
      const predicted = Math.max(0, avg + growth * (i + 1));
      return {
        date: format(d, 'MMM d'),
        predicted: parseFloat(predicted.toFixed(2)),
      };
    });
  }, [chartData]);

  // Source breakdown pie
  const totalSurveys = chartData.reduce((s, d) => s + d.surveys, 0);
  const totalReferrals = chartData.reduce((s, d) => s + d.referrals, 0);
  const pieData = [
    { name: 'Surveys', value: parseFloat(totalSurveys.toFixed(2)), color: '#6366f1' },
    { name: 'Referrals', value: parseFloat(totalReferrals.toFixed(2)), color: '#10b981' },
  ];

  const totalEarned = totalSurveys + totalReferrals;
  const projectedMonthly = predictions.length
    ? predictions.reduce((s, d) => s + d.predicted, 0)
    : 0;

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Earnings Insights</h1>
          <p className="text-gray-500 mt-1">Visualize your income history and predict future growth</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '30-Day Total', value: `$${totalEarned.toFixed(2)}`, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Survey Earnings', value: `$${totalSurveys.toFixed(2)}`, icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Referral Earnings', value: `$${totalReferrals.toFixed(2)}`, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '14-Day Projection', value: `$${projectedMonthly.toFixed(2)}`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="border-0 shadow-md">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`${bg} p-3 rounded-xl`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main charts */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="area">
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg">Earnings by Source — Last 30 Days</CardTitle>
                    <TabsList>
                      <TabsTrigger value="area">Area</TabsTrigger>
                      <TabsTrigger value="bar">Bar</TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>
                <CardContent>
                  <TabsContent value="area" className="mt-0">
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorSurveys" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorReferrals" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => `$${v}`} />
                        <Legend />
                        <Area type="monotone" dataKey="surveys" name="Surveys" stroke="#6366f1" fill="url(#colorSurveys)" strokeWidth={2} />
                        <Area type="monotone" dataKey="referrals" name="Referrals" stroke="#10b981" fill="url(#colorReferrals)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </TabsContent>
                  <TabsContent value="bar" className="mt-0">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => `$${v}`} />
                        <Legend />
                        <Bar dataKey="surveys" name="Surveys" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="referrals" name="Referrals" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>
                </CardContent>
              </Card>
            </Tabs>

            {/* Prediction Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">14-Day Earnings Forecast</CardTitle>
                  <Badge className="bg-amber-100 text-amber-700 border-0">AI Prediction</Badge>
                </div>
                <p className="text-xs text-gray-400">Based on your recent growth trend</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={predictions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={1} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `$${v}`} />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Predicted Earnings"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      strokeDasharray="6 3"
                      dot={{ fill: '#f59e0b', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Pie + Feed */}
          <div className="space-y-6">
            {/* Source Breakdown */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Income Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `$${v}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-2">
                  {pieData.map(p => (
                    <div key={p.name} className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.color }} />
                        {p.name}
                      </span>
                      <span className="font-semibold">{totalEarned > 0 ? Math.round(p.value / totalEarned * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <CategoryBreakdown transactions={transactions} />

            {/* Live Feed */}
            <EarningsFeed />
          </div>
        </div>
      </div>
    </div>
  );
}