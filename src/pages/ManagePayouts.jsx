import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Wallet, Crown } from 'lucide-react';
import SurveyWalletDashboard from '@/components/ppc/SurveyWalletDashboard';
import TieredPayoutDashboard from '@/components/ppc/TieredPayoutDashboard';

export default function ManagePayouts() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-green-600" /> Manage Payouts & Survey Wallets
          </h1>
          <p className="text-gray-500 text-sm">Fund survey wallets, pause/resume surveys, and monitor AI quality checks in real-time.</p>
        </div>

        <Tabs defaultValue="wallets">
          <TabsList className="bg-white shadow-sm border mb-4">
            <TabsTrigger value="wallets"><Wallet className="w-3.5 h-3.5 mr-1" />Survey Wallets</TabsTrigger>
            <TabsTrigger value="reputation"><Crown className="w-3.5 h-3.5 mr-1" />Reputation & Tiers</TabsTrigger>
          </TabsList>
          <TabsContent value="wallets">
            <SurveyWalletDashboard user={user} />
          </TabsContent>
          <TabsContent value="reputation">
            <TieredPayoutDashboard user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}