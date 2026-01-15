import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function DynamicPricingPanel({ businessClient, games, items, transactions }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [priceAdjustment, setPriceAdjustment] = useState(0);
  const [targetSegment, setTargetSegment] = useState('all');
  const queryClient = useQueryClient();

  const { data: dynamicPricing = [] } = useQuery({
    queryKey: ['dynamicPricing', businessClient.id],
    queryFn: async () => {
      const gameIds = games.map(g => g.id);
      if (gameIds.length === 0) return [];
      const allPricing = await base44.entities.DynamicPricing.list();
      return allPricing.filter(p => gameIds.includes(p.game_id));
    },
    enabled: games.length > 0
  });

  const createPricingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) return;
      
      const item = items.find(i => i.id === selectedItem);
      const adjustedPrice = item.price * (1 + priceAdjustment / 100);

      // Use AI to get optimization insights
      const aiInsights = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this in-app purchase pricing strategy:
        Item: ${item.item_name} (${item.item_type})
        Base Price: $${item.price}
        Adjusted Price: $${adjustedPrice.toFixed(2)} (${priceAdjustment > 0 ? '+' : ''}${priceAdjustment}%)
        Target Segment: ${targetSegment}
        Current Sales: ${item.total_purchases || 0}
        
        Provide a brief optimization reason (1 sentence) for this pricing strategy.`,
        response_json_schema: {
          type: "object",
          properties: {
            optimization_reason: { type: "string" }
          }
        }
      });

      await base44.entities.DynamicPricing.create({
        game_id: item.game_id,
        item_id: item.id,
        base_price: item.price,
        current_price: adjustedPrice,
        price_adjustment_percentage: priceAdjustment,
        user_segment: targetSegment,
        optimization_reason: aiInsights.optimization_reason
      });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamicPricing'] });
      toast.success('Dynamic pricing created!');
      setSelectedItem(null);
      setPriceAdjustment(0);
    }
  });

  const selectedItemData = items.find(i => i.id === selectedItem);
  const adjustedPrice = selectedItemData ? selectedItemData.price * (1 + priceAdjustment / 100) : 0;

  return (
    <div className="space-y-6">
      {/* AI-Powered Pricing Tool */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            AI-Powered Dynamic Pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Item</label>
            <Select value={selectedItem || ''} onValueChange={setSelectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.item_name} - ${item.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Price Adjustment: {priceAdjustment > 0 ? '+' : ''}{priceAdjustment}%
                </label>
                <Slider
                  value={[priceAdjustment]}
                  onValueChange={(value) => setPriceAdjustment(value[0])}
                  min={-20}
                  max={20}
                  step={1}
                  className="mb-2"
                />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Base: ${selectedItemData.price.toFixed(2)}</span>
                  <span className="font-bold text-purple-600">
                    New: ${adjustedPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Target User Segment</label>
                <Select value={targetSegment} onValueChange={setTargetSegment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="whale">High Spenders (Whales)</SelectItem>
                    <SelectItem value="dolphin">Medium Spenders (Dolphins)</SelectItem>
                    <SelectItem value="minnow">Low Spenders (Minnows)</SelectItem>
                    <SelectItem value="free">Free Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => createPricingMutation.mutate()}
                disabled={createPricingMutation.isPending}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Zap className="w-4 h-4 mr-2" />
                {createPricingMutation.isPending ? 'Creating...' : 'Create Dynamic Pricing'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Active Pricing Strategies */}
      <Card>
        <CardHeader>
          <CardTitle>Active Pricing Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          {dynamicPricing.length > 0 ? (
            <div className="space-y-4">
              {dynamicPricing.map((pricing) => {
                const item = items.find(i => i.id === pricing.item_id);
                return (
                  <Card key={pricing.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold mb-1">{item?.item_name}</h4>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="capitalize">{pricing.user_segment}</Badge>
                          <Badge className={pricing.price_adjustment_percentage > 0 ? 'bg-green-600' : 'bg-red-600'}>
                            {pricing.price_adjustment_percentage > 0 ? '+' : ''}{pricing.price_adjustment_percentage}%
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{pricing.optimization_reason}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">
                            Base: ${pricing.base_price.toFixed(2)}
                          </span>
                          <span className="font-bold text-purple-600">
                            Current: ${pricing.current_price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-sm mb-1">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span>{(pricing.conversion_rate || 0).toFixed(1)}% CR</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span>${(pricing.revenue_generated || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No dynamic pricing strategies yet</p>
              <p className="text-sm mt-1">Create your first pricing strategy above</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}