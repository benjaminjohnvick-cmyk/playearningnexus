import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Users, DollarSign, MousePointer, ExternalLink } from 'lucide-react';

const SOURCE_COLORS = { social: '#6366f1', email: '#10b981', direct: '#f59e0b', referral_link: '#ef4444' };

export default function AffiliateAnalyticsDashboard() {
  const [user, setUser] = useState(null);
  const [range, setRange] = useState(30);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: snapshots = [] } = useQuery({
    queryKey: ['perfSnapshots', user?.id, range],
    queryFn: () => base44.entities.AffiliatePerformanceSnapshot.filter(
      { affiliate_user_id: user?.id }, '-date', range
    ),
    enabled: !!user?.id
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['myReferrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user?.id }, '-created_date', 200),
    enabled: !!user?.id
  });

  const { data: links = [] } = useQuery({
    queryKey: ['myLinks', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ created_by: user?.email }, '-clicks', 20),
    enabled: !!user?.email
  });

  // Build daily trend data from snapshots or referrals
  const trendData = useMemo(() => {
    if (snapshots.length > 0) {
      return [...snapshots].reverse().map(s => ({
        date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        referrals: s.referrals || 0,
        conversions: s.conversions || 0,
        earnings: s.earnings || 0,
      }));
    }
    // Build from raw referral data as fallback
    const grouped = {};
    referrals.slice(0, range).forEach(r => {
      const d = new Date(r.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[d]) grouped[d] = { date: d, referrals: 0, conversions: 0, earnings: 0 };
      grouped[d].referrals += 1;
      if (r.status === 'converted') { grouped[d].conversions += 1; grouped[d].earnings += r.commission_earned || 0; }
    });
    return Object.values(grouped).slice(-30);
  }, [snapshots, referrals, range]);

  // Source breakdown from snapshots or estimate from referrals
  const sourceData = useMemo(() => {
    const totals = { social: 0, email: 0, direct: 0, referral_link: 0 };
    if (snapshots.length > 0) {
      snapshots.forEach(s => {
        Object.keys(totals).forEach(k => { totals[k] += s.source_breakdown?.[k] || 0; });
      });
    } else {
      referrals.forEach(r => {
        const src = r.referral_source || 'direct';
        if (totals[src] !== undefined) totals[src] += 1; else totals.direct += 1;
      });
    }
    return Object.entries(totals).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [snapshots, referrals]);

  const totalReferrals = referrals.length;
  const totalConversions = referrals.filter(r => r.status === 'converted').length;
  const conversionRate = totalReferrals > 0 ? ((totalConversions / totalReferrals) * 100).toFixed(1) : 0;
  const totalEarnings = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);

  const topLinks = [...links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10);

  if (!user) return <div className="p-6 text-center text-slate-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Referral Performance Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Your complete affiliate analytics overview</p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <Button key={d} size="sm" variant={range === d ? 'default' : 'outline'} onClick={() => setRange(d)}>
                {d}d
              </Button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Referrals', value: totalReferrals, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Conversions', value: totalConversions, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Conversion Rate', value: `${conversionRate}%`, icon: MousePointer, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Total Earnings', value: `$${totalEarnings.toFixed(2)}`, icon: DollarSign, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label}>
                <CardContent className="pt-4">
                  <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-2`}>
                    <Icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                  <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-slate-500">{kpi.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Daily Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />Daily Referral Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet — start sharing your referral links!</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="referrals" stroke="#6366f1" strokeWidth={2} dot={false} name="Referrals" />
                    <Line type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2} dot={false} name="Conversions" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Source Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversions by Source</CardTitle>
            </CardHeader>
            <CardContent>
              {sourceData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm text-center">No source data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {sourceData.map((entry, i) => (
                        <Cell key={i} fill={SOURCE_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="space-y-1 mt-2">
                {sourceData.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: SOURCE_COLORS[s.name] || '#94a3b8' }} />
                      <span className="capitalize text-slate-600">{s.name.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="font-semibold">{s.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performing Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-purple-600" />Top-Performing Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topLinks.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No custom links yet — create referral links to track performance</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-left py-2">Link / Name</th>
                      <th className="text-center py-2">Clicks</th>
                      <th className="text-center py-2">Conversions</th>
                      <th className="text-center py-2">Conv. Rate</th>
                      <th className="text-center py-2">Earnings</th>
                      <th className="text-center py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLinks.map(link => {
                      const convRate = link.clicks > 0 ? ((link.conversions || 0) / link.clicks * 100).toFixed(1) : 0;
                      return (
                        <tr key={link.id} className="border-b hover:bg-slate-50">
                          <td className="py-2">
                            <div className="font-medium">{link.link_name || link.link_code}</div>
                            <div className="text-xs text-slate-400 font-mono">{link.link_code}</div>
                          </td>
                          <td className="text-center py-2 font-semibold text-blue-600">{link.clicks || 0}</td>
                          <td className="text-center py-2 font-semibold text-green-600">{link.conversions || 0}</td>
                          <td className="text-center py-2">
                            <Badge variant="outline" className={parseFloat(convRate) > 5 ? 'border-green-400 text-green-700' : 'border-slate-300'}>
                              {convRate}%
                            </Badge>
                          </td>
                          <td className="text-center py-2 font-semibold">${(link.total_earnings || 0).toFixed(2)}</td>
                          <td className="text-center py-2">
                            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?ref=${link.link_code}`)}>
                              Copy
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}