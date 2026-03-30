import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, AreaChart, Area, Legend, CartesianGrid
} from 'recharts';
import {
  Loader2, DollarSign, TrendingUp, Users, BarChart2,
  ArrowUpRight, ArrowDownRight, Activity, Globe, Target
} from 'lucide-react';

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

function StatCard({ label, value, sub, icon: IconComp, color, trend }) {
  const Icon = IconComp;
  const up = trend > 0;
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-xl ${color.replace('text-', 'bg-').replace('600', '100')}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}% vs last 30d
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DeveloperRevenueAnalytics() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: surveys = [], isLoading: loadingSurveys } = useQuery({
    queryKey: ['dev-surveys', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }, '-created_date', 200),
    enabled: !!user?.id,
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['dev-transactions', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 500),
    enabled: !!user?.id,
  });

  const { data: responses = [], isLoading: loadingResp } = useQuery({
    queryKey: ['dev-responses', user?.id],
    queryFn: async () => {
      if (!surveys.length) return [];
      const surveyIds = surveys.map(s => s.id);
      const all = await base44.entities.PPCSurveyResponse.list('-created_date', 500);
      return all.filter(r => surveyIds.includes(r.survey_id));
    },
    enabled: !!user?.id && surveys.length > 0,
  });

  const isLoading = loadingSurveys || loadingTx;

  // ── Computed stats ───────────────────────────────────────────
  const now = Date.now();
  const day = 86400000;

  const totalRevenue = surveys.reduce((s, sv) => s + (sv.total_spent || 0), 0);
  const totalResponses = surveys.reduce((s, sv) => s + (sv.responses_count || 0), 0);
  const activeSurveys = surveys.filter(s => s.status === 'active').length;
  const avgRevenuePerSurvey = surveys.length > 0 ? totalRevenue / surveys.length : 0;

  // Revenue last 30d vs prev 30d
  const last30Tx = transactions.filter(t => now - new Date(t.created_date) < 30 * day);
  const prev30Tx = transactions.filter(t => {
    const age = now - new Date(t.created_date);
    return age >= 30 * day && age < 60 * day;
  });
  const rev30 = last30Tx.reduce((s, t) => s + (t.amount || 0), 0);
  const revPrev30 = prev30Tx.reduce((s, t) => s + (t.amount || 0), 0);
  const revTrend = revPrev30 > 0 ? Math.round(((rev30 - revPrev30) / revPrev30) * 100) : 0;

  // Projected daily revenue (avg of last 14d)
  const last14Tx = transactions.filter(t => now - new Date(t.created_date) < 14 * day);
  const projectedDailyRev = last14Tx.reduce((s, t) => s + (t.amount || 0), 0) / 14;
  const projectedMonthlyRev = projectedDailyRev * 30;

  // Revenue per survey (top 10)
  const revenuePerSurvey = surveys
    .map(s => ({
      name: (s.title || 'Untitled').slice(0, 22) + ((s.title || '').length > 22 ? '…' : ''),
      revenue: s.total_spent || 0,
      responses: s.responses_count || 0,
      rpr: s.responses_count > 0 ? ((s.total_spent || 0) / s.responses_count) : 0,
      status: s.status,
      category: s.category || 'General',
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Revenue by category
  const catMap = {};
  surveys.forEach(s => {
    const cat = s.category || 'General';
    if (!catMap[cat]) catMap[cat] = { revenue: 0, count: 0, responses: 0 };
    catMap[cat].revenue += s.total_spent || 0;
    catMap[cat].count += 1;
    catMap[cat].responses += s.responses_count || 0;
  });
  const categoryData = Object.entries(catMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.revenue - a.revenue);

  // Daily revenue trend (last 14 days)
  const dailyRevData = Array.from({ length: 14 }, (_, i) => {
    const dayStart = now - (13 - i) * day;
    const dayEnd = dayStart + day;
    const dayTx = transactions.filter(t => {
      const ts = new Date(t.created_date).getTime();
      return ts >= dayStart && ts < dayEnd;
    });
    const date = new Date(dayStart);
    return {
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      revenue: parseFloat(dayTx.reduce((s, t) => s + (t.amount || 0), 0).toFixed(2)),
      responses: dayTx.length,
    };
  });

  // Demographic breakdown from responses
  const ageMap = {}, genderMap = {};
  responses.forEach(r => {
    if (r.respondent_age_range) ageMap[r.respondent_age_range] = (ageMap[r.respondent_age_range] || 0) + 1;
    if (r.respondent_gender) genderMap[r.respondent_gender] = (genderMap[r.respondent_gender] || 0) + 1;
  });
  const ageData = Object.entries(ageMap).map(([name, value]) => ({ name, value }));
  const genderData = Object.entries(genderMap).map(([name, value]) => ({ name, value }));

  // Completion rate per survey (top 8)
  const completionData = surveys
    .filter(s => s.sample_size > 0)
    .map(s => ({
      name: (s.title || 'Untitled').slice(0, 18) + '…',
      rate: Math.min(100, Math.round(((s.responses_count || 0) / s.sample_size) * 100)),
      quality: s.avg_quality_score || 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-violet-600" /> Developer Revenue Analytics
          </h1>
          <p className="text-gray-500 text-sm">Real-time earnings, projections, and survey performance for {user.full_name || user.email}</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} sub={`${surveys.length} surveys`} icon={DollarSign} color="text-violet-600" trend={revTrend} />
          <StatCard label="Projected Daily" value={`$${projectedDailyRev.toFixed(2)}`} sub={`~$${projectedMonthlyRev.toFixed(0)}/mo`} icon={TrendingUp} color="text-green-600" />
          <StatCard label="Total Responses" value={totalResponses.toLocaleString()} sub={`${activeSurveys} active surveys`} icon={Users} color="text-blue-600" />
          <StatCard label="Avg Rev / Survey" value={`$${avgRevenuePerSurvey.toFixed(2)}`} sub="lifetime average" icon={Target} color="text-amber-600" />
        </div>

        <Tabs defaultValue="revenue">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
            <TabsTrigger value="surveys">Per Survey</TabsTrigger>
            <TabsTrigger value="categories">By Category</TabsTrigger>
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
          </TabsList>

          {/* ── REVENUE TRENDS ── */}
          <TabsContent value="revenue" className="space-y-5 mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-violet-600" /> Daily Revenue — Last 14 Days</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin w-6 h-6 text-violet-400" /></div> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={dailyRevData}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                      <Tooltip formatter={v => [`$${v}`, 'Revenue']} />
                      <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#revGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-5">
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm">Revenue This Month</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Last 30 days</span>
                      <span className="font-bold text-violet-600">${rev30.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Previous 30 days</span>
                      <span className="font-bold text-gray-600">${revPrev30.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-semibold text-gray-700">MoM Change</span>
                      <Badge className={revTrend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {revTrend >= 0 ? '+' : ''}{revTrend}%
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">Projected Monthly</span>
                      <span className="font-bold text-green-600">${projectedMonthlyRev.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm">Survey Completion Rates</CardTitle></CardHeader>
                <CardContent>
                  {completionData.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-4">No data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={completionData} layout="vertical" margin={{ left: 10 }}>
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} />
                        <Tooltip formatter={v => [`${v}%`, 'Completion']} />
                        <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                          {completionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── PER SURVEY ── */}
          <TabsContent value="surveys" className="mt-4 space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" /> Revenue Per Survey (Top 10)</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin w-6 h-6" /></div> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={revenuePerSurvey} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                      <Tooltip formatter={(v, n) => [n === 'revenue' ? `$${v.toFixed(2)}` : v, n === 'revenue' ? 'Revenue' : 'Responses']} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                        {revenuePerSurvey.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Earnings per response table */}
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-sm">Earnings Per Response</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {revenuePerSurvey.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.responses} responses · ${s.revenue.toFixed(2)} total</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">${s.rpr.toFixed(3)}</p>
                        <p className="text-xs text-gray-400">per resp.</p>
                      </div>
                      <Badge className={s.status === 'active' ? 'bg-green-100 text-green-700 text-xs' : 'bg-gray-100 text-gray-500 text-xs'}>
                        {s.status}
                      </Badge>
                    </div>
                  ))}
                  {revenuePerSurvey.length === 0 && <p className="text-center text-gray-400 text-sm py-6">No survey revenue data yet.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BY CATEGORY ── */}
          <TabsContent value="categories" className="mt-4">
            <div className="grid md:grid-cols-2 gap-5">
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-blue-600" /> Revenue by Category</CardTitle></CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">No category data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="revenue"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={v => [`$${v.toFixed(2)}`, 'Revenue']} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categoryData.map((cat, i) => (
                      <div key={cat.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <div className="flex-1">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                            <span className="text-sm font-bold text-gray-900">${cat.revenue.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-gray-400">{cat.count} surveys · {cat.responses} responses</p>
                        </div>
                      </div>
                    ))}
                    {categoryData.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No category data yet</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── DEMOGRAPHICS ── */}
          <TabsContent value="demographics" className="mt-4">
            <div className="grid md:grid-cols-2 gap-5">
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /> Age Distribution</CardTitle></CardHeader>
                <CardContent>
                  {ageData.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">No demographic data recorded yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={ageData}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Respondents" radius={[4, 4, 0, 0]}>
                          {ageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm">Gender Distribution</CardTitle></CardHeader>
                <CardContent>
                  {genderData.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">No demographic data recorded yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={genderData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}>
                          {genderData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card className="border-0 shadow-md mt-4">
              <CardContent className="p-4 text-center text-sm text-gray-400">
                💡 To collect demographic data, enable demographic targeting on your surveys in the PPC Marketplace.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}