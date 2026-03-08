import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { TrendingUp, Globe } from 'lucide-react';

const SOURCE_COLORS = {
  facebook:   '#1877f2',
  twitter:    '#1da1f2',
  instagram:  '#e1306c',
  youtube:    '#ff0000',
  tiktok:     '#010101',
  linkedin:   '#0077b5',
  email:      '#6b7280',
  direct:     '#8b5cf6',
  other:      '#9ca3af',
};

const SOURCE_LABELS = {
  facebook: '📘 Facebook',
  twitter: '🐦 Twitter/X',
  instagram: '📸 Instagram',
  youtube: '▶️ YouTube',
  tiktok: '🎵 TikTok',
  linkedin: '💼 LinkedIn',
  email: '📧 Email',
  direct: '🔗 Direct',
  other: '🌐 Other',
};

export default function TrafficSourceAnalysis({ links = [], referrals = [] }) {
  const sourceData = useMemo(() => {
    const map = {};
    links.forEach(link => {
      const src = link.referral_source || 'other';
      if (!map[src]) map[src] = { source: src, clicks: 0, conversions: 0, commission: 0 };
      map[src].clicks += link.clicks || 0;
      map[src].conversions += link.conversions || 0;
      map[src].commission += link.total_earned || 0;
    });
    return Object.values(map).sort((a, b) => b.commission - a.commission);
  }, [links]);

  const pieData = sourceData.map(s => ({
    name: SOURCE_LABELS[s.source] || s.source,
    value: s.conversions,
    color: SOURCE_COLORS[s.source] || '#9ca3af',
  })).filter(d => d.value > 0);

  const totalClicks = sourceData.reduce((s, d) => s + d.clicks, 0);
  const totalConversions = sourceData.reduce((s, d) => s + d.conversions, 0);
  const overallCvr = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Total Link Clicks', value: totalClicks, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Conversions', value: totalConversions, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Avg. Conversion Rate', value: `${overallCvr}%`, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Conversions by Source</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No link data yet. Create referral links in the Referral Hub.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" /> Commission by Source</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No data yet.</div>
            ) : (
              <div className="space-y-3">
                {sourceData.map(s => {
                  const pct = sourceData[0].commission > 0 ? (s.commission / sourceData[0].commission) * 100 : 0;
                  return (
                    <div key={s.source}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{SOURCE_LABELS[s.source] || s.source}</span>
                        <span className="text-green-600 font-bold">${s.commission.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs text-gray-400 w-16 text-right">
                          {s.conversions} conv. · {s.clicks > 0 ? ((s.conversions / s.clicks) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}