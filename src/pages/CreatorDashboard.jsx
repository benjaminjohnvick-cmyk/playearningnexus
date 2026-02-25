import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart3, DollarSign, Users, TrendingUp, Activity } from 'lucide-react';
import ContentCreatorMonetization from '@/components/creators/ContentCreatorMonetization';
import CreatorAnalytics from '@/components/creators/CreatorAnalytics';
import CreatorPayouts from '@/components/creators/CreatorPayouts';
import GamePerformanceAnalytics from '@/components/creators/GamePerformanceAnalytics';

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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="monetization" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Monetization
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="payouts" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Payouts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance">
            <GamePerformanceAnalytics user={user} />
          </TabsContent>

          <TabsContent value="monetization">
            <ContentCreatorMonetization user={user} />
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