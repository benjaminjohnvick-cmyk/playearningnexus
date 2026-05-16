import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area } from 'recharts';
import { TrendingUp, AlertTriangle, Users, DollarSign, Target, Activity, RefreshCw, Download } from 'lucide-react';

export default function LTVAnalyticsDashboard() {
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Fetch LTV predictions
  const { data: ltvData = {}, refetch: refetchLTV } = useQuery({
    queryKey: ['ltvPredictions'],
    queryFn: async () => {
      try {
        const result = await base44.functions.invoke('aiLTVPredictionEngine', {});
        return result.data;
      } catch (e) {
        console.error('LTV fetch error:', e);
        return {};
      }
    },
    staleTime: 60 * 60 * 1000
  });

  // Fetch revenue forecast
  const { data: forecastData = {} } = useQuery({
    queryKey: ['revenueForecast'],
    queryFn: async () => {
      try {
        const result = await base44.functions.invoke('aiRevenueForecaster', {});
        return result.data;
      } catch (e) {
        console.error('Forecast fetch error:', e);
        return {};
      }
    },
    staleTime: 60 * 60 * 1000
  });

  // Retention strategies for churn-risk users
  const { data: retentionData = {}, refetch: refetchRetention } = useQuery({
    queryKey: ['retentionStrategies'],
    queryFn: async () => {
      const churnUsers = ltvData.churn_risk_users?.map(u => u.user_id) || [];
      if (churnUsers.length === 0) return {};
      
      try {
        const result = await base44.functions.invoke('aiRetentionOptimizer', {
          user_ids: churnUsers
        });
        return result.data;
      } catch (e) {
        console.error('Retention fetch error:', e);
        return {};
      }
    },
    staleTime: 60 * 60 * 1000
  });

  const runFullAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      await Promise.all([refetchLTV(), refetchRetention()]);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Prepare chart data
  const revenueForecastData = forecastData.forecast?.next_4_weeks?.map((value, idx) => ({
    week: `Week ${idx + 1}`,
    revenue: value
  })) || [];

  const historicalRevenueData = forecastData.historical?.last_12_weeks || [];

  const segmentData = [
    { name: 'High Value', value: ltvData.portfolio?.high_value_count || 0, color: '#10b981' },
    { name: 'Growth Potential', value: ltvData.portfolio?.growth_potential_count || 0, color: '#3b82f6' },
    { name: 'At Risk', value: ltvData.portfolio?.at_risk_count || 0, color: '#f59e0b' },
    { name: 'Churn Likely', value: ltvData.portfolio?.churn_likely_count || 0, color: '#ef4444' }
  ];

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold">LTV & Revenue Analytics</h1>
          </div>
          <Button onClick={runFullAnalysis} disabled={analysisLoading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${analysisLoading ? 'animate-spin' : ''}`} />
            {analysisLoading ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </div>
        <p className="text-muted-foreground">AI-powered lifetime value prediction and revenue forecasting</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Projected LTV</p>
                <p className="text-2xl font-bold">${parseFloat(ltvData.portfolio?.total_projected_ltv || 0).toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg LTV (12m)</p>
                <p className="text-2xl font-bold">${parseFloat(ltvData.portfolio?.avg_ltv || 0).toFixed(0)}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Users Analyzed</p>
                <p className="text-2xl font-bold">{ltvData.total_users_analyzed || 0}</p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">At Risk Users</p>
                <p className="text-2xl font-bold text-red-600">{(ltvData.portfolio?.at_risk_count || 0) + (ltvData.portfolio?.churn_likely_count || 0)}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Forecast (4 Weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={revenueForecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toFixed(0)}`} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 text-sm">
              <p><strong>Projected Monthly:</strong> ${forecastData.forecast?.projected_monthly_revenue || 0}</p>
              <p><strong>Growth Rate:</strong> {forecastData.forecast?.mom_growth_rate || 'N/A'}</p>
              <p><strong>Direction:</strong> <Badge>{forecastData.forecast?.growth_direction || 'stable'}</Badge></p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historical Revenue (12 Weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicalRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toFixed(0)}`} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 text-sm">
              <p><strong>Avg Weekly:</strong> ${forecastData.historical?.avg_weekly_revenue || 0}</p>
              <p><strong>Current Week:</strong> ${forecastData.historical?.current_week_revenue || 0}</p>
              <p><strong>Seasonality:</strong> {forecastData.insights?.seasonality || 'Analyzing...'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Segment Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={segmentData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Segment Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {segmentData.map(segment => (
              <div key={segment.name} className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="font-medium">{segment.name}</span>
                </div>
                <Badge variant="outline">{segment.value} users</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Top High-Value Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ltvData.top_ltv_users?.slice(0, 5).map(user => (
              <div key={user.user_id} className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-sm text-muted-foreground">{user.total_transactions} transactions</p>
                  <p className="text-xs text-gray-500">{user.days_active} days active</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">${user.predicted_ltv_12m.toFixed(0)}</p>
                  <Badge className="mt-1">{user.growth_trajectory}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Churn Risk Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ltvData.churn_risk_users?.slice(0, 5).map(user => (
              <div key={user.user_id} className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-sm text-muted-foreground">{user.total_transactions} purchases</p>
                  <p className="text-xs text-gray-500">{user.days_active} days active</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">${user.predicted_ltv_12m.toFixed(0)}</p>
                  <Badge className="mt-1 bg-red-100 text-red-800">{user.risk_category}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Retention Strategies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Recommended Retention Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {retentionData.user_strategies?.slice(0, 8).map(strategy => (
              <div key={strategy.user_id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{strategy.user_name || 'User'}</p>
                  <Badge 
                    className={
                      strategy.strategy.risk_level === 'critical' ? 'bg-red-100 text-red-800' :
                      strategy.strategy.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {strategy.strategy.risk_level}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <strong>Action:</strong> {strategy.strategy.recommended_incentive}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Channel:</strong> {strategy.strategy.communication_channel} at {strategy.strategy.optimal_contact_time}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Expected Re-engagement:</strong> {strategy.strategy.expected_re_engagement_rate}%
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Strategy Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold mb-2">Focus Areas</h3>
            <p className="text-sm text-muted-foreground">{retentionData.campaign_insights?.campaign_focus}</p>
          </div>
          <div>
            <h3 className="font-bold mb-2">Expected Recovery</h3>
            <p className="text-sm text-muted-foreground">{retentionData.campaign_insights?.expected_recovery_rate}% recovery rate</p>
          </div>
          <div>
            <h3 className="font-bold mb-2">ROI Projection</h3>
            <p className="text-sm text-muted-foreground">{retentionData.campaign_insights?.roi_projection}</p>
          </div>
          <div>
            <h3 className="font-bold mb-2">Timeline</h3>
            <p className="text-sm text-muted-foreground">Results in ~{retentionData.campaign_insights?.timeline_weeks} weeks</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}