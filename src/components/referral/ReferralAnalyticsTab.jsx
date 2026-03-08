import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, MousePointer, Globe, Mail, Share2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

const SOURCE_META = {
  facebook:  { label: 'Facebook',  color: '#1877F2', icon: '📘' },
  twitter:   { label: 'Twitter/X', color: '#1DA1F2', icon: '🐦' },
  instagram: { label: 'Instagram', color: '#E1306C', icon: '📸' },
  youtube:   { label: 'YouTube',   color: '#FF0000', icon: '▶️' },
  tiktok:    { label: 'TikTok',    color: '#69C9D0', icon: '🎵' },
  email:     { label: 'Email',     color: '#10B981', icon: '✉️' },
  direct:    { label: 'Direct',    color: '#8B5CF6', icon: '🔗' },
  other:     { label: 'Other',     color: '#94A3B8', icon: '🌐' },
};

const PIE_COLORS = Object.values(SOURCE_META).map(s => s.color);

export default function ReferralAnalyticsTab({ referrals, referralLinks = [] }) {
  // --- Growth over time (last 30 days) ---
  const growthData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const date = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
      const joined = referrals.filter(r => {
        const d = r.created_date ? format(new Date(r.created_date), 'yyyy-MM-dd') : null;
        return d === date;
      }).length;
      const cumulative = referrals.filter(r => {
        const d = r.created_date ? new Date(r.created_date) : null;
        return d && d <= new Date(date + 'T23:59:59');
      }).length;
      return { date: format(subDays(new Date(), 29 - i), 'MMM d'), joined, cumulative };
    });
    return days;
  }, [referrals]);

  // --- Conversion funnel ---
  const totalClicks = referralLinks.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalSignups = referrals.length;
  const activeCount = referrals.filter(r => r.status === 'active').length;
  const conversionRate = totalClicks > 0 ? ((totalSignups / totalClicks) * 100).toFixed(1) : 0;
  const activationRate = totalSignups > 0 ? ((activeCount / totalSignups) * 100).toFixed(1) : 0;

  const funnelData = [
    { stage: 'Clicks', value: totalClicks, color: '#6366F1' },
    { stage: 'Signups', value: totalSignups, color: '#8B5CF6' },
    { stage: 'Active', value: activeCount, color: '#10B981' },
  ];

  // --- Source performance from CustomReferralLinks ---
  const sourceStats = useMemo(() => {
    const map = {};
    referralLinks.forEach(link => {
      const src = link.referral_source || 'direct';
      if (!map[src]) map[src] = { clicks: 0, conversions: 0, earned: 0 };
      map[src].clicks += link.clicks || 0;
      map[src].conversions += link.conversions || 0;
      map[src].earned += link.total_earned || 0;
    });

    return Object.entries(map)
      .map(([source, stats]) => ({
        source,
        meta: SOURCE_META[source] || SOURCE_META.other,
        ...stats,
        convRate: stats.clicks > 0 ? ((stats.conversions / stats.clicks) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.conversions - a.conversions);
  }, [referralLinks]);

  // Pie chart data for sources
  const pieData = sourceStats.length > 0
    ? sourceStats.map(s => ({ name: s.meta.label, value: s.clicks || 1 }))
    : [{ name: 'No data yet', value: 1 }];

  // Weekly referrals bar
  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      const count = referrals.filter(r => {
        const d = r.created_date ? format(new Date(r.created_date), 'yyyy-MM-dd') : null;
        return d === date;
      }).length;
      return { day: format(subDays(new Date(), 6 - i), 'EEE'), count };
    });
  }, [referrals]);

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Clicks',      value: totalClicks,          icon: MousePointer, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Total Signups',     value: totalSignups,          icon: Users,        color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Click→Signup Rate', value: `${conversionRate}%`, icon: TrendingUp,   color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Activation Rate',   value: `${activationRate}%`, icon: Share2,       color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-400">{s.label}</p>
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Growth chart */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" /> Referral Growth — Last 30 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="cumulative" stroke="#6366F1" strokeWidth={2.5} dot={false} name="Total Referrals" />
              <Line type="monotone" dataKey="joined" stroke="#10B981" strokeWidth={2} dot={false} name="New / Day" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Weekly bar + Conversion funnel side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" /> This Week's Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="New Referrals" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-blue-600" /> Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {funnelData.map((step, i) => {
              const pct = i === 0 ? 100 : funnelData[0].value > 0 ? (step.value / funnelData[0].value * 100) : 0;
              return (
                <div key={step.stage}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="font-medium text-gray-800">{step.stage}</span>
                    <span className="font-bold" style={{ color: step.color }}>{step.value.toLocaleString()} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: step.color }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-gray-400 mt-2 text-center">
              Overall click-to-active rate: <strong className="text-green-600">{totalClicks > 0 ? ((activeCount / totalClicks) * 100).toFixed(1) : 0}%</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Traffic sources */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-green-600" /> Top Traffic Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sourceStats.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Share2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No traffic source data yet.</p>
              <p className="text-xs mt-1">Create tracking links in the Link Tracking page to see data here.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                {sourceStats.map((s, i) => (
                  <div key={s.source} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-white transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{s.meta.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.meta.label}</p>
                        <p className="text-xs text-gray-400">{s.clicks} clicks · {s.conversions} signups</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        className={`text-xs ${parseFloat(s.convRate) >= 5 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {s.convRate}% CVR
                      </Badge>
                      {s.earned > 0 && <p className="text-xs text-green-600 font-bold mt-0.5">${s.earned.toFixed(2)}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}