import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart3, DollarSign, Users, TrendingUp, Activity } from 'lucide-react';
import ContentCreatorMonetization from '@/components/creators/ContentCreatorMonetization';
import CreatorAnalytics from '@/components/creators/CreatorAnalytics';
import CreatorPayouts from '@/components/creators/CreatorPayouts';
import GamePerformanceAnalytics from '@/components/creators/GamePerformanceAnalytics';
import CreatorTippingPanel from '@/components/creators/CreatorTippingPanel';
import ExclusiveSubscriptions from '@/components/creators/ExclusiveSubscriptions';
import DigitalAssetMarketplace from '@/components/creators/DigitalAssetMarketplace';

export default function CreatorDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Creator Dashboard
          </h1>
          <p className="text-gray-600">
            Manage your content, monetization, and analytics
          </p>
        </div>

        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="monetization" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Monetization</span>
            </TabsTrigger>
            <TabsTrigger value="tips" className="flex items-center gap-2">
              <span>💝</span>
              <span className="hidden sm:inline">Tips</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-2">
              <span>👑</span>
              <span className="hidden sm:inline">Subscriptions</span>
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="flex items-center gap-2">
              <span>🛍️</span>
              <span className="hidden sm:inline">Marketplace</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="payouts" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Payouts</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance">
            <GamePerformanceAnalytics user={user} />
          </TabsContent>

          <TabsContent value="monetization">
            <ContentCreatorMonetization user={user} />
          </TabsContent>

          <TabsContent value="tips">
            <div className="max-w-lg">
              <CreatorTippingPanel user={user} />
            </div>
          </TabsContent>

          <TabsContent value="subscriptions">
            <div className="max-w-2xl">
              <ExclusiveSubscriptions user={user} />
            </div>
          </TabsContent>

          <TabsContent value="marketplace">
            <DigitalAssetMarketplace user={user} />
          </TabsContent>

          <TabsContent value="analytics">
            <CreatorAnalytics user={user} />
          </TabsContent>

          <TabsContent value="payouts">
            <CreatorPayouts user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}