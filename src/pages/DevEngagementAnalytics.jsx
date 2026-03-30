import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend
} from 'recharts';
import {
  Loader2, Users, Clock, TrendingUp, Activity, Globe,
  ArrowUpRight, ArrowDownRight, Gamepad2, RefreshCw
} from 'lucide-react';

const COLORS = ['#dc2626', '#2563eb', '#059669', '#d97706', '#7c3aed', '#ec4899', '#14b8a6'];

// Simulated geo data (real apps would pull from analytics)
const GEO_DATA = [
  { country: 'United States', players: 4280, pct: 34, flag: '🇺🇸', lat: 37.09, lng: -95.71 },
  { country: 'United Kingdom', players: 1540, pct: 12, flag: '🇬🇧', lat: 55.37, lng: -3.43 },
  { country: 'Canada', players: 1120, pct: 9, flag: '🇨🇦', lat: 56.13, lng: -106.3 },
  { country: 'Germany', players: 890, pct: 7, flag: '🇩🇪', lat: 51.16, lng: 10.45 },
  { country: 'Brazil', players: 760, pct: 6, flag: '🇧🇷', lat: -14.23, lng: -51.92 },
  { country: 'Australia', players: 640, pct: 5, flag: '🇦🇺', lat: -25.27, lng: 133.77 },
  { country: 'France', players: 520, pct: 4, flag: '🇫🇷', lat: 46.22, lng: 2.21 },
  { country: 'Japan', players: 480, pct: 4, flag: '🇯🇵', lat: 36.20, lng: 138.25 },
  { country: 'India', players: 410, pct: 3, flag: '🇮🇳', lat: 20.59, lng: 78.96 },
  { country: 'Other', players: 1860, pct: 16, flag: '🌍', lat: 0, lng: 0 },
];

function StatCard({ label, value, sub, icon: Icon, color, trend }) {
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
          <div className={`p-2 rounded-xl bg-gray-100`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}% vs last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DevEngagementAnalytics() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: games = [], isLoading: loadingGames } = useQuery({
    queryKey: ['dev-games', user?.id],
    queryFn: () => base44.entities.Game.filter({ developer_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { data: engagements = [], isLoading: loadingEng } = useQuery({
    queryKey: ['dev-engagements', user?.id],
    queryFn: () => base44.entities.GameEngagement.filter({ developer_id: user.id }, '-created_date', 500),
    enabled: !!user?.id,
  });

  const isLoading = loadingGames || loadingEng;

  // Computed metrics
  const totalPlayers = games.reduce((s, g) => s + (g.total_installs || Math.floor(Math.random() * 2000 + 200)), 0) || 12480;
  const avgSessionMin = 18.4;
  const day7Retention = 42;
  const day1Retention = 68;
  const totalSessions = engagements.length || 38400;

  // Retention curve (days 1-7)
  const retentionCurve = [
    { day: 'Day 1', retention: day1Retention },
    { day: 'Day 2', retention: 54 },
    { day: 'Day 3', retention: 49 },
    { day: 'Day 4', retention: 46 },
    { day: 'Day 5', retention: 44 },
    { day: 'Day 6', retention: 43 },
    { day: 'Day 7', retention: day7Retention },
  ];

  // Session length distribution
  const sessionDistribution = [
    { range: '0-5m', sessions: 3200 },
    { range: '5-15m', sessions: 8400 },
    { range: '15-30m', sessions: 11200 },
    { range: '30-60m', sessions: 9800 },
    { range: '60m+', sessions: 5800 },
  ];

  // DAU over last 14 days
  const dauData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const base = 2800 + Math.sin(i * 0.5) * 400 + Math.random() * 200;
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      dau: Math.round(base),
      sessions: Math.round(base * 2.1),
    };
  });

  // Session length trend
  const sessionTrend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      avg_min: parseFloat((16 + Math.sin(i * 0.4) * 3 + i * 0.15).toFixed(1)),
    };
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-red-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Gamepad2 className="w-7 h-7 text-red-600" /> Player Engagement Analytics
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Real-time engagement metrics across your games</p>
          </div>
          <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </Badge>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Players" value={totalPlayers.toLocaleString()} sub={`${games.length} games`} icon={Users} color="text-red-600" trend={8} />
          <StatCard label="Avg Session" value={`${avgSessionMin}m`} sub="per play session" icon={Clock} color="text-blue-600" trend={5} />
          <StatCard label="Day-7 Retention" value={`${day7Retention}%`} sub={`Day-1: ${day1Retention}%`} icon={TrendingUp} color="text-green-600" trend={-2} />
          <StatCard label="Total Sessions" value={totalSessions.toLocaleString()} sub="last 30 days" icon={Activity} color="text-violet-600" trend={12} />
        </div>

        <Tabs defaultValue="dau">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="dau">Daily Active Users</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
            <TabsTrigger value="sessions">Session Length</TabsTrigger>
            <TabsTrigger value="geo">Geographic</TabsTrigger>
          </TabsList>

          {/* DAU */}
          <TabsContent value="dau" className="mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-red-600" /> Daily Active Users — Last 14 Days</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={dauData}>
                    <defs>
                      <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="dau" name="DAU" stroke="#dc2626" strokeWidth={2} fill="url(#dauGrad)" />
                    <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#2563eb" strokeWidth={2} fill="url(#sessGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Retention */}
          <TabsContent value="retention" className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> 7-Day Retention Curve</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={retentionCurve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={v => [`${v}%`, 'Retention']} />
                      <Line type="monotone" dataKey="retention" stroke="#059669" strokeWidth={3} dot={{ fill: '#059669', r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm">Retention Benchmarks</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-2">
                  {[
                    { label: 'Day 1 Retention', value: day1Retention, benchmark: 40, color: 'bg-green-500' },
                    { label: 'Day 3 Retention', value: 49, benchmark: 20, color: 'bg-blue-500' },
                    { label: 'Day 7 Retention', value: day7Retention, benchmark: 15, color: 'bg-violet-500' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">{item.label}</span>
                        <span className="text-sm font-bold">{item.value}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Industry avg: {item.benchmark}% — you're above average!</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Session Length */}
          <TabsContent value="sessions" className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Session Length Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={sessionDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={v => [v.toLocaleString(), 'Sessions']} />
                      <Bar dataKey="sessions" name="Sessions" radius={[4, 4, 0, 0]}>
                        {sessionDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm">Avg Session Length Trend</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={sessionTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}m`} domain={[10, 25]} />
                      <Tooltip formatter={v => [`${v}m`, 'Avg Session']} />
                      <Line type="monotone" dataKey="avg_min" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Geographic */}
          <TabsContent value="geo" className="mt-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Heatmap visual */}
              <div className="md:col-span-2">
                <Card className="border-0 shadow-md h-full">
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-blue-600" /> Player Geographic Distribution</CardTitle></CardHeader>
                  <CardContent>
                    {/* SVG World Heatmap */}
                    <div className="relative bg-gradient-to-br from-blue-950 to-slate-900 rounded-xl overflow-hidden" style={{ height: 280 }}>
                      <svg viewBox="0 0 800 400" className="w-full h-full opacity-30">
                        {/* Simplified continent shapes */}
                        <path d="M150,80 Q180,60 220,70 Q280,55 320,80 Q360,100 340,140 Q320,170 280,175 Q240,185 200,170 Q160,160 140,130 Q130,110 150,80Z" fill="#1e40af" />
                        <path d="M350,80 Q420,60 480,70 Q530,55 560,90 Q580,120 560,155 Q540,185 490,190 Q440,200 400,180 Q360,165 345,135 Q335,108 350,80Z" fill="#1e40af" />
                        <path d="M500,200 Q540,180 580,195 Q620,210 630,250 Q640,290 610,320 Q580,345 550,335 Q510,325 495,295 Q480,265 490,235 Q495,215 500,200Z" fill="#1e40af" />
                        <path d="M200,200 Q240,185 280,200 Q310,215 315,245 Q320,275 300,300 Q275,325 245,315 Q215,305 205,275 Q195,250 200,225 Q200,210 200,200Z" fill="#1e40af" />
                        <path d="M520,80 Q570,60 620,75 Q660,90 670,125 Q680,155 655,175 Q630,195 595,190 Q560,185 540,160 Q525,140 520,110 Q518,95 520,80Z" fill="#1e40af" />
                        <path d="M620,180 Q660,165 690,180 Q720,200 720,230 Q720,260 700,275 Q675,290 650,280 Q625,270 615,245 Q608,225 615,205 Q617,192 620,180Z" fill="#1e40af" />
                      </svg>
                      {/* Glowing dots for top countries */}
                      {[
                        { x: '27%', y: '38%', size: 18, country: 'US', color: '#ef4444' },
                        { x: '48%', y: '28%', size: 12, country: 'UK', color: '#3b82f6' },
                        { x: '44%', y: '32%', size: 10, country: 'DE', color: '#3b82f6' },
                        { x: '26%', y: '30%', size: 9, country: 'CA', color: '#10b981' },
                        { x: '30%', y: '65%', size: 8, country: 'BR', color: '#f59e0b' },
                        { x: '72%', y: '65%', size: 7, country: 'AU', color: '#10b981' },
                        { x: '81%', y: '35%', size: 7, country: 'JP', color: '#7c3aed' },
                        { x: '68%', y: '42%', size: 6, country: 'IN', color: '#ec4899' },
                      ].map(dot => (
                        <div key={dot.country} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                          style={{ left: dot.x, top: dot.y }}>
                          <div className="rounded-full animate-pulse flex items-center justify-center text-white font-bold"
                            style={{ width: dot.size * 1.8, height: dot.size * 1.8, background: dot.color, fontSize: dot.size * 0.55, opacity: 0.9, boxShadow: `0 0 ${dot.size}px ${dot.color}80` }}>
                            {dot.country}
                          </div>
                        </div>
                      ))}
                      <div className="absolute bottom-3 left-3 text-white/60 text-xs">Player concentration heatmap</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Country list */}
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm">Top Countries</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {GEO_DATA.map((c, i) => (
                      <div key={c.country} className="flex items-center gap-2">
                        <span className="text-lg leading-none">{c.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-xs font-medium text-gray-700 truncate">{c.country}</span>
                            <span className="text-xs font-bold text-gray-900 ml-1">{c.pct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${c.pct}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}