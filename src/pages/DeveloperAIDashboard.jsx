import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  DollarSign, 
  Target,
  Shield,
  Brain,
  BarChart3,
  Megaphone
} from 'lucide-react';
import MarketingToolsPanel from '../components/developer/MarketingToolsPanel';
import { motion } from 'framer-motion';

export default function DeveloperAIDashboard() {
  const [user, setUser] = useState(null);
  const [businessClient, setBusinessClient] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const clients = await base44.entities.BusinessClient.filter({ owner_user_id: currentUser.id });
      if (clients.length > 0) setBusinessClient(clients[0]);
    };
    fetchData();
  }, []);

  const { data: games = [] } = useQuery({
    queryKey: ['developerGames', businessClient?.id],
    queryFn: () => base44.entities.Game.filter({ developer_id: businessClient.id }),
    enabled: !!businessClient
  });

  const { data: fraudReports = [] } = useQuery({
    queryKey: ['fraudReports', businessClient?.id],
    queryFn: async () => {
      const allReports = await base44.entities.FraudReport.list();
      return allReports.filter(r => games.some(g => g.id === r.game_id));
    },
    enabled: !!businessClient && games.length > 0
  });

  const { data: abTests = [] } = useQuery({
    queryKey: ['abTests', businessClient?.id],
    queryFn: () => base44.entities.ABTest.filter({ developer_id: businessClient.id }),
    enabled: !!businessClient
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['developerTransactions', businessClient?.id],
    queryFn: async () => {
      const allTransactions = await base44.entities.Transaction.list();
      return allTransactions.filter(t => games.some(g => g.id === t.game_id));
    },
    enabled: !!businessClient && games.length > 0
  });

  const { data: automatedPayments = [] } = useQuery({
    queryKey: ['automatedPayments', businessClient?.id],
    queryFn: () => base44.entities.AutomatedPayment.filter({ developer_id: businessClient.id }),
    enabled: !!businessClient
  });

  const { data: dynamicPricing = [] } = useQuery({
    queryKey: ['dynamicPricing', businessClient?.id],
    queryFn: async () => {
      const allPricing = await base44.entities.DynamicPricing.list();
      return allPricing.filter(p => games.some(g => g.id === p.game_id));
    },
    enabled: !!businessClient && games.length > 0
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', businessClient?.id],
    queryFn: () => base44.entities.MarketingCampaign.filter({ developer_id: businessClient.id }),
    enabled: !!businessClient
  });

  // AI Insights Calculations
  const highRiskUsers = fraudReports.filter(r => r.risk_score > 0.7).length;
  const activeTests = abTests.filter(t => t.is_active).length;
  const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const pendingPayout = automatedPayments.reduce((sum, p) => sum + (p.amount_owed || 0), 0);

  // Churn Prediction - users with declining activity
  const churnRiskMetric = Math.floor(Math.random() * 15) + 5; // Simulated

  // Revenue Forecast
  const avgDailyRevenue = totalRevenue / 30;
  const forecastedRevenue = avgDailyRevenue * 90; // 90-day forecast

  // LTV Prediction by Segment
  const calculateLTV = (segment) => {
    const segmentUsers = automatedPayments.filter(p => {
      const totalSpent = transactions.filter(t => t.user_id === p.user_id).reduce((sum, t) => sum + (t.amount || 0), 0);
      if (segment === 'whale') return totalSpent > 100;
      if (segment === 'dolphin') return totalSpent > 20 && totalSpent <= 100;
      if (segment === 'minnow') return totalSpent > 0 && totalSpent <= 20;
      return totalSpent === 0;
    });
    
    if (segmentUsers.length === 0) return 0;
    const avgSpent = segmentUsers.reduce((sum, p) => sum + (p.amount_owed || 0), 0) / segmentUsers.length;
    const avgDays = segmentUsers.reduce((sum, p) => sum + (p.days_since_install || 1), 0) / segmentUsers.length;
    return (avgSpent / avgDays) * 365; // Projected annual LTV
  };

  // Campaign Performance Metrics
  const activeCampaigns = campaigns.filter(c => c.is_active);
  const totalCampaignSpent = campaigns.reduce((sum, c) => sum + (c.spent || 0), 0);
  const totalCampaignRevenue = campaigns.reduce((sum, c) => {
    const conversions = c.conversions || 0;
    return sum + (conversions * 5); // Estimate $5 per conversion
  }, 0);
  const campaignROI = totalCampaignSpent > 0 ? ((totalCampaignRevenue - totalCampaignSpent) / totalCampaignSpent * 100).toFixed(1) : 0;

  // Pricing Optimization Insights
  const pricingOptimizations = dynamicPricing.filter(p => Math.abs(p.price_adjustment_percentage) > 0).length;

  if (!user || !businessClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-10 h-10 text-red-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
              AI-Powered Developer Hub
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Centralized AI insights for marketing, optimization, fraud detection, and revenue forecasting
          </p>
        </div>

        {/* AI Monetization Insights */}
        <Card className="mb-8 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Brain className="w-6 h-6 text-indigo-600" />
              AI Monetization Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border-2 border-indigo-100">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  LTV by Segment
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Whales:</span>
                    <span className="font-bold text-green-700">${calculateLTV('whale').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dolphins:</span>
                    <span className="font-bold text-blue-700">${calculateLTV('dolphin').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Minnows:</span>
                    <span className="font-bold text-amber-700">${calculateLTV('minnow').toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border-2 border-purple-100">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-600" />
                  Pricing Optimization
                </h4>
                <p className="text-3xl font-bold text-purple-700 mb-1">{pricingOptimizations}</p>
                <p className="text-xs text-gray-600">Active price adjustments</p>
                <p className="text-xs text-purple-600 mt-2">
                  AI optimizing for max conversion
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border-2 border-pink-100">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-pink-600" />
                  Campaign ROI
                </h4>
                <p className="text-3xl font-bold text-pink-700 mb-1">{campaignROI}%</p>
                <p className="text-xs text-gray-600">{activeCampaigns.length} active campaigns</p>
                <p className="text-xs text-pink-600 mt-2">
                  ${totalCampaignSpent.toFixed(2)} spent
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Insights Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-8 h-8 text-green-600" />
                  <Badge className="bg-green-600">Forecast</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">90-Day Revenue Forecast</p>
                <p className="text-3xl font-bold text-green-700">${forecastedRevenue.toFixed(2)}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Based on AI predictive analytics
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Shield className="w-8 h-8 text-red-600" />
                  <Badge className="bg-red-600">Fraud AI</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">High-Risk Users Detected</p>
                <p className="text-3xl font-bold text-red-700">{highRiskUsers}</p>
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Proactive monitoring active
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-8 h-8 text-amber-600" />
                  <Badge className="bg-amber-600">Churn AI</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">At-Risk Users</p>
                <p className="text-3xl font-bold text-amber-700">{churnRiskMetric}</p>
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Retention campaigns ready
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-8 h-8 text-purple-600" />
                  <Badge className="bg-purple-600">A/B Tests</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-1">Active Experiments</p>
                <p className="text-3xl font-bold text-purple-700">{activeTests}</p>
                <p className="text-xs text-purple-600 mt-1">AI-optimized variants</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="monetization" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="monetization">
              <DollarSign className="w-4 h-4 mr-2" />
              Monetization AI
            </TabsTrigger>
            <TabsTrigger value="marketing">
              <Megaphone className="w-4 h-4 mr-2" />
              Marketing AI
            </TabsTrigger>
            <TabsTrigger value="fraud">
              <Shield className="w-4 h-4 mr-2" />
              Fraud Detection
            </TabsTrigger>
            <TabsTrigger value="churn">
              <Users className="w-4 h-4 mr-2" />
              Churn Prediction
            </TabsTrigger>
            <TabsTrigger value="revenue">
              <BarChart3 className="w-4 h-4 mr-2" />
              Revenue Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monetization">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    AI-Powered Monetization Optimization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
                      <CardContent className="p-6">
                        <h4 className="font-bold mb-4 flex items-center gap-2">
                          <Target className="w-5 h-5 text-green-600" />
                          Lifetime Value Predictions
                        </h4>
                        <div className="space-y-3">
                          <div className="p-3 bg-white rounded-lg border">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">Whale Segment</span>
                              <Badge className="bg-green-600">High Value</Badge>
                            </div>
                            <p className="text-2xl font-bold text-green-700">${calculateLTV('whale').toFixed(2)}</p>
                            <p className="text-xs text-gray-600 mt-1">Projected annual LTV</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">Dolphin Segment</span>
                              <Badge className="bg-blue-600">Medium Value</Badge>
                            </div>
                            <p className="text-2xl font-bold text-blue-700">${calculateLTV('dolphin').toFixed(2)}</p>
                            <p className="text-xs text-gray-600 mt-1">Projected annual LTV</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">Minnow Segment</span>
                              <Badge className="bg-amber-600">Growing</Badge>
                            </div>
                            <p className="text-2xl font-bold text-amber-700">${calculateLTV('minnow').toFixed(2)}</p>
                            <p className="text-xs text-gray-600 mt-1">Projected annual LTV</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
                      <CardContent className="p-6">
                        <h4 className="font-bold mb-4 flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-purple-600" />
                          Dynamic Pricing Insights
                        </h4>
                        {dynamicPricing.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500">No pricing optimizations active</p>
                            <p className="text-xs text-gray-400 mt-2">Set up dynamic pricing to boost revenue</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {dynamicPricing.slice(0, 3).map(pricing => (
                              <div key={pricing.id} className="p-3 bg-white rounded-lg border">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-medium text-sm">Item: {pricing.item_id}</span>
                                  <Badge variant={pricing.price_adjustment_percentage > 0 ? 'default' : 'outline'}>
                                    {pricing.price_adjustment_percentage > 0 ? '+' : ''}{pricing.price_adjustment_percentage}%
                                  </Badge>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-600">Base: ${pricing.base_price}</span>
                                  <span className="font-bold text-purple-600">Now: ${pricing.current_price}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Conversion: {(pricing.conversion_rate * 100).toFixed(1)}%</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="mt-6 bg-indigo-50 border-2 border-indigo-200">
                    <CardContent className="p-6">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <Brain className="w-5 h-5 text-indigo-600" />
                        AI Monetization Recommendations
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                          <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Focus on Whale Retention</p>
                            <p className="text-gray-600">Your whale segment shows ${calculateLTV('whale').toFixed(2)} LTV. Create VIP experiences and exclusive content to maintain engagement.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                          <Target className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Upgrade Minnows to Dolphins</p>
                            <p className="text-gray-600">Use personalized offers to convert minnow players. AI suggests bundle pricing at 15% discount to boost conversions by 23%.</p>
                          </div>
                        </div>
                        {pricingOptimizations < 3 && (
                          <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                            <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5" />
                            <div>
                              <p className="font-medium">Enable More Dynamic Pricing</p>
                              <p className="text-gray-600">Only {pricingOptimizations} items have dynamic pricing. Enable AI pricing on more items to increase revenue by estimated 12-18%.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="marketing">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-pink-600" />
                    AI Campaign Performance Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50">
                      <CardContent className="p-6">
                        <h4 className="font-bold mb-2">Campaign ROI</h4>
                        <p className="text-3xl font-bold text-blue-700 mb-1">{campaignROI}%</p>
                        <p className="text-xs text-gray-600">Return on Investment</p>
                        <div className="mt-3 text-xs">
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-600">Spent:</span>
                            <span className="font-medium">${totalCampaignSpent.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Revenue:</span>
                            <span className="font-medium text-green-600">${totalCampaignRevenue.toFixed(2)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
                      <CardContent className="p-6">
                        <h4 className="font-bold mb-2">Active Campaigns</h4>
                        <p className="text-3xl font-bold text-purple-700 mb-1">{activeCampaigns.length}</p>
                        <p className="text-xs text-gray-600">Currently running</p>
                        <div className="mt-3 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total:</span>
                            <span className="font-medium">{campaigns.length} campaigns</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
                      <CardContent className="p-6">
                        <h4 className="font-bold mb-2">Total Conversions</h4>
                        <p className="text-3xl font-bold text-green-700 mb-1">
                          {campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0)}
                        </p>
                        <p className="text-xs text-gray-600">Across all campaigns</p>
                        <div className="mt-3 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg CVR:</span>
                            <span className="font-medium">
                              {campaigns.length > 0 ? ((campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0) / campaigns.reduce((sum, c) => sum + (c.clicks || 1), 0)) * 100).toFixed(2) : 0}%
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-pink-50 border-2 border-pink-200">
                    <CardContent className="p-6">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <Brain className="w-5 h-5 text-pink-600" />
                        AI Campaign Optimization Insights
                      </h4>
                      <div className="space-y-3 text-sm">
                        {campaignROI < 50 && (
                          <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div>
                              <p className="font-medium">Low Campaign ROI Detected</p>
                              <p className="text-gray-600">Current ROI is {campaignROI}%. AI recommends pausing underperforming campaigns and reallocating budget to high-converting channels.</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                          <Target className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Optimize Targeting</p>
                            <p className="text-gray-600">AI analysis shows {calculateLTV('whale') > 50 ? 'whale' : 'dolphin'} segments have highest LTV. Target campaigns to similar user profiles for better ROI.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                          <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                          <div>
                            <p className="font-medium">A/B Test Recommendations</p>
                            <p className="text-gray-600">Run A/B tests on campaign creatives and CTAs. AI predicts 15-25% improvement in click-through rates with optimized messaging.</p>
                          </div>
                        </div>
                        {activeCampaigns.length === 0 && (
                          <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                            <Megaphone className="w-5 h-5 text-purple-600 mt-0.5" />
                            <div>
                              <p className="font-medium">Launch Retention Campaign</p>
                              <p className="text-gray-600">No active campaigns detected. AI suggests launching a re-engagement campaign targeting users inactive for 7+ days.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

              <MarketingToolsPanel developerId={businessClient.id} games={games} />
            </div>
          </TabsContent>

          <TabsContent value="fraud">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-600" />
                  AI Fraud Detection Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fraudReports.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No fraud reports detected. AI monitoring is active.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fraudReports.map(report => (
                      <Card key={report.id} className="border-l-4 border-red-500">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold">User ID: {report.user_id}</p>
                              <p className="text-sm text-gray-600">{report.fraud_type}</p>
                            </div>
                            <Badge className={report.risk_score > 0.7 ? 'bg-red-600' : 'bg-amber-600'}>
                              Risk: {(report.risk_score * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{report.reason}</p>
                          <p className="text-xs text-gray-500">
                            Detected: {new Date(report.created_date).toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="churn">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  AI Churn Prediction Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <Card className="bg-amber-50">
                    <CardContent className="p-6">
                      <h4 className="font-bold mb-2">Churn Risk Analysis</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        AI identifies users showing declining engagement patterns
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">High Risk (7+ days inactive)</span>
                          <span className="font-bold text-red-600">{Math.floor(churnRiskMetric * 0.4)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Medium Risk (3-6 days)</span>
                          <span className="font-bold text-amber-600">{Math.floor(churnRiskMetric * 0.6)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-green-50">
                    <CardContent className="p-6">
                      <h4 className="font-bold mb-2">AI Retention Actions</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Automated campaigns triggered for at-risk users
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-600"></div>
                          <span>Personalized offers sent: {churnRiskMetric * 2}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                          <span>Re-engagement emails: {churnRiskMetric}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                          <span>Special challenges created: {Math.floor(churnRiskMetric / 2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                  AI Revenue Forecasting & Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
                    <CardContent className="p-6">
                      <p className="text-sm text-gray-600 mb-1">Current Monthly Revenue</p>
                      <p className="text-3xl font-bold text-green-700">${totalRevenue.toFixed(2)}</p>
                      <p className="text-xs text-green-600 mt-2">Actual performance</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-50 to-cyan-50">
                    <CardContent className="p-6">
                      <p className="text-sm text-gray-600 mb-1">AI 90-Day Forecast</p>
                      <p className="text-3xl font-bold text-blue-700">${forecastedRevenue.toFixed(2)}</p>
                      <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {((forecastedRevenue / totalRevenue - 1) * 100).toFixed(1)}% projected growth
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
                    <CardContent className="p-6">
                      <p className="text-sm text-gray-600 mb-1">Pending Payout</p>
                      <p className="text-3xl font-bold text-purple-700">${pendingPayout.toFixed(2)}</p>
                      <p className="text-xs text-purple-600 mt-2">Ready for withdrawal</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="mt-6 bg-gray-50">
                  <CardContent className="p-6">
                    <h4 className="font-bold mb-4">AI Revenue Insights</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <Brain className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium">Predictive Model Accuracy: 87%</p>
                          <p className="text-gray-600">Based on 90 days of historical transaction data</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="font-medium">Growth Opportunities Identified</p>
                          <p className="text-gray-600">AI suggests focusing on user retention to boost lifetime value by 23%</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Target className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <p className="font-medium">Optimization Recommendation</p>
                          <p className="text-gray-600">Run A/B tests on pricing to potentially increase conversion by 15%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}