import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { DollarSign, Star, TrendingUp, Clock, Loader2, Zap, Target } from 'lucide-react';
import { format, subWeeks, startOfWeek, endOfWeek, eachWeekOfInterval, subDays, eachDayOfInterval } from 'date-fns';

// ── Heatmap helpers ──────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HeatmapCell({ value, max }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = intensity === 0
    ? 'bg-gray-100'
    : intensity < 0.33
      ? 'bg-emerald-100'
      : intensity < 0.66
        ? 'bg-emerald-300'
        : 'bg-emerald-500';
  return (
    <div
      className={`w-full aspect-square rounded-sm ${bg} cursor-default`}
      title={`${value} surveys`}
    />
  );
}

function SurveyHeatmap({ responses }) {
  const grid = useMemo(() => {
    // [day][hour] counts
    const counts = Array.from({ length: 7 }, () => Array(24).fill(0));
    responses.forEach(r => {
      const d = new Date(r.created_date);
      counts[d.getDay()][d.getHours()]++;
    });
    return counts;
  }, [responses]);

  const max = useMemo(() => Math.max(...grid.flat()), [grid]);

  // find top 3 hours
  const hourTotals = HOURS.map(h => ({ hour: h, total: grid.reduce((s, day) => s + day[h], 0) }))
    .sort((a, b) => b.total - a.total);
  const topHours = hourTotals.slice(0, 3).filter(h => h.total > 0);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" /> Activity Heatmap
        </CardTitle>
        <p className="text-xs text-gray-500">Best times of day & week to earn maximum rewards</p>
      </CardHeader>
      <CardContent>
        {responses.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Complete surveys to build your heatmap</div>
        ) : (
          <>
            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                {/* Hour axis */}
                <div className="flex mb-1 ml-8">
                  {HOURS.filter((_, i) => i % 3 === 0).map(h => (
                    <div key={h} className="flex-1 text-center text-xs text-gray-400">
                      {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                    </div>
                  ))}
                </div>
                {grid.map((dayRow, dayIdx) => (
                  <div key={dayIdx} className="flex items-center gap-0.5 mb-0.5">
                    <span className="w-7 text-xs text-gray-400 text-right pr-1 flex-shrink-0">{DAYS[dayIdx]}</span>
                    {dayRow.map((val, hour) => (
                      <div key={hour} className="flex-1">
                        <HeatmapCell value={val} max={max} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
              <span>Less</span>
              {['bg-gray-100', 'bg-emerald-100', 'bg-emerald-300', 'bg-emerald-500'].map(c => (
                <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
              ))}
              <span>More</span>
              <span className="ml-auto text-gray-400">{responses.length} total sessions</span>
            </div>

            {/* Best times callout */}
            {topHours.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-gray-600">Your best hours:</span>
                {topHours.map(({ hour, total }) => {
                  const label = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
                  return (
                    <Badge key={hour} className="bg-emerald-100 text-emerald-700 text-xs">
                      {label} ({total} surveys)
                    </Badge>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function UserAnalytics() {
  const { data: user } = useQuery({
    queryKey: ['me-analytics'],
    queryFn: () => base44.auth.me(),
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['analytics-responses', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 500),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['analytics-transactions', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 300),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Weekly earnings — last 10 weeks
  const weeklyData = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: subWeeks(new Date(), 9), end: new Date() });
    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const weekTx = transactions.filter(t => {
        const d = new Date(t.created_date);
        return d >= weekStart && d <= weekEnd;
      });
      const earned = weekTx.reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);
      const surveys = responses.filter(r => {
        const d = new Date(r.created_date);
        return r.completed && d >= weekStart && d <= weekEnd;
      }).length;
      return {
        week: format(weekStart, 'MMM d'),
        earned: parseFloat(earned.toFixed(2)),
        surveys,
      };
    });
  }, [transactions, responses]);

  // Daily quality scores — last 30 days
  const qualityData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayResponses = responses.filter(r => r.created_date?.startsWith(dayStr) && r.quality_score != null);
      const avg = dayResponses.length > 0
        ? dayResponses.reduce((s, r) => s + r.quality_score, 0) / dayResponses.length : null;
      return { date: format(day, 'MMM d'), quality: avg !== null ? parseFloat(avg.toFixed(1)) : null };
    }).filter(d => d.quality !== null);
  }, [responses]);

  // KPI stats
  const completedResponses = responses.filter(r => r.completed);
  const totalEarned = transactions.reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);
  const avgQuality = completedResponses.length > 0
    ? completedResponses.reduce((s, r) => s + (r.quality_score || 70), 0) / completedResponses.length : 0;
  const avgTime = completedResponses.length > 0
    ? completedResponses.reduce((s, r) => s + (r.time_taken_seconds || 0), 0) / completedResponses.length / 60 : 0;
  const thisWeekEarned = weeklyData[weeklyData.length - 1]?.earned || 0;
  const lastWeekEarned = weeklyData[weeklyData.length - 2]?.earned || 0;
  const weekGrowth = lastWeekEarned > 0 ? ((thisWeekEarned - lastWeekEarned) / lastWeekEarned) * 100 : 0;

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-indigo-600" /> My Analytics
          </h1>
          <p className="text-gray-500 mt-1">Personal performance insights based on your survey history</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, sub: `This week: $${thisWeekEarned.toFixed(2)}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Surveys Done', value: completedResponses.length, sub: `${weeklyData[weeklyData.length-1]?.surveys || 0} this week`, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Avg Quality', value: `${avgQuality.toFixed(0)}%`, sub: avgQuality >= 85 ? '⭐ Excellent' : avgQuality >= 70 ? '👍 Good' : '📈 Improving', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Week Growth', value: `${weekGrowth >= 0 ? '+' : ''}${weekGrowth.toFixed(0)}%`, sub: 'vs last week', icon: Zap, color: weekGrowth >= 0 ? 'text-emerald-600' : 'text-red-500', bg: weekGrowth >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${s.bg}`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400">{s.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Weekly Earnings */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" /> Weekly Earnings — Last 10 Weeks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  formatter={(v, name) => [name === 'earned' ? `$${v.toFixed(2)}` : v, name === 'earned' ? 'Earned' : 'Surveys']}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="earned" stroke="#4f46e5" strokeWidth={2.5} fill="url(#earningsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Surveys per week + Quality score side by side */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" /> Surveys Per Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} allowDecimals={false} />
                  <Tooltip formatter={v => [v, 'Surveys']} />
                  <Bar dataKey="surveys" radius={[4, 4, 0, 0]}>
                    {weeklyData.map((_, i) => (
                      <Cell key={i} fill={i === weeklyData.length - 1 ? '#4f46e5' : '#c7d2fe'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Quality Score Trend
              </CardTitle>
              <p className="text-xs text-gray-500">Last 30 days (days with submissions)</p>
            </CardHeader>
            <CardContent>
              {qualityData.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No quality data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={qualityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} />
                    <Tooltip formatter={v => [`${v}`, 'Quality']} />
                    {/* Target line at 85 */}
                    <Line type="monotone" dataKey="quality" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Heatmap */}
        <SurveyHeatmap responses={responses} />

        {/* Avg time per survey */}
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 rounded-xl">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg time per survey</p>
                  <p className="text-2xl font-bold text-purple-600">{avgTime.toFixed(1)} min</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-50 rounded-xl">
                  <Zap className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Flagged responses</p>
                  <p className="text-2xl font-bold text-red-500">{responses.filter(r => r.is_flagged).length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completion rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {responses.length > 0 ? ((completedResponses.length / responses.length) * 100).toFixed(0) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}