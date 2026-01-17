import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, DollarSign, Package, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function EventMonetizationAI({ eventId, gameId }) {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => base44.entities.LiveEvent.filter({ id: eventId }).then(res => res[0]),
    enabled: !!eventId
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['eventPurchases', gameId],
    queryFn: () => base44.entities.InAppPurchase.filter({ game_id: gameId }, '-created_date', 200),
    enabled: !!gameId
  });

  const { data: engagementData = [] } = useQuery({
    queryKey: ['gameEngagement', gameId],
    queryFn: () => base44.entities.GameEngagement.filter({ game_id: gameId }, '-created_date', 500),
    enabled: !!gameId
  });

  const analyzeEventMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);

      const playerSpendingPatterns = purchases.reduce((acc, p) => {
        const hour = new Date(p.created_date).getHours();
        const dayOfWeek = new Date(p.created_date).getDay();
        acc.totalRevenue = (acc.totalRevenue || 0) + (p.amount || 0);
        acc.avgPurchaseValue = acc.totalRevenue / purchases.length;
        acc.peakHours = acc.peakHours || {};
        acc.peakHours[hour] = (acc.peakHours[hour] || 0) + 1;
        return acc;
      }, {});

      const engagementPatterns = {
        avgSessionTime: engagementData.reduce((sum, e) => sum + (e.session_duration || 0), 0) / engagementData.length,
        totalSessions: engagementData.length,
        activeUsers: new Set(engagementData.map(e => e.user_id)).size
      };

      const prompt = `You are a game monetization expert. Analyze the following event and player data to provide monetization recommendations.

Event Details:
- Event Type: ${event?.event_type}
- Event Title: ${event?.title}
- Duration: ${event?.start_time} to ${event?.end_time}
- Current Participants: ${event?.participants_count || 0}

Player Spending Patterns:
- Total Revenue: $${playerSpendingPatterns.totalRevenue?.toFixed(2) || 0}
- Average Purchase Value: $${playerSpendingPatterns.avgPurchaseValue?.toFixed(2) || 0}
- Total Purchases: ${purchases.length}

Player Engagement:
- Average Session Time: ${engagementPatterns.avgSessionTime?.toFixed(0) || 0} minutes
- Total Sessions: ${engagementPatterns.totalSessions}
- Active Players: ${engagementPatterns.activeUsers}

Please provide:
1. Optimal pricing strategy for event-specific items (suggest 3-5 items with recommended prices and discount percentages)
2. Personalized bundle recommendations (describe 2-3 bundles targeting different player segments)
3. Event theme suggestions that would maximize engagement and spending
4. Recommended event duration and timing based on player activity patterns
5. Expected revenue impact and conversion rate predictions`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            pricing_strategy: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item_name: { type: 'string' },
                  base_price: { type: 'number' },
                  recommended_price: { type: 'number' },
                  discount_percentage: { type: 'number' },
                  rationale: { type: 'string' }
                }
              }
            },
            personalized_bundles: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  bundle_name: { type: 'string' },
                  target_segment: { type: 'string' },
                  items: { type: 'array', items: { type: 'string' } },
                  price: { type: 'number' },
                  expected_conversion: { type: 'number' }
                }
              }
            },
            event_theme_suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  theme: { type: 'string' },
                  description: { type: 'string' },
                  engagement_potential: { type: 'string' }
                }
              }
            },
            timing_recommendations: {
              type: 'object',
              properties: {
                optimal_duration_hours: { type: 'number' },
                best_start_time: { type: 'string' },
                reasoning: { type: 'string' }
              }
            },
            revenue_predictions: {
              type: 'object',
              properties: {
                expected_revenue: { type: 'number' },
                expected_conversion_rate: { type: 'number' },
                confidence_level: { type: 'string' }
              }
            }
          }
        }
      });

      return result;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      setIsAnalyzing(false);
      toast.success('AI analysis complete!');
    },
    onError: () => {
      setIsAnalyzing(false);
      toast.error('Analysis failed');
    }
  });

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Monetization Optimizer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis ? (
          <Button
            onClick={() => analyzeEventMutation.mutate()}
            disabled={isAnalyzing}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing Event Performance...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate AI Recommendations
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-6">
            {/* Pricing Strategy */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Optimal Pricing Strategy
              </h3>
              <div className="space-y-2">
                {analysis.pricing_strategy?.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold">{item.item_name}</p>
                      <Badge className="bg-green-600">-{item.discount_percentage}%</Badge>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-500 line-through">${item.base_price}</span>
                      <span className="text-green-600 font-bold">${item.recommended_price}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{item.rationale}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Personalized Bundles */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Personalized Bundles
              </h3>
              <div className="space-y-2">
                {analysis.personalized_bundles?.map((bundle, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{bundle.bundle_name}</p>
                        <Badge variant="outline" className="text-xs">{bundle.target_segment}</Badge>
                      </div>
                      <p className="font-bold text-blue-600">${bundle.price}</p>
                    </div>
                    <p className="text-xs text-gray-600">Items: {bundle.items?.join(', ')}</p>
                    <p className="text-xs text-green-600 mt-1">
                      Expected Conversion: {bundle.expected_conversion}%
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Event Themes */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Event Theme Suggestions
              </h3>
              <div className="space-y-2">
                {analysis.event_theme_suggestions?.map((theme, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border">
                    <p className="font-semibold text-purple-700">{theme.theme}</p>
                    <p className="text-sm text-gray-700 mt-1">{theme.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Engagement: {theme.engagement_potential}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Revenue Predictions */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                Revenue Predictions
              </h3>
              <div className="bg-white p-4 rounded-lg border">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Expected Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${analysis.revenue_predictions?.expected_revenue?.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Conversion Rate</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {analysis.revenue_predictions?.expected_conversion_rate}%
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Confidence: {analysis.revenue_predictions?.confidence_level}
                </p>
              </div>
            </motion.div>

            <Button
              variant="outline"
              onClick={() => setAnalysis(null)}
              className="w-full"
            >
              Generate New Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}