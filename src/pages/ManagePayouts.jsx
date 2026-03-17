import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wallet, Users } from 'lucide-react';
import SurveyWalletDashboard from '@/components/ppc/SurveyWalletDashboard';

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

        <SurveyWalletDashboard user={user} />
      </div>
    </div>
  );
}