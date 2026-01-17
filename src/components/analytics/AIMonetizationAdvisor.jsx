import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, DollarSign, TrendingUp, ShoppingCart, Users, Loader2, Target, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AIMonetizationAdvisor({ gameId, gameName }) {
  const [analysis, setAnalysis] = useState(null);

  const analyzeMonetizationMutation = useMutation({
    mutationFn: async () => {
      // Gather comprehensive data
      const [transactions, products, engagements, purchases, pricing] = await Promise.all([
        base44.entities.Transaction.filter({ game_id: gameId }),
        base44.entities.Product.filter({ game_id: gameId }),
        base44.entities.GameEngagement.filter({ game_id: gameId }, '-updated_date', 200),
        base44.entities.InAppPurchase.filter({ game_id: gameId }),
        base44.entities.DynamicPricing.filter({ game_id: gameId })
      ]);

      const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const avgTransactionValue = totalRevenue / transactions.length || 0;
      const conversionRate = (purchases.length / engagements.length) * 100 || 0;
      const topProducts = products.sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0)).slice(0, 5);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze game monetization and provide strategic recommendations.

Game: ${gameName}
Total Revenue: $${totalRevenue.toFixed(2)}
Transactions: ${transactions.length}
Avg Transaction: $${avgTransactionValue.toFixed(2)}
Conversion Rate: ${conversionRate.toFixed(2)}%
Active Products: ${products.length}
Player Engagements: ${engagements.length}

Top Products:
${topProducts.map(p => `- ${p.name}: ${p.total_sales || 0} sales at $${p.price_credits || 0}`).join('\n')}

Provide comprehensive monetization strategy including:
1. Dynamic pricing recommendations
2. Product bundle suggestions
3. Personalized offer strategies
4. Revenue optimization tactics
5. Market positioning advice

Be specific and actionable with dollar amounts and percentages.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_health: {
              type: 'object',
              properties: {
                score: { type: 'number' },
                summary: { type: 'string' }
              }
            },
            pricing_recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_name: { type: 'string' },
                  current_price: { type: 'number' },
                  recommended_price: { type: 'number' },
                  expected_impact: { type: 'string' },
                  rationale: { type: 'string' }
                }
              }
            },
            bundle_suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  bundle_name: { type: 'string' },
                  products: { type: 'array', items: { type: 'string' } },
                  suggested_price: { type: 'number' },
                  expected_revenue_lift: { type: 'string' }
                }
              }
            },
            personalization_strategies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  segment: { type: 'string' },
                  offer_type: { type: 'string' },
                  discount_percentage: { type: 'number' },
                  expected_conversion: { type: 'string' }
                }
              }
            },
            quick_wins: {
              type: 'array',
              items: { type: 'string' }
            },
            revenue_forecast: {
              type: 'object',
              properties: {
                current_monthly: { type: 'number' },
                projected_monthly: { type: 'number' },
                confidence: { type: 'string' }
              }
            }
          }
        }
      });

      return result;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      toast.success('AI analysis complete!');
    }
  });

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-green-600" />
          AI Monetization Advisor
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!analysis ? (
          <div className="text-center py-12">
            <DollarSign className="w-20 h-20 text-green-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Optimize Your Revenue</h3>
            <p className="text-gray-600 mb-6">
              Get AI-powered insights on pricing, bundles, and personalization strategies
            </p>
            <Button
              onClick={() => analyzeMonetizationMutation.mutate()}
              disabled={analyzeMonetizationMutation.isPending}
              size="lg"
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              {analyzeMonetizationMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing Market Data...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate AI Analysis
                </>
              )}
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Health Score */}
            <div className="bg-white rounded-lg p-6 border-2 border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">Monetization Health</h3>
                <Badge className={`text-lg px-4 py-2 ${
                  analysis.overall_health.score >= 80 ? 'bg-green-600' :
                  analysis.overall_health.score >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                }`}>
                  {analysis.overall_health.score}/100
                </Badge>
              </div>
              <p className="text-gray-700">{analysis.overall_health.summary}</p>
            </div>

            {/* Revenue Forecast */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                <TrendingUp className="w-8 h-8 text-blue-600 mb-2" />
                <p className="text-sm text-gray-600">Current Monthly</p>
                <p className="text-3xl font-bold text-blue-600">
                  ${analysis.revenue_forecast.current_monthly.toFixed(0)}
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg p-4 border-2 border-green-300">
                <Zap className="w-8 h-8 text-green-600 mb-2" />
                <p className="text-sm text-gray-600">Projected Monthly</p>
                <p className="text-3xl font-bold text-green-600">
                  ${analysis.revenue_forecast.projected_monthly.toFixed(0)}
                </p>
                <Badge className="mt-2 bg-green-600">{analysis.revenue_forecast.confidence}</Badge>
              </div>
            </div>

            <Tabs defaultValue="pricing">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="bundles">Bundles</TabsTrigger>
                <TabsTrigger value="personalization">Offers</TabsTrigger>
                <TabsTrigger value="quick-wins">Quick Wins</TabsTrigger>
              </TabsList>

              <TabsContent value="pricing" className="space-y-3">
                {analysis.pricing_recommendations.map((rec, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold">{rec.product_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm line-through text-gray-400">
                            ${rec.current_price}
                          </span>
                          <span className="text-lg font-bold text-green-600">
                            ${rec.recommended_price}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-600">
                        {rec.expected_impact}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{rec.rationale}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="bundles" className="space-y-3">
                {analysis.bundle_suggestions.map((bundle, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold">{bundle.bundle_name}</h4>
                      <Badge className="bg-purple-600">${bundle.suggested_price}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {bundle.products.map((product, i) => (
                        <Badge key={i} variant="outline">{product}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-green-600 font-medium">
                      Expected: {bundle.expected_revenue_lift}
                    </p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="personalization" className="space-y-3">
                {analysis.personalization_strategies.map((strategy, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold">{strategy.segment}</h4>
                        <p className="text-sm text-gray-600">{strategy.offer_type}</p>
                      </div>
                      <Badge className="bg-orange-600">{strategy.discount_percentage}% OFF</Badge>
                    </div>
                    <p className="text-sm text-green-600">
                      Expected conversion: {strategy.expected_conversion}
                    </p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="quick-wins">
                <div className="space-y-2">
                  {analysis.quick_wins.map((win, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-white rounded-lg p-3 border">
                      <Target className="w-5 h-5 text-green-600 mt-0.5" />
                      <p className="text-sm flex-1">{win}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <Button
              variant="outline"
              onClick={() => analyzeMonetizationMutation.mutate()}
              className="w-full"
            >
              Refresh Analysis
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}