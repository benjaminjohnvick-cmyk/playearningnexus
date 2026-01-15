import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Loader2, DollarSign, Target, Zap } from 'lucide-react';

export default function AIPricingStrategy({ game, developerId }) {
  const [insights, setInsights] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['gameTransactions', game.id],
    queryFn: () => base44.entities.Transaction.filter({ game_id: game.id })
  });

  const { data: iapItems = [] } = useQuery({
    queryKey: ['iapItems', game.id],
    queryFn: () => base44.entities.InAppPurchase.filter({ game_id: game.id })
  });

  const { data: dynamicPricing = [] } = useQuery({
    queryKey: ['dynamicPricing', game.id],
    queryFn: () => base44.entities.DynamicPricing.filter({ game_id: game.id })
  });

  const { data: allGames = [] } = useQuery({
    queryKey: ['allMarketGames'],
    queryFn: () => base44.entities.Game.filter({ marketplace_approved: true })
  });

  const generatePricingInsights = async () => {
    setIsGenerating(true);
    try {
      const totalRevenue = transactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const averageTransactionValue = totalRevenue / (transactions.length || 1);
      
      const iapRevenue = transactions
        .filter(t => t.transaction_type === 'in_app_purchase')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const subscriptionRevenue = transactions
        .filter(t => t.transaction_type === 'subscription')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const similarGames = allGames.filter(g => 
        g.category === game.category && g.id !== game.id
      );

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a game monetization expert AI. Analyze this game's pricing and provide strategic recommendations.

Game Details:
- Title: ${game.title}
- Category: ${game.category}
- Current Price: $${game.price}
- Total Revenue: $${totalRevenue.toFixed(2)}
- Total Installs: ${game.total_installs || 0}
- Average Rating: ${game.average_rating || 0}/5
- Revenue per Install: $${(totalRevenue / (game.total_installs || 1)).toFixed(2)}

Monetization Breakdown:
- In-App Purchase Revenue: $${iapRevenue.toFixed(2)} (${((iapRevenue/totalRevenue)*100).toFixed(1)}%)
- Subscription Revenue: $${subscriptionRevenue.toFixed(2)} (${((subscriptionRevenue/totalRevenue)*100).toFixed(1)}%)
- Active IAP Items: ${iapItems.length}
- Average Transaction Value: $${averageTransactionValue.toFixed(2)}

Market Context:
- Similar ${game.category} games: ${similarGames.length}
- Market avg price: $${(similarGames.reduce((s,g) => s + (g.price||0), 0) / (similarGames.length||1)).toFixed(2)}

Provide 3 specific, actionable pricing recommendations with expected revenue impact.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_score: { type: 'number' },
            primary_recommendation: { type: 'string' },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  expected_impact: { type: 'string' },
                  priority: { type: 'string' }
                }
              }
            },
            optimal_price_point: { type: 'number' },
            best_monetization_model: { type: 'string' }
          }
        }
      });

      setInsights(aiResponse);
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Pricing Strategy
          </CardTitle>
          <Button
            onClick={generatePricingInsights}
            disabled={isGenerating}
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!insights && !isGenerating && (
          <div className="text-center py-8 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Get AI-powered pricing recommendations to maximize revenue</p>
          </div>
        )}

        {isGenerating && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 mx-auto mb-3 text-purple-600 animate-spin" />
            <p className="text-gray-600">Analyzing market data and revenue patterns...</p>
          </div>
        )}

        {insights && (
          <div className="space-y-4">
            {/* Overall Score */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pricing Health Score</p>
                <p className="text-2xl font-bold text-purple-600">{insights.overall_score}/100</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">Optimal Price</p>
                <p className="text-2xl font-bold text-green-600">${insights.optimal_price_point}</p>
              </div>
            </div>

            {/* Primary Recommendation */}
            <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-5 h-5 text-amber-600 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Top Recommendation</p>
                  <p className="text-sm text-gray-700">{insights.primary_recommendation}</p>
                </div>
              </div>
            </div>

            {/* Best Model */}
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Best Monetization Model</p>
                <p className="font-semibold text-gray-900">{insights.best_monetization_model}</p>
              </div>
            </div>

            {/* Recommendations List */}
            <div className="space-y-3">
              {insights.recommendations.map((rec, idx) => (
                <Card key={idx} className="border-l-4 border-l-purple-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-gray-900">{rec.title}</h4>
                      <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{rec.description}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-green-600 font-medium">{rec.expected_impact}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}