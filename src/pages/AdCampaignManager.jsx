import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, BarChart2, Zap, TrendingUp, Settings2, RefreshCw } from 'lucide-react';
import CampaignCreator from '@/components/adcampaign/CampaignCreator';
import CampaignList from '@/components/adcampaign/CampaignList';
import CampaignAnalytics from '@/components/adcampaign/CampaignAnalytics';
import BiddingAssistant from '@/components/adcampaign/BiddingAssistant';
import LTVChurnPanel from '@/components/adcampaign/LTVChurnPanel';

export default function AdCampaignManager() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('campaigns');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: campaigns = [], isLoading, refetch } = useQuery({
    queryKey: ['adCampaigns', user?.id],
    queryFn: () => base44.entities.AdCampaign.filter({ advertiser_id: user?.id }, '-created_date', 50),
    enabled: !!user,
    refetchInterval: 30000
  });

  const totalSpend = campaigns.reduce((s, c) => s + (c.budget_spent || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + (c.performance?.revenue_generated || 0), 0);
  const totalImpressions = campaigns.reduce((s, c) => s + (c.performance?.impressions || 0), 0);
  const totalConversions = campaigns.reduce((s, c) => s + (c.performance?.conversions || 0), 0);
  const avgROAS = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '0.00';
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  const handleCampaignCreated = (campaign) => {
    setShowCreator(false);
    queryClient.invalidateQueries(['adCampaigns']);
    setSelectedCampaign(campaign);
    setActiveTab('analytics');
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Ad Campaign Manager</h1>
            <p className="text-slate-400 text-sm mt-1">AI-powered campaign creation, real-time analytics & automated bidding</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button onClick={() => setShowCreator(true)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg">
              <Plus className="w-4 h-4 mr-2" /> New Campaign
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active Campaigns', value: activeCampaigns, suffix: '', color: 'from-green-500 to-emerald-600', icon: '🟢' },
            { label: 'Total Spend', value: `$${totalSpend.toFixed(0)}`, suffix: '', color: 'from-red-500 to-rose-600', icon: '💸' },
            { label: 'Revenue', value: `$${totalRevenue.toFixed(0)}`, suffix: '', color: 'from-blue-500 to-cyan-600', icon: '💰' },
            { label: 'Avg ROAS', value: `${avgROAS}x`, suffix: '', color: 'from-yellow-500 to-orange-500', icon: '📈' },
            { label: 'Conversions', value: totalConversions.toLocaleString(), suffix: '', color: 'from-purple-500 to-violet-600', icon: '🎯' }
          ].map((kpi, i) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="text-2xl mb-1">{kpi.icon}</div>
              <div className={`text-xl font-bold bg-gradient-to-r ${kpi.color} bg-clip-text text-transparent`}>{kpi.value}</div>
              <div className="text-slate-400 text-xs mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Campaign Creator Modal */}
        {showCreator && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-4xl my-4">
              <CampaignCreator
                userId={user.id}
                onCreated={handleCampaignCreated}
                onClose={() => setShowCreator(false)}
              />
            </div>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="campaigns" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-300">
              <Settings2 className="w-4 h-4 mr-1" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-300">
              <BarChart2 className="w-4 h-4 mr-1" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="bidding" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-300">
              <Zap className="w-4 h-4 mr-1" /> Bidding AI
            </TabsTrigger>
            <TabsTrigger value="ltv" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-300">
              <TrendingUp className="w-4 h-4 mr-1" /> LTV / Churn
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <CampaignList
              campaigns={campaigns}
              isLoading={isLoading}
              selectedCampaign={selectedCampaign}
              onSelect={(c) => { setSelectedCampaign(c); setActiveTab('analytics'); }}
              onRefresh={() => queryClient.invalidateQueries(['adCampaigns'])}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <CampaignAnalytics
              campaigns={campaigns}
              selectedCampaign={selectedCampaign}
              onSelectCampaign={setSelectedCampaign}
            />
          </TabsContent>

          <TabsContent value="bidding">
            <BiddingAssistant
              campaigns={campaigns}
              selectedCampaign={selectedCampaign}
              onSelectCampaign={setSelectedCampaign}
              onRefresh={() => queryClient.invalidateQueries(['adCampaigns'])}
            />
          </TabsContent>

          <TabsContent value="ltv">
            <LTVChurnPanel
              campaigns={campaigns}
              selectedCampaign={selectedCampaign}
              onSelectCampaign={setSelectedCampaign}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}