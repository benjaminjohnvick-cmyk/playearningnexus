import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Megaphone, TestTube, Plus, TrendingUp, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function MarketingToolsPanel({ developerId, games }) {
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showABTestForm, setShowABTestForm] = useState(false);
  const queryClient = useQueryClient();

  const [campaignData, setCampaignData] = useState({
    campaign_name: '',
    campaign_type: 'email',
    content: '',
    budget: 0,
    game_id: ''
  });

  const [testData, setTestData] = useState({
    test_name: '',
    game_id: '',
    variant_a: {},
    variant_b: {}
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', developerId],
    queryFn: () => base44.entities.MarketingCampaign.filter({ developer_id: developerId }),
    enabled: !!developerId
  });

  const { data: abTests = [] } = useQuery({
    queryKey: ['abTests', developerId],
    queryFn: () => base44.entities.ABTest.filter({ developer_id: developerId }),
    enabled: !!developerId
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data) => base44.entities.MarketingCampaign.create({
      ...data,
      developer_id: developerId,
      start_date: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCampaignForm(false);
      setCampaignData({ campaign_name: '', campaign_type: 'email', content: '', budget: 0, game_id: '' });
      toast.success('Campaign created!');
    }
  });

  const createABTestMutation = useMutation({
    mutationFn: (data) => base44.entities.ABTest.create({
      ...data,
      developer_id: developerId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abTests'] });
      setShowABTestForm(false);
      setTestData({ test_name: '', game_id: '', variant_a: {}, variant_b: {} });
      toast.success('A/B test created!');
    }
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="campaigns">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="campaigns">
            <Megaphone className="w-4 h-4 mr-2" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="abtests">
            <TestTube className="w-4 h-4 mr-2" />
            A/B Tests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Marketing Campaigns</h3>
            <Button onClick={() => setShowCampaignForm(!showCampaignForm)} className="bg-gradient-to-r from-red-600 to-red-700">
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>

          {showCampaignForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create Campaign</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Campaign Name"
                  value={campaignData.campaign_name}
                  onChange={(e) => setCampaignData({ ...campaignData, campaign_name: e.target.value })}
                />
                <Select value={campaignData.campaign_type} onValueChange={(v) => setCampaignData({ ...campaignData, campaign_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="in_app">In-App</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={campaignData.game_id} onValueChange={(v) => setCampaignData({ ...campaignData, game_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Campaign message..."
                  value={campaignData.content}
                  onChange={(e) => setCampaignData({ ...campaignData, content: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Budget ($)"
                  value={campaignData.budget}
                  onChange={(e) => setCampaignData({ ...campaignData, budget: parseFloat(e.target.value) })}
                />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowCampaignForm(false)}>Cancel</Button>
                  <Button onClick={() => createCampaignMutation.mutate(campaignData)} className="bg-red-600">Create</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {campaigns.map(campaign => (
              <Card key={campaign.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-lg">{campaign.campaign_name}</h4>
                      <Badge variant="outline">{campaign.campaign_type}</Badge>
                    </div>
                    <Badge className={campaign.is_active ? 'bg-green-600' : 'bg-gray-400'}>
                      {campaign.is_active ? 'Active' : 'Ended'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Impressions</p>
                      <p className="text-xl font-bold">{campaign.impressions || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Clicks</p>
                      <p className="text-xl font-bold">{campaign.clicks || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Conversions</p>
                      <p className="text-xl font-bold">{campaign.conversions || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Budget</p>
                      <p className="text-xl font-bold">${campaign.budget}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="abtests" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">A/B Tests</h3>
            <Button onClick={() => setShowABTestForm(!showABTestForm)} className="bg-gradient-to-r from-red-600 to-red-700">
              <Plus className="w-4 h-4 mr-2" />
              New Test
            </Button>
          </div>

          {showABTestForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create A/B Test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Test Name"
                  value={testData.test_name}
                  onChange={(e) => setTestData({ ...testData, test_name: e.target.value })}
                />
                <Select value={testData.game_id} onValueChange={(v) => setTestData({ ...testData, game_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowABTestForm(false)}>Cancel</Button>
                  <Button onClick={() => createABTestMutation.mutate(testData)} className="bg-red-600">Create</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {abTests.map(test => (
              <Card key={test.id}>
                <CardContent className="p-6">
                  <h4 className="font-bold text-lg mb-4">{test.test_name}</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="border-2 border-gray-200 rounded-lg p-4">
                      <h5 className="font-bold mb-2">Variant A</h5>
                      <p className="text-sm text-gray-600">Users: {test.users_variant_a || 0}</p>
                      <p className="text-2xl font-bold text-blue-600">{((test.conversion_rate_a || 0) * 100).toFixed(1)}%</p>
                    </div>
                    <div className="border-2 border-gray-200 rounded-lg p-4">
                      <h5 className="font-bold mb-2">Variant B</h5>
                      <p className="text-sm text-gray-600">Users: {test.users_variant_b || 0}</p>
                      <p className="text-2xl font-bold text-purple-600">{((test.conversion_rate_b || 0) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  {test.winner && (
                    <p className="mt-4 text-center font-bold text-green-600">Winner: Variant {test.winner.toUpperCase()}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}