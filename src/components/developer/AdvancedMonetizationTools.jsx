import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, TrendingUp, Sparkles, Plus, Percent, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdvancedMonetizationTools({ game, developer }) {
  const [showIAPForm, setShowIAPForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [generatingPricing, setGeneratingPricing] = useState(false);
  const [aiPricing, setAiPricing] = useState(null);
  const queryClient = useQueryClient();

  const { data: iapItems = [] } = useQuery({
    queryKey: ['iap-items', game?.id],
    queryFn: async () => {
      return await base44.entities.InAppPurchase.filter({ game_id: game.id });
    },
    enabled: !!game
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions', game?.id],
    queryFn: async () => {
      return await base44.entities.Subscription.filter({ game_id: game.id });
    },
    enabled: !!game
  });

  const { data: promoEvents = [] } = useQuery({
    queryKey: ['promo-events', game?.id],
    queryFn: async () => {
      return await base44.entities.LiveEvent.filter({ 
        game_id: game.id,
        event_type: 'flash_sale'
      });
    },
    enabled: !!game
  });

  const { data: revenueBreakdown } = useQuery({
    queryKey: ['revenue-breakdown', game?.id],
    queryFn: async () => {
      const transactions = await base44.entities.Transaction.filter({ game_id: game.id });
      
      const breakdown = {
        install_fees: transactions.filter(t => t.transaction_type === 'install_fee').reduce((sum, t) => sum + t.amount, 0),
        iap: transactions.filter(t => t.transaction_type === 'in_app_purchase').reduce((sum, t) => sum + t.amount, 0),
        subscriptions: transactions.filter(t => t.transaction_type === 'subscription').reduce((sum, t) => sum + t.amount, 0),
        total: transactions.reduce((sum, t) => sum + t.amount, 0)
      };
      
      return breakdown;
    },
    enabled: !!game
  });

  const createIAPMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.InAppPurchase.create({
        ...data,
        game_id: game.id,
        developer_id: developer.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['iap-items']);
      setShowIAPForm(false);
      toast.success('IAP created!');
    }
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Subscription.create({
        ...data,
        game_id: game.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['subscriptions']);
      toast.success('Subscription tier created!');
    }
  });

  const createPromoEventMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.LiveEvent.create({
        ...data,
        game_id: game.id,
        event_type: 'flash_sale',
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['promo-events']);
      setShowEventForm(false);
      toast.success('Promotional event created!');
    }
  });

  const generateAIPricing = async () => {
    setGeneratingPricing(true);
    try {
      const engagement = await base44.entities.GameEngagement.filter({ game_id: game.id }, '-created_date', 100);
      const avgSession = engagement.reduce((sum, e) => sum + (e.session_duration || 0), 0) / engagement.length || 0;
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this mobile game and suggest optimal pricing strategy:

Game: ${game.title}
Category: ${game.category}
Total Installs: ${game.total_installs}
Current Revenue: $${game.total_revenue}
Avg Session: ${Math.floor(avgSession / 60)} minutes
Rating: ${game.average_rating}/5

Provide recommendations for:
1. Subscription tiers (3 levels: basic, premium, elite)
2. IAP pricing for consumables, power-ups, and cosmetics
3. Promotional event timing and discounts
4. Market positioning`,
        response_json_schema: {
          type: "object",
          properties: {
            subscription_tiers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "number" },
                  benefits: { type: "string" }
                }
              }
            },
            iap_recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  suggested_price: { type: "number" },
                  reasoning: { type: "string" }
                }
              }
            },
            promotional_strategy: {
              type: "object",
              properties: {
                timing: { type: "string" },
                discount_percentage: { type: "number" },
                target_items: { type: "string" }
              }
            }
          }
        }
      });

      setAiPricing(result);
    } catch (error) {
      toast.error('Failed to generate pricing');
    }
    setGeneratingPricing(false);
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Advanced Monetization Tools
            </div>
            <Button variant="secondary" onClick={generateAIPricing} disabled={generatingPricing}>
              {generatingPricing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              AI Pricing
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Revenue Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Install Fees</p>
              <p className="text-2xl font-bold text-blue-900">${revenueBreakdown?.install_fees.toFixed(0)}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">IAP Revenue</p>
              <p className="text-2xl font-bold text-green-900">${revenueBreakdown?.iap.toFixed(0)}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Subscriptions</p>
              <p className="text-2xl font-bold text-purple-900">${revenueBreakdown?.subscriptions.toFixed(0)}</p>
            </div>
            <div className="p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg">
              <p className="text-sm mb-1">Total Revenue</p>
              <p className="text-2xl font-bold">${revenueBreakdown?.total.toFixed(0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Pricing Recommendations */}
      {aiPricing && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Pricing Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-3">Suggested Subscription Tiers</h4>
              <div className="grid md:grid-cols-3 gap-3">
                {aiPricing.subscription_tiers.map((tier, idx) => (
                  <div key={idx} className="p-4 bg-white rounded-lg border">
                    <h5 className="font-bold mb-1">{tier.name}</h5>
                    <p className="text-2xl font-bold text-green-600 mb-2">${tier.price}/mo</p>
                    <p className="text-xs text-gray-600">{tier.benefits}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">IAP Pricing</h4>
              <div className="space-y-2">
                {aiPricing.iap_recommendations.map((rec, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border flex justify-between items-center">
                    <div>
                      <span className="font-semibold">{rec.category}</span>
                      <p className="text-xs text-gray-600">{rec.reasoning}</p>
                    </div>
                    <span className="text-lg font-bold text-green-600">${rec.suggested_price}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="font-semibold mb-2">Promotional Strategy</h4>
              <p className="text-sm mb-1"><strong>Timing:</strong> {aiPricing.promotional_strategy.timing}</p>
              <p className="text-sm mb-1"><strong>Discount:</strong> {aiPricing.promotional_strategy.discount_percentage}%</p>
              <p className="text-sm"><strong>Target:</strong> {aiPricing.promotional_strategy.target_items}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Management */}
      <Tabs defaultValue="iap">
        <TabsList>
          <TabsTrigger value="iap">In-App Purchases</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="events">Promotional Events</TabsTrigger>
        </TabsList>

        <TabsContent value="iap">
          <Card>
            <CardContent className="pt-6">
              <Button onClick={() => setShowIAPForm(true)} className="mb-4">
                <Plus className="w-4 h-4 mr-2" />
                Create IAP Item
              </Button>
              <div className="space-y-3">
                {iapItems.map((item) => (
                  <div key={item.id} className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{item.item_name}</p>
                      <p className="text-sm text-gray-600">{item.item_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">${item.price}</p>
                      <p className="text-xs text-gray-500">{item.purchases_count} purchases</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-4">
                {['Basic', 'Premium', 'Elite'].map((tier) => (
                  <div key={tier} className="p-6 bg-white border-2 rounded-lg">
                    <h3 className="text-xl font-bold mb-4">{tier}</h3>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      createSubscriptionMutation.mutate({
                        tier_name: tier,
                        price: parseFloat(formData.get('price')),
                        benefits: formData.get('benefits')
                      });
                    }}>
                      <Input name="price" type="number" step="0.01" placeholder="Price" className="mb-2" required />
                      <Input name="benefits" placeholder="Benefits" className="mb-3" required />
                      <Button type="submit" size="sm" className="w-full">Create</Button>
                    </form>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardContent className="pt-6">
              <Button onClick={() => setShowEventForm(true)} className="mb-4">
                <Calendar className="w-4 h-4 mr-2" />
                Create Promotional Event
              </Button>
              <div className="space-y-3">
                {promoEvents.map((event) => (
                  <div key={event.id} className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold">{event.title}</h4>
                      <Badge className="bg-red-600">-{event.event_items?.[0]?.discount_percentage}%</Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {new Date(event.start_time).toLocaleDateString()} - {new Date(event.end_time).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* IAP Form Dialog */}
      <Dialog open={showIAPForm} onOpenChange={setShowIAPForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create In-App Purchase</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            createIAPMutation.mutate({
              item_name: formData.get('name'),
              item_type: formData.get('type'),
              price: parseFloat(formData.get('price')),
              description: formData.get('description')
            });
          }} className="space-y-4">
            <Input name="name" placeholder="Item Name" required />
            <select name="type" className="w-full border rounded-md p-2" required>
              <option value="consumable">Consumable</option>
              <option value="power_up">Power-Up</option>
              <option value="cosmetic">Cosmetic</option>
              <option value="currency">Virtual Currency</option>
            </select>
            <Input name="price" type="number" step="0.01" placeholder="Price ($)" required />
            <Input name="description" placeholder="Description" />
            <Button type="submit" className="w-full">Create Item</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Promo Event Form Dialog */}
      <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Promotional Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            createPromoEventMutation.mutate({
              title: formData.get('title'),
              description: formData.get('description'),
              start_time: new Date(formData.get('start')).toISOString(),
              end_time: new Date(formData.get('end')).toISOString(),
              event_items: [{
                discount_percentage: parseInt(formData.get('discount'))
              }]
            });
          }} className="space-y-4">
            <Input name="title" placeholder="Event Name" required />
            <Input name="description" placeholder="Description" />
            <Input name="start" type="datetime-local" required />
            <Input name="end" type="datetime-local" required />
            <Input name="discount" type="number" min="5" max="90" placeholder="Discount %" required />
            <Button type="submit" className="w-full">Create Event</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}