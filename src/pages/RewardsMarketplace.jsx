import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import RewardMarketplace from '@/components/rewards/RewardMarketplace';
import PayoutRequestForm from '@/components/payout/PayoutRequestForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ShoppingBag, TrendingUp } from 'lucide-react';

export default function RewardsMarketplacePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Auth error:', error);
        base44.auth.redirectToLogin();
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Tabs defaultValue="perks" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="perks" className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Rewards Marketplace
          </TabsTrigger>
          <TabsTrigger value="payout" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Request Payout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perks" className="mt-6">
          <RewardMarketplace user={user} />
        </TabsContent>

        <TabsContent value="payout" className="mt-6">
          <PayoutRequestForm user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}