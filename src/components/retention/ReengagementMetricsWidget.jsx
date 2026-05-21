import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Zap, Gift, Mail, RefreshCw } from 'lucide-react';

export default function ReengagementMetricsWidget() {
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('30d');

  // Fetch campaign metrics
  const { data: metrics = null, isLoading } = useQuery({
    queryKey: ['reengagementMetrics', timeRange],
    queryFn: async () => {
      const campaigns = await base44.entities.RetentionCampaign.filter({
        campaign_type: 'inactivity_reengagement'
      }, '-sent_date', 100);

      if (campaigns.length === 0) return null;

      // Calculate metrics
      const successful = campaigns.filter(c => c.converted === true);
      const successRate = (successful.length / campaigns.length * 100).toFixed(2);
      const totalRecovered = successful.reduce((sum, c) => sum + (c.expected_recovery_value || 0), 0);
      const avgRecoveryValue = successful.length > 0 ? (totalRecovered / successful.length).toFixed(2) : 0;

      // Group by week for chart
      const weeklyData = {};
      campaigns.forEach(c => {
        const date = new Date(c.sent_date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toLocaleDateString();

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { week: weekKey, sent: 0, converted: 0, revenue: 0 };
        }
        weeklyData[weekKey].sent++;
        if (c.converted) {
          weeklyData[weekKey].converted++;
          weeklyData[weekKey].revenue += c.expected_recovery_value || 0;
        }
      });

      const chartData = Object.values(weeklyData).sort((a, b) => 
        new Date(a.week) - new Date(b.week)
      );

      return {
        totalCampaigns: campaigns.length,
        successful: successful.length,
        successRate: parseFloat(successRate),
        totalRecovered: totalRecovered.toFixed(2),
        avgRecoveryValue: parseFloat(avgRecoveryValue),
        discountsUsed: successful.length,
        discountsCreated: campaigns.length,
        chartData,
        recentCampaigns: campaigns.slice(0, 5)
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Trigger re-engagement run
  const runMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('autoInactivityReengagementEngine', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reengagementMetrics']);
    }
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="py-12 text-center text-slate-500">Loading metrics...</CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">No re-engagement campaigns yet</p>
          <Button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            {runMutation.isPending ? 'Running...' : 'Start Campaign'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">{metrics.totalCampaigns}</div>
            <p className="text-sm text-slate-600 mt-1">Total Campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
              <div>
                <div className="text-2xl font-bold text-emerald-600">{metrics.successRate}%</div>
                <p className="text-xs text-slate-600">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">${metrics.totalRecovered}</div>
            <p className="text-sm text-slate-600 mt-1">Revenue Recovered</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-purple-600">${metrics.avgRecoveryValue}</div>
            <p className="text-sm text-slate-600 mt-1">Avg Recovery</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent" fill="#8884d8" name="Sent" />
              <Bar dataKey="converted" fill="#82ca9d" name="Converted" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Discount Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Discount Code Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-slate-900">Codes Created</span>
              </div>
              <Badge className="bg-purple-100 text-purple-700">{metrics.discountsCreated}</Badge>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                style={{ width: `${(metrics.discountsUsed / metrics.discountsCreated * 100) || 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Used: {metrics.discountsUsed} / {metrics.discountsCreated}</span>
              <span className="font-semibold text-emerald-600">
                {((metrics.discountsUsed / metrics.discountsCreated * 100) || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Campaigns</CardTitle>
          <Button
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <RefreshCw className={`w-4 h-4 ${runMutation.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics.recentCampaigns.map((campaign, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{campaign.user_id?.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">{campaign.discount_code}</p>
                </div>
                <div className="text-right">
                  <Badge variant={campaign.converted ? 'default' : 'outline'}>
                    {campaign.converted ? '✓ Converted' : 'Pending'}
                  </Badge>
                  <p className="text-xs text-slate-600 mt-1">
                    {campaign.discount_percent}% off
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}