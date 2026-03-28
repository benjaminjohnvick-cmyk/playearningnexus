import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Users, Clock, CheckCircle2, Star, BarChart2, Loader2, AlertCircle } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6'];

function StatCard({ icon: Icon, label, value, sub, color = 'text-blue-600', bg = 'bg-blue-50' }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-black text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SurveyAdminDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: surveys = [], isLoading: loadingSurveys } = useQuery({
    queryKey: ['admin-surveys'],
    queryFn: () => base44.entities.PPCSurvey.list('-created_date', 100),
    enabled: !!user,
  });

  const { data: responses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['admin-responses'],
    queryFn: () => base44.entities.PPCSurveyResponse.list('-created_date', 500),
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-demo'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user?.role === 'admin',
  });

  const stats = useMemo(() => {
    const completed = responses.filter(r => r.completed);
    const avgTime = completed.length
      ? Math.round(completed.reduce((s, r) => s + (r.time_taken_seconds || 0), 0) / completed.length)
      : 0;
    const avgQuality = completed.length
      ? (completed.reduce((s, r) => s + (r.quality_score || 0), 0) / completed.length).toFixed(1)
      : 0;
    const completionRate = responses.length
      ? Math.round((completed.length / responses.length) * 100)
      : 0;
    return { total: surveys.length, responses: responses.length, completed: completed.length, avgTime, avgQuality, completionRate };
  }, [surveys, responses]);

  // Completion rate per survey
  const surveyCompletionData = useMemo(() => {
    return surveys.slice(0, 10).map(s => {
      const surveyResponses = responses.filter(r => r.survey_id === s.id);
      const surveyCompleted = surveyResponses.filter(r => r.completed).length;
      return {
        name: s.title.length > 20 ? s.title.slice(0, 20) + '…' : s.title,
        responses: surveyResponses.length,
        completionRate: surveyResponses.length ? Math.round((surveyCompleted / surveyResponses.length) * 100) : 0,
        avgTime: surveyResponses.length
          ? Math.round(surveyResponses.reduce((s, r) => s + (r.time_taken_seconds || 0), 0) / surveyResponses.length / 60 * 10) / 10
          : 0,
      };
    });
  }, [surveys, responses]);

  // Quality score distribution
  const qualityDist = useMemo(() => {
    const bins = [
      { label: '90-100', min: 90, max: 100, count: 0 },
      { label: '70-89',  min: 70, max: 89,  count: 0 },
      { label: '50-69',  min: 50, max: 69,  count: 0 },
      { label: '0-49',   min: 0,  max: 49,  count: 0 },
    ];
    responses.forEach(r => {
      if (r.quality_score != null) {
        const bin = bins.find(b => r.quality_score >= b.min && r.quality_score <= b.max);
        if (bin) bin.count++;
      }
    });
    return bins;
  }, [responses]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const map = {};
    surveys.forEach(s => {
      const cat = s.survey_type || 'other';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [surveys]);

  // Daily responses trend (last 7 days)
  const trendData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayStr = d.toISOString().slice(0, 10);
      const count = responses.filter(r => r.created_date?.slice(0, 10) === dayStr).length;
      days.push({ label, count });
    }
    return days;
  }, [responses]);

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  if (loadingSurveys || loadingResponses) return (
    <div className="flex items-center justify-center min-h-screen flex-col gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-gray-500 text-sm">Loading analytics…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <BarChart2 className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Survey Analytics Dashboard</h1>
            <p className="text-sm text-gray-500">Aggregated response data to optimize future survey creation</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard icon={BarChart2} label="Total Surveys" value={stats.total} color="text-indigo-600" bg="bg-indigo-50" />
          <StatCard icon={Users} label="Total Responses" value={stats.responses} color="text-blue-600" bg="bg-blue-50" />
          <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} color="text-green-600" bg="bg-green-50" />
          <StatCard icon={TrendingUp} label="Completion Rate" value={`${stats.completionRate}%`} color="text-emerald-600" bg="bg-emerald-50" />
          <StatCard icon={Clock} label="Avg Time" value={`${Math.floor(stats.avgTime / 60)}m ${stats.avgTime % 60}s`} color="text-orange-600" bg="bg-orange-50" />
          <StatCard icon={Star} label="Avg Quality" value={stats.avgQuality} sub="out of 100" color="text-yellow-600" bg="bg-yellow-50" />
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="mb-6 bg-white shadow-sm border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="completion">Completion Rates</TabsTrigger>
            <TabsTrigger value="quality">Quality Analysis</TabsTrigger>
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm text-gray-700">Daily Response Trend (7 days)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} name="Responses" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm text-gray-700">Survey Types</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" outerRadius={70}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {categoryData.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-700 capitalize">{c.name.replace(/_/g, ' ')}</span>
                        <span className="font-bold ml-auto">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* COMPLETION */}
          <TabsContent value="completion">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-sm text-gray-700">Completion Rate by Survey (top 10)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={surveyCompletionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="completionRate" fill="#10b981" radius={[0, 4, 4, 0]} name="Completion %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="mt-4 space-y-2">
              {surveyCompletionData.map((s, i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-3 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>{s.responses} responses</span>
                        <span>{s.avgTime} min avg</span>
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Completion</span>
                        <span className={`font-bold ${s.completionRate >= 80 ? 'text-green-600' : s.completionRate >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {s.completionRate}%
                        </span>
                      </div>
                      <Progress value={s.completionRate} className="h-2" />
                    </div>
                    <Badge className={s.completionRate >= 80 ? 'bg-green-100 text-green-700' : s.completionRate >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                      {s.completionRate >= 80 ? 'Excellent' : s.completionRate >= 60 ? 'Good' : 'Needs Work'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* QUALITY */}
          <TabsContent value="quality">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm text-gray-700">Quality Score Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={qualityDist}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Responses" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm text-gray-700">Avg Time per Survey (minutes)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={surveyCompletionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `${v} min`} />
                      <Bar dataKey="avgTime" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Avg Time (min)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* DEMOGRAPHICS */}
          <TabsContent value="demographics">
            <Card className="border-0 shadow-md">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Demographic data becomes available once users complete their Respondent Profile.</p>
                <p className="text-sm text-gray-400 mt-1">Encourage users to fill in their profile for richer targeting insights.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}