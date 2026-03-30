import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Clock, TrendingUp, Filter } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

export default function AdvancedInsights() {
  const [user, setUser] = useState(null);
  const [demographicFilter, setDemographicFilter] = useState('all');
  const [engagementFilter, setEngagementFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') base44.auth.redirectToLogin();
      setUser(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: responses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['survey-responses-insights', timeRange],
    queryFn: () => base44.entities.PPCSurveyResponse.list('-created_date', 500),
    enabled: !!user
  });

  const { data: surveys = [] } = useQuery({
    queryKey: ['surveys-insights'],
    queryFn: () => base44.entities.PPCSurvey.list(),
    enabled: !!user
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ['user-tiers'],
    queryFn: () => base44.entities.PPCUserTier.list(),
    enabled: !!user
  });

  // Build tier lookup for engagement filter
  const tierMap = useMemo(() => {
    const map = {};
    tiers.forEach(t => { map[t.user_id] = t.tier_level || 1; });
    return map;
  }, [tiers]);

  // Apply filters
  const filteredResponses = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(timeRange));
    return responses.filter(r => {
      if (new Date(r.created_date) < cutoff) return false;
      if (engagementFilter !== 'all') {
        const tier = tierMap[r.user_id] || 1;
        if (engagementFilter === 'high' && tier < 3) return false;
        if (engagementFilter === 'medium' && (tier < 2 || tier >= 3)) return false;
        if (engagementFilter === 'low' && tier >= 2) return false;
      }
      return true;
    });
  }, [responses, timeRange, engagementFilter, tierMap]);

  // 1. Completion trend by day
  const completionTrend = useMemo(() => {
    const days = {};
    const range = parseInt(timeRange);
    for (let i = range - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'MMM dd');
      days[d] = { date: d, completed: 0, total: 0 };
    }
    filteredResponses.forEach(r => {
      const d = format(new Date(r.created_date), 'MMM dd');
      if (days[d]) {
        days[d].total++;
        if (r.status === 'completed' || r.quality_score > 0) days[d].completed++;
      }
    });
    return Object.values(days).map(d => ({
      ...d,
      rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
    }));
  }, [filteredResponses, timeRange]);

  // 2. Avg completion time by day
  const completionTimeTrend = useMemo(() => {
    const days = {};
    filteredResponses.forEach(r => {
      if (!r.completion_time_seconds) return;
      const d = format(new Date(r.created_date), 'MMM dd');
      if (!days[d]) days[d] = { date: d, total: 0, count: 0 };
      days[d].total += r.completion_time_seconds;
      days[d].count++;
    });
    return Object.values(days)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => ({ date: d.date, avg_seconds: Math.round(d.total / d.count), avg_minutes: +(d.total / d.count / 60).toFixed(1) }));
  }, [filteredResponses]);

  // 3. Category sentiment over time
  const categorySentiment = useMemo(() => {
    const categories = {};
    surveys.forEach(s => {
      if (s.category) categories[s.category] = [];
    });
    filteredResponses.forEach(r => {
      const survey = surveys.find(s => s.id === r.survey_id);
      if (!survey?.category) return;
      const score = r.quality_score || 0;
      if (!categories[survey.category]) categories[survey.category] = [];
      categories[survey.category].push({ date: format(new Date(r.created_date), 'MMM dd'), score });
    });
    // Aggregate by category per week
    return Object.entries(categories).slice(0, 6).map(([cat, entries]) => {
      const avg = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length) : 0;
      return { category: cat, avg_score: avg, count: entries.length };
    }).filter(c => c.count > 0);
  }, [filteredResponses, surveys]);

  // Summary stats
  const totalCompleted = filteredResponses.filter(r => r.status === 'completed' || r.quality_score > 0).length;
  const avgCompletionRate = filteredResponses.length > 0 ? Math.round((totalCompleted / filteredResponses.length) * 100) : 0;
  const avgTime = filteredResponses.filter(r => r.completion_time_seconds).reduce((s, r, _, a) => s + r.completion_time_seconds / a.length, 0);

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Advanced Insights</h1>
              <p className="text-sm text-gray-500">Survey analytics, trends & sentiment</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={engagementFilter} onValueChange={setEngagementFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Engagement</SelectItem>
                <SelectItem value="high">High (Tier 3+)</SelectItem>
                <SelectItem value="medium">Medium (Tier 2)</SelectItem>
                <SelectItem value="low">Low (Tier 1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Responses', value: filteredResponses.length, color: 'text-indigo-600' },
            { label: 'Completed', value: totalCompleted, color: 'text-green-600' },
            { label: 'Completion Rate', value: `${avgCompletionRate}%`, color: 'text-blue-600' },
            { label: 'Avg. Time', value: avgTime > 0 ? `${(avgTime / 60).toFixed(1)}m` : 'N/A', color: 'text-purple-600' },
          ].map(kpi => (
            <Card key={kpi.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Completion Trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> Survey Completion Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingResponses ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div> : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={completionTrend}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(completionTrend.length / 6)} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Completion Rate']} />
                  <Area type="monotone" dataKey="rate" stroke="#6366f1" fill="url(#colorRate)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Avg Completion Time + Category Sentiment */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Avg. Completion Time (minutes)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completionTimeTrend.length === 0 ? (
                <p className="text-xs text-gray-400 py-10 text-center">No completion time data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={completionTimeTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(completionTimeTrend.length / 5)} />
                    <YAxis tick={{ fontSize: 10 }} unit="m" />
                    <Tooltip formatter={(v) => [`${v} min`, 'Avg Time']} />
                    <Line type="monotone" dataKey="avg_minutes" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" /> Category Sentiment Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categorySentiment.length === 0 ? (
                <p className="text-xs text-gray-400 py-10 text-center">No category data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categorySentiment} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={(v) => [`${v}/100`, 'Avg Quality Score']} />
                    <Bar dataKey="avg_score" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily volume bar */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Daily Response Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={completionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(completionTrend.length / 6)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="completed" name="Completed" fill="#6366f1" stackId="a" />
                <Bar dataKey="total" name="Total" fill="#e0e7ff" stackId="b" />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}