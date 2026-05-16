import React from 'react';
import { base44 } from '@/api/base44Client';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SmartPayoutScheduler from '@/components/payout/SmartPayoutScheduler';
import WishlistShareEngine from '@/components/referral/WishlistShareEngine';

export default function WishlistIntelligence() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
      } catch {
        base44.auth.redirectToLogin();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Wishlist Intelligence</h1>
          <p className="text-gray-600">Smart payouts + referral earnings for your dreams</p>
        </div>

        <Tabs defaultValue="scheduler" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scheduler">💰 Smart Payout Scheduler</TabsTrigger>
            <TabsTrigger value="referral">🔗 Wishlist Share Referrals</TabsTrigger>
          </TabsList>

          <TabsContent value="scheduler" className="space-y-4">
            <SmartPayoutScheduler userId={user.id} />
          </TabsContent>

          <TabsContent value="referral" className="space-y-4">
            <WishlistShareEngine userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}