import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, DollarSign, Target, Zap } from "lucide-react";
import { toast } from "sonner";

export default function AIDynamicPricing({ game }) {
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: gameEngagement = [] } = useQuery({
    queryKey: ['game-engagement', game?.id],
    queryFn: async () => {
      return await base44.entities.GameEngagement.filter({
        game_id: game.id
      }, '-created_date', 100);
    },
    enabled: !!game
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['game-transactions', game?.id],
    queryFn: async () => {
      return await base44.entities.Transaction.filter({
        game_id: game.id,
        transaction_type: 'game_purchase'
      }, '-created_date', 50);
    },
    enabled: !!game
  });

  const generateAIPricing = async () => {
    setLoading(true);
    try {
      const avgSessionTime = gameEngagement.reduce((sum, e) => sum + (e.session_duration || 0), 0) / gameEngagement.length || 0;
      const conversionRate = transactions.length / gameEngagement.length || 0;
      const avgRevenue = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length || 0;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this game's performance and recommend optimal pricing:
        
Current Price: $${game.price}
Engagement Metrics:
- Average session time: ${avgSessionTime.toFixed(0)} seconds
- Total sessions: ${gameEngagement.length}
- Conversion rate: ${(conversionRate * 100).toFixed(2)}%
- Average revenue per user: $${avgRevenue.toFixed(2)}

Based on these metrics, provide:
1. Optimal price point
2. Suggested bundle offerings
3. Dynamic discount strategy
4. Personalized pricing tiers`,
        response_json_schema: {
          type: "object",
          properties: {
            optimal_price: { type: "number" },
            price_reasoning: { type: "string" },
            bundles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "number" },
                  items: { type: "array", items: { type: "string" } }
                }
              }
            },
            discount_strategy: {
              type: "object",
              properties: {
                high_engagement_discount: { type: "number" },
                referral_bonus_discount: { type: "number" },
                time_limited_offer: { type: "number" }
              }
            },
            personalized_tiers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tier: { type: "string" },
                  price: { type: "number" },
                  criteria: { type: "string" }
                }
              }
            }
          }
        }
      });

      setAiRecommendations(result);
    } catch (error) {
      toast.error('Failed to generate pricing recommendations');
    }
    setLoading(false);
  };

  const applyPricingMutation = useMutation({
    mutationFn: async (newPrice) => {
      await base44.entities.Game.update(game.id, {
        price: newPrice
      });

      await base44.entities.DynamicPricing.create({
        game_id: game.id,
        original_price: game.price,
        new_price: newPrice,
        ai_recommended: true,
        reasoning: aiRecommendations?.price_reasoning
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['games']);
      toast.success('Pricing updated!');
    }
  });

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            AI Dynamic Pricing Engine
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600">Current Price</p>
              <p className="text-3xl font-bold text-gray-900">${game.price}</p>
            </div>
            <Button
              onClick={generateAIPricing}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {loading ? (
                <>
                  <Zap className="w-4 h-4 mr-2 animate-pulse" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Recommendations
                </>
              )}
            </Button>
          </div>

          {aiRecommendations && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-green-900">Optimal Price</span>
                  <Badge className="bg-green-600 text-xl px-4 py-1">
                    ${aiRecommendations.optimal_price}
                  </Badge>
                </div>
                <p className="text-sm text-green-700 mb-3">{aiRecommendations.price_reasoning}</p>
                <Button
                  size="sm"
                  onClick={() => applyPricingMutation.mutate(aiRecommendations.optimal_price)}
                  className="bg-green-600"
                >
                  Apply This Price
                </Button>
              </div>

              {aiRecommendations.bundles?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Recommended Bundles
                  </h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {aiRecommendations.bundles.map((bundle, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-semibold">{bundle.name}</h5>
                          <Badge className="bg-blue-600">${bundle.price}</Badge>
                        </div>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {bundle.items.map((item, i) => (
                            <li key={i}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiRecommendations.discount_strategy && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Dynamic Discount Strategy
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>High Engagement Users:</span>
                      <span className="font-semibold">{aiRecommendations.discount_strategy.high_engagement_discount}% off</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Referral Bonus:</span>
                      <span className="font-semibold">{aiRecommendations.discount_strategy.referral_bonus_discount}% off</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Limited Time Offer:</span>
                      <span className="font-semibold">{aiRecommendations.discount_strategy.time_limited_offer}% off</span>
                    </div>
                  </div>
                </div>
              )}

              {aiRecommendations.personalized_tiers?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Personalized Pricing Tiers</h4>
                  <div className="space-y-2">
                    {aiRecommendations.personalized_tiers.map((tier, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{tier.tier}</p>
                          <p className="text-xs text-gray-600">{tier.criteria}</p>
                        </div>
                        <Badge>${tier.price}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}