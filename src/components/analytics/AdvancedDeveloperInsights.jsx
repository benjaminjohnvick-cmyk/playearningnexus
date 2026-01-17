import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, TrendingUp, Target, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export default function AdvancedDeveloperInsights({ game, developerId }) {
  const [insights, setInsights] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: engagements = [] } = useQuery({
    queryKey: ['gameEngagements', game.id],
    queryFn: () => base44.entities.GameEngagement.filter({ game_id: game.id })
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['gameTransactions', game.id],
    queryFn: () => base44.entities.Transaction.filter({ game_id: game.id })
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['gameReviews', game.id],
    queryFn: () => base44.entities.GameReview.filter({ game_id: game.id })
  });

  const generateInsights = async () => {
    setIsAnalyzing(true);
    try {
      // Calculate player segments
      const playtimeByUser = engagements.reduce((acc, e) => {
        acc[e.user_id] = (acc[e.user_id] || 0) + (e.duration_minutes || 0);
        return acc;
      }, {});

      const avgPlaytime = Object.values(playtimeByUser).reduce((sum, t) => sum + t, 0) / (Object.keys(playtimeByUser).length || 1);
      
      const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const avgRevenuePerUser = totalRevenue / (Object.keys(playtimeByUser).length || 1);

      // Sentiment analysis from reviews
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / (reviews.length || 1);
      const positiveReviews = reviews.filter(r => r.rating >= 4).length;
      const negativeReviews = reviews.filter(r => r.rating <= 2).length;

      const prompt = `Analyze this game's performance and provide actionable insights for the developer.

Game: ${game.title}
Category: ${game.category}

Player Engagement:
- Total Players: ${Object.keys(playtimeByUser).length}
- Average Playtime: ${avgPlaytime.toFixed(1)} minutes
- Total Sessions: ${engagements.length}

Revenue Metrics:
- Total Revenue: $${totalRevenue.toFixed(2)}
- Average Revenue Per User: $${avgRevenuePerUser.toFixed(2)}
- Total Transactions: ${transactions.length}

Player Feedback:
- Average Rating: ${avgRating.toFixed(1)}/5
- Positive Reviews: ${positiveReviews} (${((positiveReviews/reviews.length)*100).toFixed(0)}%)
- Negative Reviews: ${negativeReviews} (${((negativeReviews/reviews.length)*100).toFixed(0)}%)
- Total Reviews: ${reviews.length}

Provide comprehensive analysis including:
1. Player segmentation (whales, regular players, churned)
2. LTV prediction
3. Churn risk analysis
4. Growth opportunities
5. Actionable recommendations`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            player_segments: {
              type: 'object',
              properties: {
                whales: { type: 'number' },
                regular_players: { type: 'number' },
                at_risk: { type: 'number' },
                churned: { type: 'number' }
              }
            },
            ltv_prediction: {
              type: 'object',
              properties: {
                average_ltv: { type: 'number' },
                whale_ltv: { type: 'number' },
                confidence: { type: 'string' }
              }
            },
            churn_analysis: {
              type: 'object',
              properties: {
                churn_rate: { type: 'number' },
                main_reasons: { type: 'array', items: { type: 'string' } },
                retention_strategies: { type: 'array', items: { type: 'string' } }
              }
            },
            growth_opportunities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  opportunity: { type: 'string' },
                  impact: { type: 'string' },
                  difficulty: { type: 'string' }
                }
              }
            },
            recommendations: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      });

      setInsights(aiResponse);
      toast.success('Insights generated successfully!');
    } catch (error) {
      console.error('Error generating insights:', error);
      toast.error('Failed to generate insights');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              AI-Powered Analytics - {game.title}
            </CardTitle>
            <Button 
              onClick={generateInsights} 
              disabled={isAnalyzing}
              className="bg-gradient-to-r from-purple-600 to-blue-600"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!insights && !isAnalyzing && (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Click "Generate Insights" to analyze player behavior and revenue streams</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto mb-3 text-purple-600 animate-spin" />
              <p className="text-gray-600">Analyzing player data and market trends...</p>
            </div>
          )}

          {insights && (
            <Tabs defaultValue="segments" className="space-y-6">
              <TabsList>
                <TabsTrigger value="segments">Player Segments</TabsTrigger>
                <TabsTrigger value="ltv">LTV Prediction</TabsTrigger>
                <TabsTrigger value="churn">Churn Analysis</TabsTrigger>
                <TabsTrigger value="growth">Growth</TabsTrigger>
              </TabsList>

              <TabsContent value="segments">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Player Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Whales', value: insights.player_segments.whales },
                              { name: 'Regular', value: insights.player_segments.regular_players },
                              { name: 'At Risk', value: insights.player_segments.at_risk },
                              { name: 'Churned', value: insights.player_segments.churned }
                            ]}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                          >
                            {COLORS.map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <Users className="w-8 h-8 text-red-600 mb-2" />
                        <p className="text-sm text-gray-600">Whales</p>
                        <p className="text-2xl font-bold">{insights.player_segments.whales}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <Users className="w-8 h-8 text-green-600 mb-2" />
                        <p className="text-sm text-gray-600">Regular</p>
                        <p className="text-2xl font-bold">{insights.player_segments.regular_players}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <AlertTriangle className="w-8 h-8 text-yellow-600 mb-2" />
                        <p className="text-sm text-gray-600">At Risk</p>
                        <p className="text-2xl font-bold">{insights.player_segments.at_risk}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <TrendingUp className="w-8 h-8 text-gray-600 mb-2" />
                        <p className="text-sm text-gray-600">Churned</p>
                        <p className="text-2xl font-bold">{insights.player_segments.churned}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ltv">
                <div className="grid md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="pt-6">
                      <DollarSign className="w-8 h-8 text-green-600 mb-2" />
                      <p className="text-sm text-gray-600">Average LTV</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${insights.ltv_prediction.average_ltv.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <DollarSign className="w-8 h-8 text-purple-600 mb-2" />
                      <p className="text-sm text-gray-600">Whale LTV</p>
                      <p className="text-2xl font-bold text-purple-600">
                        ${insights.ltv_prediction.whale_ltv.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <Target className="w-8 h-8 text-blue-600 mb-2" />
                      <p className="text-sm text-gray-600">Confidence</p>
                      <Badge className="mt-2">{insights.ltv_prediction.confidence}</Badge>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="churn">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Churn Rate: {(insights.churn_analysis.churn_rate * 100).toFixed(1)}%</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="font-medium mb-2">Main Churn Reasons:</p>
                        <ul className="space-y-1">
                          {insights.churn_analysis.main_reasons.map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                              <span className="text-sm">{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="font-medium mb-2">Retention Strategies:</p>
                        <ul className="space-y-1">
                          {insights.churn_analysis.retention_strategies.map((strategy, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Target className="w-4 h-4 text-green-600 mt-0.5" />
                              <span className="text-sm">{strategy}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="growth">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Growth Opportunities</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {insights.growth_opportunities.map((opp, idx) => (
                          <div key={idx} className="p-4 border-2 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-bold">{opp.opportunity}</h4>
                              <div className="flex gap-2">
                                <Badge className={opp.impact === 'High' ? 'bg-green-600' : 'bg-yellow-600'}>
                                  {opp.impact} Impact
                                </Badge>
                                <Badge variant="outline">{opp.difficulty} Difficulty</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>AI Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {insights.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5" />
                            <span className="text-sm">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}