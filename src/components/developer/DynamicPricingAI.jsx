import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, DollarSign, Target, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function DynamicPricingAI({ game, developerId }) {
  const [suggestion, setSuggestion] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const { data: competitors = [] } = useQuery({
    queryKey: ['competitorGames', game.category],
    queryFn: () => base44.entities.Game.filter({ 
      category: game.category,
      marketplace_approved: true 
    })
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['gameTransactions', game.id],
    queryFn: () => base44.entities.Transaction.filter({ game_id: game.id })
  });

  const updatePriceMutation = useMutation({
    mutationFn: (newPrice) => base44.entities.Game.update(game.id, { price: newPrice }),
    onSuccess: () => {
      queryClient.invalidateQueries(['developerGames']);
      toast.success('Price updated successfully!');
    }
  });

  const analyzePricing = async () => {
    setIsAnalyzing(true);
    try {
      // Get competitor pricing data
      const competitorPrices = competitors
        .filter(g => g.id !== game.id && g.price > 0)
        .map(g => ({ title: g.title, price: g.price, rating: g.average_rating, installs: g.total_installs }));

      const avgCompetitorPrice = competitorPrices.reduce((sum, g) => sum + g.price, 0) / (competitorPrices.length || 1);

      // Get demand data
      const recentTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.created_date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return transactionDate >= thirtyDaysAgo;
      });

      const prompt = `Analyze optimal pricing for this game and provide recommendations.

Game: ${game.title}
Current Price: $${game.price}
Category: ${game.category}
Rating: ${game.average_rating || 0}/5
Total Installs: ${game.total_installs || 0}
Recent Sales (30 days): ${recentTransactions.length}

Competitor Data (${competitorPrices.length} games):
Average Price: $${avgCompetitorPrice.toFixed(2)}
Price Range: $${Math.min(...competitorPrices.map(g => g.price)).toFixed(2)} - $${Math.max(...competitorPrices.map(g => g.price)).toFixed(2)}
Top Competitors: ${competitorPrices.slice(0, 5).map(g => `${g.title} ($${g.price}, ${g.rating} stars, ${g.installs} installs)`).join('; ')}

Market Trends:
- Recent transaction volume: ${recentTransactions.length} in last 30 days
- Current pricing vs market: ${game.price > avgCompetitorPrice ? 'above' : 'below'} average

Provide pricing strategy with optimal price point, expected impact, and reasoning.`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            suggested_price: { type: 'number' },
            reasoning: { type: 'string' },
            expected_impact: { type: 'string' },
            confidence_level: { type: 'string' },
            market_position: { type: 'string' },
            alternative_strategies: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  strategy: { type: 'string' },
                  price: { type: 'number' }
                }
              } 
            }
          }
        }
      });

      setSuggestion(aiResponse);
    } catch (error) {
      console.error('Error analyzing pricing:', error);
      toast.error('Failed to analyze pricing');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyPricing = () => {
    if (suggestion?.suggested_price) {
      updatePriceMutation.mutate(suggestion.suggested_price);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          AI Dynamic Pricing - {game.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Current Price</p>
            <p className="text-2xl font-bold text-blue-600">${game.price.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">Market Average</p>
            <p className="text-2xl font-bold text-purple-600">
              ${competitors.length > 0 ? 
                (competitors.reduce((sum, g) => sum + (g.price || 0), 0) / competitors.length).toFixed(2) : 
                '0.00'}
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">30-Day Sales</p>
            <p className="text-2xl font-bold text-green-600">{transactions.length}</p>
          </div>
        </div>

        <Button 
          onClick={analyzePricing} 
          disabled={isAnalyzing}
          className="w-full bg-gradient-to-r from-green-600 to-blue-600"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing Market...
            </>
          ) : (
            <>
              <Target className="w-4 h-4 mr-2" />
              Analyze Optimal Pricing
            </>
          )}
        </Button>

        {suggestion && (
          <div className="space-y-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">AI Suggested Price</p>
                <p className="text-3xl font-bold text-green-600">${suggestion.suggested_price.toFixed(2)}</p>
                <Badge className="mt-2">{suggestion.confidence_level} Confidence</Badge>
              </div>
              <Button onClick={applyPricing} disabled={updatePriceMutation.isPending}>
                <DollarSign className="w-4 h-4 mr-2" />
                Apply Price
              </Button>
            </div>

            <div>
              <p className="font-medium mb-1">Market Position:</p>
              <p className="text-sm text-gray-700">{suggestion.market_position}</p>
            </div>

            <div>
              <p className="font-medium mb-1">Reasoning:</p>
              <p className="text-sm text-gray-700">{suggestion.reasoning}</p>
            </div>

            <div>
              <p className="font-medium mb-1">Expected Impact:</p>
              <p className="text-sm text-gray-700">{suggestion.expected_impact}</p>
            </div>

            {suggestion.alternative_strategies?.length > 0 && (
              <div>
                <p className="font-medium mb-2">Alternative Strategies:</p>
                <div className="space-y-2">
                  {suggestion.alternative_strategies.map((alt, idx) => (
                    <div key={idx} className="p-2 bg-white rounded border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{alt.strategy}</span>
                        <Badge variant="outline">${alt.price.toFixed(2)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}