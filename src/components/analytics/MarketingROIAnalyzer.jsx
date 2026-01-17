import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tantml/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, DollarSign, Target, Zap, AlertCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

export default function MarketingROIAnalyzer({ businessClient, games }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [roiReport, setRoiReport] = useState(null);

  // Fetch marketing campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['marketing-campaigns', businessClient?.id],
    queryFn: async () => {
      return await base44.entities.MarketingCampaign.filter({
        developer_id: businessClient.id
      }, '-created_date');
    },
    enabled: !!businessClient
  });

  // Analyze ROI mutation
  const analyzeROIMutation = useMutation({
    mutationFn: async (gameId) => {
      setAnalyzing(true);

      const game = games.find(g => g.id === gameId);
      const gameCampaigns = campaigns.filter(c => c.game_id === gameId);

      // Calculate metrics
      const totalAdSpend = gameCampaigns.reduce((sum, c) => sum + (c.ad_spend || 0), 0);
      const totalImpressions = gameCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const totalClicks = gameCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      const totalConversions = gameCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);

      // Get game revenue and installs
      const gameRevenue = game.total_revenue || 0;
      const gameInstalls = game.total_installs || 0;

      // Call AI for ROI analysis
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze the marketing ROI for this game and provide detailed insights.

Game: ${game.title}
Total Revenue: $${gameRevenue}
Total Installs: ${gameInstalls}

Marketing Campaigns (${gameCampaigns.length} total):
- Total Ad Spend: $${totalAdSpend}
- Total Impressions: ${totalImpressions}
- Total Clicks: ${totalClicks}
- Total Conversions: ${totalConversions}

Campaign Details:
${gameCampaigns.map(c => `- ${c.campaign_name}: $${c.ad_spend} spend, ${c.impressions} impressions, ${c.clicks} clicks, ${c.conversions} conversions`).join('\n')}

Calculate:
1. Overall ROI (Return on Investment)
2. Cost Per Acquisition (CPA)
3. Click-Through Rate (CTR)
4. Conversion Rate
5. Revenue Per Install

Provide specific, actionable recommendations for optimizing future campaigns.`,
        response_json_schema: {
          type: 'object',
          properties: {
            roi_percentage: { type: 'number' },
            cpa: { type: 'number' },
            ctr_percentage: { type: 'number' },
            conversion_rate: { type: 'number' },
            revenue_per_install: { type: 'number' },
            performance_rating: { type: 'string' },
            top_performing_campaign: { type: 'string' },
            recommendations: {
              type: 'array',
              items: { type: 'string' }
            },
            future_optimizations: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      });

      return {
        ...analysis,
        game_title: game.title,
        total_ad_spend: totalAdSpend,
        total_revenue: gameRevenue,
        campaigns: gameCampaigns
      };
    },
    onSuccess: (data) => {
      setRoiReport(data);
      setAnalyzing(false);
    },
    onError: () => {
      setAnalyzing(false);
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-600" />
            Marketing Campaign ROI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a game..." />
              </SelectTrigger>
              <SelectContent>
                {games.map(game => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => analyzeROIMutation.mutate(selectedGame)}
              disabled={!selectedGame || analyzing}
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              <Zap className="w-4 h-4 mr-2" />
              {analyzing ? 'Analyzing...' : 'Analyze ROI'}
            </Button>
          </div>

          {roiReport && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Key Metrics */}
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">ROI</span>
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {roiReport.roi_percentage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{roiReport.performance_rating}</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Cost Per Acquisition</span>
                      <Target className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      ${roiReport.cpa.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Revenue Per Install</span>
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-600">
                      ${roiReport.revenue_per_install.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Metrics */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600 mb-2">Click-Through Rate</p>
                    <p className="text-xl font-bold">{roiReport.ctr_percentage.toFixed(2)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600 mb-2">Conversion Rate</p>
                    <p className="text-xl font-bold">{roiReport.conversion_rate.toFixed(2)}%</p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Campaign */}
              {roiReport.top_performing_campaign && (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold">Top Performing Campaign</span>
                    </div>
                    <p className="text-sm">{roiReport.top_performing_campaign}</p>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Optimization Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Current Campaign Insights:</h4>
                    <ul className="space-y-2">
                      {roiReport.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-green-600 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Future Optimization Strategies:</h4>
                    <ul className="space-y-2">
                      {roiReport.future_optimizations.map((opt, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-600 mt-1">→</span>
                          <span>{opt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}