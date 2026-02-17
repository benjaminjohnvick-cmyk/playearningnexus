import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Gift, 
  Star, 
  Briefcase,
  Plus,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export default function ContentCreatorMonetization({ user }) {
  const [newTierData, setNewTierData] = useState({
    tier_name: '',
    tier_level: 1,
    price_monthly: 0,
    perks: []
  });
  const [newPerk, setNewPerk] = useState('');
  const queryClient = useQueryClient();

  // Fetch creator's subscription tiers
  const { data: subscriptionTiers = [] } = useQuery({
    queryKey: ['creatorTiers', user?.id],
    queryFn: () => base44.entities.CreatorSubscriptionTier.filter({ creator_user_id: user.id }),
    enabled: !!user
  });

  // Fetch tips received
  const { data: tipsReceived = [] } = useQuery({
    queryKey: ['tipsReceived', user?.id],
    queryFn: () => base44.entities.StreamerTip.filter({ streamer_user_id: user.id }),
    enabled: !!user
  });

  // Fetch sponsored content
  const { data: sponsoredContent = [] } = useQuery({
    queryKey: ['sponsoredContent', user?.id],
    queryFn: () => base44.entities.SponsoredContent.filter({ creator_user_id: user.id }),
    enabled: !!user
  });

  // Calculate earnings
  const totalTips = tipsReceived.reduce((sum, tip) => {
    return sum + (tip.currency === 'USD' ? tip.amount : tip.amount * 0.01);
  }, 0);

  const totalSponsorships = sponsoredContent
    .filter(c => c.payment_status === 'paid')
    .reduce((sum, c) => sum + c.agreed_price + (c.performance_bonus || 0), 0);

  const monthlySubscriptionRevenue = subscriptionTiers.reduce((sum, tier) => {
    return sum + (tier.subscriber_count * tier.price_monthly);
  }, 0);

  // Create subscription tier mutation
  const createTierMutation = useMutation({
    mutationFn: (tierData) => base44.entities.CreatorSubscriptionTier.create(tierData),
    onSuccess: () => {
      queryClient.invalidateQueries(['creatorTiers']);
      toast.success('Subscription tier created!');
      setNewTierData({ tier_name: '', tier_level: 1, price_monthly: 0, perks: [] });
      setNewPerk('');
    }
  });

  const handleCreateTier = () => {
    if (!newTierData.tier_name || newTierData.price_monthly <= 0) {
      toast.error('Please fill in all fields');
      return;
    }
    createTierMutation.mutate({
      ...newTierData,
      creator_user_id: user.id
    });
  };

  const addPerk = () => {
    if (newPerk.trim()) {
      setNewTierData(prev => ({
        ...prev,
        perks: [...prev.perks, newPerk.trim()]
      }));
      setNewPerk('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Revenue Overview */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">${totalTips.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{tipsReceived.length} tips received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Sponsorships</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-purple-600" />
              <span className="text-2xl font-bold">${totalSponsorships.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{sponsoredContent.length} deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Monthly Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-600" />
              <span className="text-2xl font-bold">${monthlySubscriptionRevenue.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Recurring revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subscriptions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="tips">Tips</TabsTrigger>
          <TabsTrigger value="sponsorships">Sponsorships</TabsTrigger>
        </TabsList>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Subscription Tier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Tier Name</label>
                  <Input
                    placeholder="e.g., Bronze, Silver, Gold"
                    value={newTierData.tier_name}
                    onChange={(e) => setNewTierData(prev => ({ ...prev, tier_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Monthly Price ($)</label>
                  <Input
                    type="number"
                    placeholder="9.99"
                    value={newTierData.price_monthly}
                    onChange={(e) => setNewTierData(prev => ({ ...prev, price_monthly: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Perks</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a perk"
                    value={newPerk}
                    onChange={(e) => setNewPerk(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPerk()}
                  />
                  <Button onClick={addPerk}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newTierData.perks.map((perk, idx) => (
                    <Badge key={idx} variant="secondary">
                      {perk}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button onClick={handleCreateTier} className="w-full">
                Create Tier
              </Button>
            </CardContent>
          </Card>

          {/* Existing Tiers */}
          <div className="space-y-4">
            {subscriptionTiers.map((tier) => (
              <Card key={tier.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{tier.tier_name}</h3>
                      <p className="text-2xl font-bold text-green-600">${tier.price_monthly}/month</p>
                    </div>
                    <Badge variant={tier.is_active ? "default" : "secondary"}>
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {tier.perks.map((perk, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>{perk}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Subscribers</span>
                      <span className="font-bold">{tier.subscriber_count}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tips Tab */}
        <TabsContent value="tips" className="space-y-4">
          {tipsReceived.map((tip) => (
            <Card key={tip.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">
                      {tip.is_anonymous ? 'Anonymous' : 'User'} tipped you
                    </p>
                    {tip.message && (
                      <p className="text-sm text-gray-600 mt-1">"{tip.message}"</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(tip.created_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      {tip.currency === 'USD' ? `$${tip.amount}` : `${tip.amount} credits`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Sponsorships Tab */}
        <TabsContent value="sponsorships" className="space-y-4">
          {sponsoredContent.map((content) => (
            <Card key={content.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold">{content.title}</h3>
                    <p className="text-sm text-gray-600">{content.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{content.content_type}</Badge>
                      <Badge variant={
                        content.status === 'completed' ? 'default' : 
                        content.status === 'published' ? 'secondary' : 
                        'outline'
                      }>
                        {content.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-600">${content.agreed_price}</p>
                    {content.performance_bonus > 0 && (
                      <p className="text-sm text-green-600">+${content.performance_bonus} bonus</p>
                    )}
                    <Badge variant={
                      content.payment_status === 'paid' ? 'default' : 'secondary'
                    } className="mt-2">
                      {content.payment_status}
                    </Badge>
                  </div>
                </div>
                {content.views > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-600">{content.views.toLocaleString()} views</span>
                      <span className="text-gray-600">{content.engagement_rate}% engagement</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}