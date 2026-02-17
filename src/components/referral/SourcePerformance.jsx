import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Facebook, 
  Twitter, 
  Instagram, 
  Youtube, 
  Mail,
  Link as LinkIcon,
  TrendingUp,
  Target
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const PLATFORM_CONFIG = {
  facebook: { icon: Facebook, color: '#1877f2', name: 'Facebook' },
  twitter: { icon: Twitter, color: '#1da1f2', name: 'Twitter' },
  instagram: { icon: Instagram, color: '#e4405f', name: 'Instagram' },
  youtube: { icon: Youtube, color: '#ff0000', name: 'YouTube' },
  tiktok: { icon: LinkIcon, color: '#000000', name: 'TikTok' },
  linkedin: { icon: LinkIcon, color: '#0077b5', name: 'LinkedIn' },
  email: { icon: Mail, color: '#ea4335', name: 'Email' },
  direct: { icon: LinkIcon, color: '#6b7280', name: 'Direct Link' },
  other: { icon: LinkIcon, color: '#9ca3af', name: 'Other' }
};

export default function SourcePerformance({ user }) {
  const { data: referralLinks = [] } = useQuery({
    queryKey: ['referral-links-source', user.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id })
  });

  // Aggregate performance by source
  const sourcePerformance = {};
  referralLinks.forEach(link => {
    const source = link.referral_source || 'other';
    if (!sourcePerformance[source]) {
      sourcePerformance[source] = {
        source,
        clicks: 0,
        conversions: 0,
        earned: 0,
        links: 0
      };
    }
    sourcePerformance[source].clicks += link.clicks || 0;
    sourcePerformance[source].conversions += link.conversions || 0;
    sourcePerformance[source].earned += link.total_earned || 0;
    sourcePerformance[source].links += 1;
  });

  const sourceData = Object.values(sourcePerformance).map(data => ({
    ...data,
    conversionRate: data.clicks > 0 ? ((data.conversions / data.clicks) * 100).toFixed(1) : 0,
    avgEarningsPerClick: data.clicks > 0 ? (data.earned / data.clicks).toFixed(2) : 0
  })).sort((a, b) => b.clicks - a.clicks);

  const chartData = sourceData.map(d => ({
    name: PLATFORM_CONFIG[d.source]?.name || d.source,
    Clicks: d.clicks,
    Conversions: d.conversions,
    Earnings: d.earned
  }));

  const pieData = sourceData.map(d => ({
    name: PLATFORM_CONFIG[d.source]?.name || d.source,
    value: d.clicks,
    color: PLATFORM_CONFIG[d.source]?.color || '#9ca3af'
  }));

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            Referral Source Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-4">Clicks by Source</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-4">Performance Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Clicks" fill="#3b82f6" />
                  <Bar dataKey="Conversions" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            {sourceData.map((source) => {
              const config = PLATFORM_CONFIG[source.source];
              const Icon = config?.icon || LinkIcon;

              return (
                <div key={source.source} className="border-2 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${config?.color}20` }}>
                        <Icon className="w-5 h-5" style={{ color: config?.color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{config?.name || source.source}</h3>
                        <p className="text-sm text-gray-500">{source.links} active links</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700">
                      ${source.earned.toFixed(2)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{source.clicks}</div>
                      <p className="text-xs text-gray-500">Clicks</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{source.conversions}</div>
                      <p className="text-xs text-gray-500">Conversions</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{source.conversionRate}%</div>
                      <p className="text-xs text-gray-500">Conv. Rate</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">${source.avgEarningsPerClick}</div>
                      <p className="text-xs text-gray-500">Per Click</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}