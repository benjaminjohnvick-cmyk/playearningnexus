import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Target, Activity, Brain } from 'lucide-react';
import AdvancedDeveloperInsights from '../components/analytics/AdvancedDeveloperInsights';
import MarketingROIAnalyzer from '../components/analytics/MarketingROIAnalyzer';
import GameImprovementAnalyzer from '../components/analytics/GameImprovementAnalyzer';
import AIMonetizationAdvisor from '../components/analytics/AIMonetizationAdvisor';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function DeveloperAnalyticsPage() {
  const [user, setUser] = useState(null);
  const [businessClient, setBusinessClient] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const clients = await base44.entities.BusinessClient.filter({ owner_user_id: currentUser.id });
      if (clients.length > 0) {
        setBusinessClient(clients[0]);
      }
    };
    fetchData();
  }, []);

  const { data: games = [] } = useQuery({
    queryKey: ['developerGames', businessClient?.id],
    queryFn: () => base44.entities.Game.filter({ developer_id: businessClient?.id }),
    enabled: !!businessClient
  });

  const { data: abTests = [] } = useQuery({
    queryKey: ['abTests', businessClient?.id],
    queryFn: () => base44.entities.ABTest.filter({ developer_id: businessClient?.id }),
    enabled: !!businessClient
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', businessClient?.id],
    queryFn: () => base44.entities.MarketingCampaign.filter({ developer_id: businessClient?.id }),
    enabled: !!businessClient
  });

  if (!businessClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  const totalRevenue = games.reduce((sum, g) => sum + (g.total_revenue || 0), 0);
  const totalInstalls = games.reduce((sum, g) => sum + (g.total_installs || 0), 0);
  const avgRating = games.reduce((sum, g) => sum + (g.average_rating || 0), 0) / (games.length || 1);

  const COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#10b981'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link to={createPageUrl('BusinessDashboard')}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent mb-8">
          Advanced Analytics
        </h1>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Installs</p>
                  <p className="text-2xl font-bold text-blue-600">{totalInstalls}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Rating</p>
                  <p className="text-2xl font-bold text-yellow-600">{avgRating.toFixed(1)} ⭐</p>
                </div>
                <Target className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Games</p>
                  <p className="text-2xl font-bold text-purple-600">{games.length}</p>
                </div>
                <Activity className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="ai-insights" className="space-y-6">
          <TabsList>
            <TabsTrigger value="ai-insights">
              <Brain className="w-4 h-4 mr-2" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="monetization">
              <DollarSign className="w-4 h-4 mr-2" />
              Monetization AI
            </TabsTrigger>
            <TabsTrigger value="marketing-roi">Marketing ROI</TabsTrigger>
            <TabsTrigger value="game-improvements">Game Improvements</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="abtests">A/B Tests</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-insights">
            <div className="space-y-6">
              {games.map(game => (
                <AdvancedDeveloperInsights key={game.id} game={game} developerId={businessClient.id} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="monetization">
            <div className="space-y-6">
              {games.map(game => (
                <AIMonetizationAdvisor key={game.id} gameId={game.id} gameName={game.title} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="marketing-roi">
            <MarketingROIAnalyzer businessClient={businessClient} games={games} />
          </TabsContent>

          <TabsContent value="game-improvements">
            <GameImprovementAnalyzer businessClient={businessClient} games={games} />
          </TabsContent>

          <TabsContent value="performance">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Game</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={games}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="title" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total_revenue" fill="#dc2626" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Installs by Game</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={games}
                        dataKey="total_installs"
                        nameKey="title"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {games.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="abtests">
            <Card>
              <CardHeader>
                <CardTitle>Active A/B Tests</CardTitle>
              </CardHeader>
              <CardContent>
                {abTests.length === 0 ? (
                  <p className="text-center text-gray-600 py-8">No A/B tests running</p>
                ) : (
                  <div className="space-y-4">
                    {abTests.map((test) => (
                      <div key={test.id} className="border-2 border-gray-200 rounded-lg p-4">
                        <h3 className="font-bold mb-2">{test.test_name}</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Variant A</p>
                            <p className="text-lg font-bold">{(test.conversion_rate_a * 100).toFixed(1)}%</p>
                            <p className="text-sm">{test.users_variant_a} users</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Variant B</p>
                            <p className="text-lg font-bold">{(test.conversion_rate_b * 100).toFixed(1)}%</p>
                            <p className="text-sm">{test.users_variant_b} users</p>
                          </div>
                        </div>
                        {test.winner && (
                          <p className="mt-2 text-sm font-bold text-green-600">Winner: Variant {test.winner.toUpperCase()}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Marketing Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <p className="text-center text-gray-600 py-8">No campaigns created</p>
                ) : (
                  <div className="space-y-4">
                    {campaigns.map((campaign) => (
                      <div key={campaign.id} className="border-2 border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold">{campaign.campaign_name}</h3>
                          <span className={`px-2 py-1 rounded text-xs ${campaign.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {campaign.is_active ? 'Active' : 'Ended'}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Impressions</p>
                            <p className="font-bold">{campaign.impressions || 0}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Clicks</p>
                            <p className="font-bold">{campaign.clicks || 0}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Conversions</p>
                            <p className="font-bold">{campaign.conversions || 0}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Budget</p>
                            <p className="font-bold">${campaign.budget || 0}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}