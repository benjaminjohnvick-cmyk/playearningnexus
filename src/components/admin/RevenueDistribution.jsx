import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users, Zap } from "lucide-react";

export default function RevenueDistribution() {
  const { data: paypalAccounts = [] } = useQuery({
    queryKey: ['paypal-accounts'],
    queryFn: () => base44.entities.PayPalAccount.list()
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['all-transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 5000)
  });

  const { data: allSurveys = [] } = useQuery({
    queryKey: ['all-surveys'],
    queryFn: () => base44.entities.Survey.list('-created_date', 5000)
  });

  const { data: automatedPayments = [] } = useQuery({
    queryKey: ['automated-payments'],
    queryFn: () => base44.entities.AutomatedPayment.list('-created_date', 1000)
  });

  // Calculate metrics
  const totalSurveyRevenue = allSurveys.reduce((sum, s) => sum + (s.earnings || 0), 0);
  const platformShare = totalSurveyRevenue * 0.5;
  const developerShare = totalSurveyRevenue * 0.5;
  
  const installFeeRevenue = allTransactions
    .filter(t => t.transaction_type === 'install_fee')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const totalPlatformRevenue = platformShare + installFeeRevenue;
  
  const paypalBalance = paypalAccounts[0]?.balance || 0;
  
  const pendingPayments = automatedPayments
    .filter(p => p.payment_status === 'pending')
    .reduce((sum, p) => sum + (p.amount_owed || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h3 className="font-bold text-gray-700">PayPal Balance</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">${paypalBalance.toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">Current balance</p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h3 className="font-bold text-gray-700">Platform Share</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">${totalPlatformRevenue.toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">50% + install fees</p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-purple-600" />
            <h3 className="font-bold text-gray-700">Developer Share</h3>
          </div>
          <p className="text-3xl font-bold text-purple-600">${developerShare.toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">50% of surveys</p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-6 h-6 text-amber-600" />
            <h3 className="font-bold text-gray-700">Pending Payouts</h3>
          </div>
          <p className="text-3xl font-bold text-amber-600">${pendingPayments.toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">To be distributed</p>
        </Card>
      </div>

      <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
        <h3 className="text-xl font-bold mb-4">Automated Payment Distribution</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
            <span className="font-medium">Survey Revenue Split</span>
            <Badge className="bg-red-600">50/50 Auto-Distribution</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <span className="font-medium">Install Fee Processing</span>
            <Badge className="bg-blue-600">$6/install (3 days)</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <span className="font-medium">Daily Developer Revenue</span>
            <Badge className="bg-green-600">$1/day after day 3</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}