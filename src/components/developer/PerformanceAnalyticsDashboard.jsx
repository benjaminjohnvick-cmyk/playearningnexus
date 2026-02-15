import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity, Sparkles, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function PerformanceAnalyticsDashboard({ game, developer }) {
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);

  const { data: revenueData = [] } = useQuery({
    queryKey: ['revenue-trends', game?.id],
    queryFn: async () => {
      const transactions = await base44.entities.Transaction.filter({ 
        game_id: game.id 
      }, '-created_date', 90);
      
      const grouped = {};
      transactions.forEach(t => {
        const date = new Date(t.created_date).toISOString().split('T')[0];
        grouped[date] = (grouped[date] || 0) + t.amount;
      });
      
      return Object.entries(grouped).map(([date, revenue]) => ({ date, revenue }));
    },
    enabled: !!game
  });

  const { data: engagementMetrics } = useQuery({
    queryKey: ['engagement-metrics', game?.id],
    queryFn: async () => {
      const engagements = await base44.entities.GameEngagement.filter({ 
        game_id: game.id 
      }, '-created_date', 100);
      
      const avgSession = engagements.reduce((sum, e) => sum + (e.session_duration || 0), 0) / engagements.length || 0;
      const uniqueUsers = new Set(engagements.map(e => e.user_id)).size;
      
      return {
        avgSessionMinutes: Math.floor(avgSession / 60),
        dailyActiveUsers: uniqueUsers,
        totalSessions: engagements.length,
        engagementRate: ((engagements.filter(e => e.session_duration > 300).length / engagements.length) * 100).toFixed(1)
      };
    },
    enabled: !!game
  });

  const { data: acquisitionSources } = useQuery({
    queryKey: ['acquisition-sources', game?.id],
    queryFn: async () => {
      const activities = await base44.entities.UserActivity.filter({
        activity_type: 'game_installed',
        related_entity_id: game.id
      });
      
      const sources = {
        organic: 0,
        referral: 0,
        social: 0,
        featured: 0
      };
      
      activities.forEach(a => {
        const source = a.acquisition_source || 'organic';
        sources[source] = (sources[source] || 0) + 1;
      });
      
      return Object.entries(sources).map(([name, value]) => ({ name, value }));
    },
    enabled: !!game
  });

  const { data: conversionRates } = useQuery({
    queryKey: ['conversion-rates', game?.id],
    queryFn: async () => {
      const installs = game.total_installs || 0;
      const iapPurchases = await base44.entities.InAppPurchase.filter({ game_id: game.id });
      const totalPurchases = iapPurchases.reduce((sum, iap) => sum + (iap.purchases_count || 0), 0);
      
      return {
        iapConversion: ((totalPurchases / installs) * 100).toFixed(2),
        avgRevenuePerUser: (game.total_revenue / installs).toFixed(2)
      };
    },
    enabled: !!game
  });

  const { data: retentionCohorts } = useQuery({
    queryKey: ['retention-cohorts', game?.id],
    queryFn: async () => {
      const engagements = await base44.entities.GameEngagement.filter({ 
        game_id: game.id 
      }, '-created_date', 200);
      
      const userFirstSeen = {};
      engagements.forEach(e => {
        if (!userFirstSeen[e.user_id]) {
          userFirstSeen[e.user_id] = new Date(e.created_date);
        }
      });
      
      const cohorts = {
        day1: 0,
        day7: 0,
        day30: 0
      };
      
      const now = new Date();
      Object.entries(userFirstSeen).forEach(([userId, firstDate]) => {
        const daysSince = (now - firstDate) / (1000 * 60 * 60 * 24);
        const recentEngagement = engagements.filter(e => e.user_id === userId).slice(0, 5);
        
        if (daysSince >= 1 && recentEngagement.length > 0) cohorts.day1++;
        if (daysSince >= 7 && recentEngagement.length > 0) cohorts.day7++;
        if (daysSince >= 30 && recentEngagement.length > 0) cohorts.day30++;
      });
      
      const totalUsers = Object.keys(userFirstSeen).length;
      return [
        { period: 'Day 1', retention: ((cohorts.day1 / totalUsers) * 100).toFixed(1) },
        { period: 'Day 7', retention: ((cohorts.day7 / totalUsers) * 100).toFixed(1) },
        { period: 'Day 30', retention: ((cohorts.day30 / totalUsers) * 100).toFixed(1) }
      ];
    },
    enabled: !!game
  });

  const generateAIInsights = async () => {
    setGeneratingInsights(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this game's performance and provide actionable insights:

Game: ${game.title}
Total Revenue: $${game.total_revenue}
Total Installs: ${game.total_installs}
Avg Session: ${engagementMetrics?.avgSessionMinutes} minutes
Engagement Rate: ${engagementMetrics?.engagementRate}%
IAP Conversion: ${conversionRates?.iapConversion}%
ARPU: $${conversionRates?.avgRevenuePerUser}

Provide specific, actionable recommendations for:
1. Improving revenue (pricing, upsells, timing)
2. Increasing player retention
3. Boosting engagement rates
4. Optimizing acquisition strategy
5. Key areas of concern`,
        response_json_schema: {
          type: "object",
          properties: {
            revenue_recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  impact: { type: "string" },
                  priority: { type: "string" }
                }
              }
            },
            retention_strategies: {
              type: "array",
              items: { type: "string" }
            },
            engagement_tips: {
              type: "array",
              items: { type: "string" }
            },
            concerns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  issue: { type: "string" },
                  solution: { type: "string" }
                }
              }
            },
            overall_health_score: { type: "number" }
          }
        }
      });
      
      setAiInsights(result);
      toast.success('AI insights generated!');
    } catch (error) {
      toast.error('Failed to generate insights');
    }
    setGeneratingInsights(false);
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-6 h-6" />
              Performance Analytics
            </div>
            <Button variant="secondary" onClick={generateAIInsights} disabled={generatingInsights}>
              {generatingInsights ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              AI Insights
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-600" />
              <Badge className="bg-green-100 text-green-800">+12%</Badge>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold">${game?.total_revenue?.toFixed(0) || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-600" />
              <Badge className="bg-blue-100 text-blue-800">DAU</Badge>
            </div>
            <p className="text-sm text-gray-600 mb-1">Active Users</p>
            <p className="text-2xl font-bold">{engagementMetrics?.dailyActiveUsers || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-8 h-8 text-purple-600" />
              <Badge className="bg-purple-100 text-purple-800">{engagementMetrics?.engagementRate}%</Badge>
            </div>
            <p className="text-sm text-gray-600 mb-1">Avg Session</p>
            <p className="text-2xl font-bold">{engagementMetrics?.avgSessionMinutes || 0}m</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-orange-600" />
              <Badge className="bg-orange-100 text-orange-800">{conversionRates?.iapConversion}%</Badge>
            </div>
            <p className="text-sm text-gray-600 mb-1">ARPU</p>
            <p className="text-2xl font-bold">${conversionRates?.avgRevenuePerUser || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      {aiInsights && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI-Powered Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-lg">
              <h4 className="font-bold mb-2">Overall Health Score</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-600 to-emerald-600"
                    style={{ width: `${aiInsights.overall_health_score}%` }}
                  />
                </div>
                <span className="text-2xl font-bold text-green-600">{aiInsights.overall_health_score}/100</span>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Revenue Recommendations</h4>
              <div className="space-y-2">
                {aiInsights.revenue_recommendations.map((rec, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium">{rec.action}</span>
                      <Badge className={rec.priority === 'high' ? 'bg-red-600' : 'bg-yellow-600'}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{rec.impact}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Retention Strategies</h4>
                <ul className="space-y-1">
                  {aiInsights.retention_strategies.map((strategy, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      {strategy}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Engagement Tips</h4>
                <ul className="space-y-1">
                  {aiInsights.engagement_tips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-600">→</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {aiInsights.concerns.length > 0 && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-semibold mb-2 text-red-900">Areas of Concern</h4>
                {aiInsights.concerns.map((concern, idx) => (
                  <div key={idx} className="mb-2">
                    <p className="text-sm font-medium text-red-800">{concern.issue}</p>
                    <p className="text-sm text-red-700">→ {concern.solution}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="retention">Retention Cohorts</TabsTrigger>
          <TabsTrigger value="acquisition">Acquisition Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention">
          <Card>
            <CardHeader>
              <CardTitle>Player Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={retentionCohorts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="retention" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acquisition">
          <Card>
            <CardHeader>
              <CardTitle>Player Acquisition Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={acquisitionSources}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {acquisitionSources?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}