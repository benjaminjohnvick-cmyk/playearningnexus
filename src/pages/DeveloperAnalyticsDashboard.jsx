import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PayoutTrendsChart, ReferralSuccessChart, EngagementMetricsChart, PlatformHealthChart, GameCategoryBreakdownChart } from '@/components/analytics/DeveloperAnalyticsCharts';
import { Calendar, Filter } from 'lucide-react';

export default function DeveloperAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('30d');
  const [gameCategory, setGameCategory] = useState('all');
  const [affiliateTier, setAffiliateTier] = useState('all');
  const [data, setData] = useState({
    payouts: [],
    referrals: [],
    engagement: [],
    health: [],
    categories: []
  });
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const timeRangeOptions = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    '1y': 'Last Year',
    'all': 'All Time'
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange, gameCategory, affiliateTier]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate = new Date();

      if (timeRange === '7d') startDate.setDate(now.getDate() - 7);
      else if (timeRange === '30d') startDate.setDate(now.getDate() - 30);
      else if (timeRange === '90d') startDate.setDate(now.getDate() - 90);
      else if (timeRange === '1y') startDate.setFullYear(now.getFullYear() - 1);

      // Fetch payout data
      const payouts = await base44.asServiceRole.entities.Payout.filter({}, '-created_date', 100);
      const payoutsByDate = aggregatePayouts(payouts, timeRange);

      // Fetch referral data
      const referrals = await base44.asServiceRole.entities.Referral.filter({}, '-created_date', 200);
      const referralsByMonth = aggregateReferrals(referrals, timeRange);

      // Mock engagement data
      const engagementData = generateEngagementData(timeRange);

      // Mock health data
      const healthData = [
        { name: 'Healthy', value: 85 },
        { name: 'Degraded', value: 10 },
        { name: 'Critical', value: 5 }
      ];

      // Fetch game categories for breakdown
      const games = await base44.asServiceRole.entities.Game.filter({}, 'created_date', 50);
      const gamesByCategory = aggregateGameRevenue(games);

      setData({
        payouts: payoutsByDate,
        referrals: referralsByMonth,
        engagement: engagementData,
        health: healthData,
        categories: gamesByCategory
      });

      setCategories([...new Set(games.map(g => g.category || 'Other'))]);
    } catch (e) {
      console.error('Dashboard data fetch error:', e);
    }
    setLoading(false);
  };

  const aggregatePayouts = (payouts, range) => {
    const groups = {};
    payouts.forEach(p => {
      const date = new Date(p.created_date).toLocaleDateString();
      if (!groups[date]) groups[date] = { date, payouts: 0, pending: 0 };
      groups[date].payouts += p.status === 'completed' ? p.net_payout : 0;
      groups[date].pending += p.status === 'pending_approval' ? p.net_payout : 0;
    });
    return Object.values(groups).slice(-10);
  };

  const aggregateReferrals = (referrals, range) => {
    const months = {};
    referrals.forEach(r => {
      const month = new Date(r.created_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!months[month]) months[month] = { month, conversionRate: 0, referralCount: 0 };
      months[month].referralCount++;
      if (r.status === 'converted') months[month].conversionRate++;
    });
    return Object.values(months).map(m => ({
      ...m,
      conversionRate: Math.round((m.conversionRate / m.referralCount) * 100)
    })).slice(-6);
  };

  const generateEngagementData = (range) => {
    const data = [];
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.unshift({
        date: date.toLocaleDateString(),
        activeUsers: Math.floor(Math.random() * 500) + 100,
        sessionDuration: Math.floor(Math.random() * 15) + 5
      });
    }
    return data.slice(-10);
  };

  const aggregateGameRevenue = (games) => {
    const categories = {};
    games.forEach(g => {
      const cat = g.category || 'Other';
      if (!categories[cat]) categories[cat] = { category: cat, revenue: 0 };
      categories[cat].revenue += (g.total_revenue || 0);
    });
    return Object.values(categories);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Developer Analytics</h1>
          <p className="text-slate-400">Platform health, payouts, referrals, and engagement metrics</p>
        </div>

        {/* Filters */}
        <Card className="mb-8 bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Time Range</label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(timeRangeOptions).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Game Category</label>
                <Select value={gameCategory} onValueChange={setGameCategory}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Affiliate Tier</label>
                <Select value={affiliateTier} onValueChange={setAffiliateTier}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts Grid */}
        {!loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <PayoutTrendsChart data={data.payouts} />
            <ReferralSuccessChart data={data.referrals} />
            <EngagementMetricsChart data={data.engagement} />
            <PlatformHealthChart data={data.health} />
            <div className="lg:col-span-2">
              <GameCategoryBreakdownChart data={data.categories} />
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-400 py-12">Loading analytics data...</div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-sm text-slate-400">Total Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-400">
                ${data.payouts.reduce((sum, d) => sum + d.payouts, 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-sm text-slate-400">Avg Referral Conv.</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-400">
                {data.referrals.length > 0 ? Math.round(data.referrals.reduce((sum, d) => sum + d.conversionRate, 0) / data.referrals.length) : 0}%
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-sm text-slate-400">Pending Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-400">
                ${data.payouts.reduce((sum, d) => sum + d.pending, 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-sm text-slate-400">Platform Health</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-400">85%</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}