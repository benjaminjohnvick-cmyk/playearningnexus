import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Loader2, Zap, TrendingDown, AlertTriangle, Users, MousePointer, RefreshCw, Brain } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line, CartesianGrid } from 'recharts';

const FEATURE_AREAS = ['surveys', 'ppc_marketplace', 'referrals', 'withdrawal', 'game_store', 'dashboard', 'leaderboard', 'achievements', 'wishlist', 'social', 'creator_hub', 'settings', 'dispute_center', 'onboarding'];

const FRICTION_COLOR = (score) => {
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f97316';
  if (score >= 20) return '#eab308';
  return '#22c55e';
};

const EVENT_COLORS = {
  page_view: '#6366f1',
  feature_click: '#22c55e',
  feature_ignored: '#f97316',
  form_abandon: '#ef4444',
  survey_abandon: '#dc2626',
  error_encountered: '#7c3aed',
  survey_complete: '#10b981',
};

export default function UXHeatmapDashboard() {
  const [user, setUser] = React.useState(null);
  const [timeRange, setTimeRange] = useState('7');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['ux-events', timeRange],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString();
      const all = await base44.entities.UserJourneyEvent.list('-created_date', 3000);
      return all.filter(e => e.created_date >= cutoff);
    },
    enabled: !!user,
  });

  const { data: memories = [] } = useQuery({
    queryKey: ['ux-memories'],
    queryFn: () => base44.entities.AgentLearningMemory.filter({ memory_type: 'ux_insight' }, '-created_date', 20),
    enabled: !!user,
  });

  const runAnalysisMutation = useMutation({
    mutationFn: () => base44.functions.invoke('uxAnalysisEngine', {}),
  });

  const runChurnMutation = useMutation({
    mutationFn: () => base44.functions.invoke('churnPredictionEngine', {}),
  });

  // --- Aggregate stats by feature area ---
  const featureStats = useMemo(() => {
    return FEATURE_AREAS.map(area => {
      const areaEvents = events.filter(e => e.feature_area === area);
      const clicks = areaEvents.filter(e => e.event_type === 'feature_click').length;
      const ignores = areaEvents.filter(e => e.event_type === 'feature_ignored').length;
      const abandons = areaEvents.filter(e => ['form_abandon', 'survey_abandon'].includes(e.event_type)).length;
      const pageViews = areaEvents.filter(e => e.event_type === 'page_view').length;
      const errors = areaEvents.filter(e => e.event_type === 'error_encountered').length;
      const completions = areaEvents.filter(e => e.event_type === 'survey_complete').length;
      const uniqueUsers = new Set(areaEvents.map(e => e.user_id)).size;
      const frictionScore = Math.min(100, Math.round((ignores * 2 + abandons * 3 + errors * 4) / Math.max(1, pageViews + clicks) * 100));
      const adoptionRate = (clicks + pageViews) > 0 ? Math.round(clicks / (clicks + ignores + 0.01) * 100) : 0;
      const avgTimeOnPage = areaEvents.filter(e => e.time_on_page_seconds > 0).reduce((s, e, _, a) => s + e.time_on_page_seconds / a.length, 0);
      return { area, clicks, ignores, abandons, pageViews, errors, completions, uniqueUsers, frictionScore, adoptionRate, avgTimeOnPage: Math.round(avgTimeOnPage) };
    }).filter(s => s.pageViews + s.clicks > 0)
      .sort((a, b) => b.frictionScore - a.frictionScore);
  }, [events]);

  // --- Event type distribution ---
  const eventTypeDist = useMemo(() => {
    const counts = {};
    events.forEach(e => { counts[e.event_type] = (counts[e.event_type] || 0) + 1; });
    return Object.entries(counts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [events]);

  // --- Daily trend ---
  const dailyTrend = useMemo(() => {
    const days = {};
    events.forEach(e => {
      const day = e.created_date?.split('T')[0];
      if (!day) return;
      if (!days[day]) days[day] = { date: day, total: 0, friction: 0, completions: 0 };
      days[day].total++;
      if (e.is_friction_point || ['form_abandon', 'survey_abandon', 'error_encountered'].includes(e.event_type)) days[day].friction++;
      if (e.event_type === 'survey_complete') days[day].completions++;
    });
    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  }, [events]);

  const totalFrictionEvents = events.filter(e => e.is_friction_point || ['form_abandon', 'survey_abandon', 'error_encountered'].includes(e.event_type)).length;
  const totalUniqueUsers = new Set(events.map(e => e.user_id)).size;

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (user.role !== 'admin') return <div className="p-8 text-center text-red-500">Admin access required</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <MousePointer className="w-8 h-8 text-indigo-600" /> UX Heatmap & Friction Report
            </h1>
            <p className="text-gray-500 mt-1">Real-time user interaction analysis and friction detection</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24h</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => runAnalysisMutation.mutate()} disabled={runAnalysisMutation.isPending}>
              {runAnalysisMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Brain className="w-4 h-4 mr-1" />}
              Run UX Analysis
            </Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => runChurnMutation.mutate()} disabled={runChurnMutation.isPending}>
              {runChurnMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
              Run Churn Detection
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: events.length.toLocaleString(), icon: MousePointer, color: 'text-indigo-600' },
            { label: 'Unique Users', value: totalUniqueUsers, icon: Users, color: 'text-blue-600' },
            { label: 'Friction Events', value: totalFrictionEvents, icon: AlertTriangle, color: 'text-red-500' },
            { label: 'Friction Rate', value: `${events.length > 0 ? Math.round(totalFrictionEvents / events.length * 100) : 0}%`, icon: TrendingDown, color: 'text-orange-500' },
          ].map(k => (
            <Card key={k.label} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                  <p className="text-xs text-gray-500">{k.label}</p>
                </div>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="heatmap">
          <TabsList>
            <TabsTrigger value="heatmap">Feature Heatmap</TabsTrigger>
            <TabsTrigger value="trends">Daily Trends</TabsTrigger>
            <TabsTrigger value="events">Event Breakdown</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          {/* HEATMAP TAB */}
          <TabsContent value="heatmap" className="space-y-4 mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm font-semibold">Feature Area Friction Heatmap</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
                  <div className="space-y-3">
                    {featureStats.map(stat => (
                      <div key={stat.area} className="flex items-center gap-3">
                        <div className="w-28 text-xs font-medium text-gray-600 capitalize">{stat.area.replace('_', ' ')}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${stat.frictionScore}%`, backgroundColor: FRICTION_COLOR(stat.frictionScore) }}
                              />
                            </div>
                            <span className="text-xs font-bold w-8 text-right" style={{ color: FRICTION_COLOR(stat.frictionScore) }}>
                              {stat.frictionScore}
                            </span>
                          </div>
                          <div className="flex gap-3 text-xs text-gray-400">
                            <span>👁 {stat.pageViews} views</span>
                            <span>✅ {stat.clicks} clicks</span>
                            <span>🚫 {stat.ignores} ignores</span>
                            <span>❌ {stat.abandons} abandons</span>
                            <span>⚠️ {stat.errors} errors</span>
                            <span>👥 {stat.uniqueUsers} users</span>
                          </div>
                        </div>
                        <Badge className={`text-xs flex-shrink-0 ${stat.frictionScore >= 70 ? 'bg-red-100 text-red-700' : stat.frictionScore >= 40 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {stat.frictionScore >= 70 ? 'HIGH FRICTION' : stat.frictionScore >= 40 ? 'MODERATE' : 'HEALTHY'}
                        </Badge>
                      </div>
                    ))}
                    {featureStats.length === 0 && (
                      <p className="text-center text-gray-400 py-8 text-sm">No event data yet. Events will appear as users interact with the app.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bar chart */}
            {featureStats.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold">Adoption Rate by Feature</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={featureStats}>
                      <XAxis dataKey="area" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="adoptionRate" name="Adoption %" radius={[4, 4, 0, 0]}>
                        {featureStats.map((s, i) => <Cell key={i} fill={FRICTION_COLOR(100 - s.adoptionRate)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TRENDS TAB */}
          <TabsContent value="trends" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm font-semibold">Daily Event Volume & Friction</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#6366f1" name="Total Events" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="friction" stroke="#ef4444" name="Friction Events" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="completions" stroke="#22c55e" name="Survey Completions" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EVENTS TAB */}
          <TabsContent value="events" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm font-semibold">Event Type Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={eventTypeDist} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={90} label={({ type }) => type}>
                        {eventTypeDist.map((e, i) => <Cell key={i} fill={EVENT_COLORS[e.type] || '#94a3b8'} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {eventTypeDist.map(e => (
                      <div key={e.type} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: EVENT_COLORS[e.type] || '#94a3b8' }} />
                        <span className="text-xs text-gray-600 flex-1">{e.type.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-bold text-gray-800">{e.count}</span>
                        <div className="w-20">
                          <Progress value={events.length > 0 ? Math.round(e.count / events.length * 100) : 0} className="h-1.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI INSIGHTS TAB */}
          <TabsContent value="insights" className="mt-4 space-y-4">
            {runAnalysisMutation.data && (
              <Card className="border-0 shadow-sm bg-indigo-50 border-indigo-200">
                <CardContent className="pt-4">
                  <p className="text-sm font-semibold text-indigo-700 mb-2">Last Analysis Run</p>
                  <p className="text-xs text-indigo-600">
                    Analyzed {runAnalysisMutation.data?.data?.events_analyzed} events · Created {runAnalysisMutation.data?.data?.surveys_created?.length} micro-surveys · Generated {runAnalysisMutation.data?.data?.memories_created?.length} learning memories
                  </p>
                </CardContent>
              </Card>
            )}
            {memories.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center text-gray-400 text-sm">
                  No AI insights yet. Run a UX Analysis to generate insights from event data.
                </CardContent>
              </Card>
            ) : memories.map(m => (
              <Card key={m.id} className="border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <Badge className={m.admin_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                      {m.admin_approved ? 'Approved' : 'Pending Review'}
                    </Badge>
                    <span className="text-xs text-gray-400">{m.feature_area}</span>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{m.content}</p>
                  {m.recommended_action && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                      💡 <strong>Recommended:</strong> {m.recommended_action}
                    </div>
                  )}
                  {!m.admin_approved && (
                    <Button size="sm" className="mt-3 h-7 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => base44.entities.AgentLearningMemory.update(m.id, { admin_approved: true })}>
                      Approve & Inject
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {runChurnMutation.data && (
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="pt-4 text-sm text-red-700">
              Churn Run: Flagged <strong>{runChurnMutation.data?.data?.flagged}</strong> at-risk users · Triggered <strong>{runChurnMutation.data?.data?.campaigns_triggered}</strong> retention campaigns
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}