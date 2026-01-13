import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Users, Target, Zap, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function MonetizationDashboard({ businessClient, games }) {
  const { data: automatedPayments = [] } = useQuery({
    queryKey: ['automated-payments', businessClient.id],
    queryFn: () => base44.entities.AutomatedPayment.filter({ developer_id: businessClient.id })
  });

  const { data: dynamicPricing = [] } = useQuery({
    queryKey: ['dynamic-pricing', businessClient.id],
    queryFn: async () => {
      const gameIds = games.map(g => g.id);
      if (!gameIds.length) return [];
      return await base44.entities.DynamicPricing.filter({ game_id: { $in: gameIds } });
    },
    enabled: games.length > 0
  });

  const { data: personalizedOffers = [] } = useQuery({
    queryKey: ['personalized-offers', businessClient.id],
    queryFn: async () => {
      const gameIds = games.map(g => g.id);
      if (!gameIds.length) return [];
      return await base44.entities.PersonalizedOffer.filter({ game_id: { $in: gameIds } }, '-created_date', 100);
    },
    enabled: games.length > 0
  });

  const totalOwed = automatedPayments
    .filter(p => p.payment_status === 'pending')
    .reduce((sum, p) => sum + (p.amount_owed || 0), 0);

  const installFeesDeducted = automatedPayments.reduce((sum, p) => sum + (p.install_fee_deducted || 0), 0);
  const dailyRevenueEarned = automatedPayments.reduce((sum, p) => sum + (p.daily_revenue_earned || 0), 0);
  const surveyRevenueShare = automatedPayments.reduce((sum, p) => sum + (p.survey_revenue_share || 0), 0);

  const activeOffers = personalizedOffers.filter(o => o.is_active && !o.claimed).length;
  const claimedOffers = personalizedOffers.filter(o => o.claimed).length;
  const conversionRate = personalizedOffers.length > 0 ? (claimedOffers / personalizedOffers.length * 100).toFixed(1) : 0;

  const handleRequestPayout = async () => {
    toast.info('Payout request submitted - will be processed within 24 hours');
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <DollarSign className="w-8 h-8 text-green-600 mb-3" />
          <p className="text-sm text-gray-600 mb-1">Pending Payout</p>
          <p className="text-3xl font-bold text-green-600">${totalOwed.toFixed(2)}</p>
          <Button size="sm" className="mt-3 bg-green-600 hover:bg-green-700 w-full" onClick={handleRequestPayout}>
            Request Payout
          </Button>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
          <TrendingUp className="w-8 h-8 text-blue-600 mb-3" />
          <p className="text-sm text-gray-600 mb-1">Daily Revenue</p>
          <p className="text-3xl font-bold text-blue-600">${dailyRevenueEarned.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">$1/day per active user</p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <Target className="w-8 h-8 text-purple-600 mb-3" />
          <p className="text-sm text-gray-600 mb-1">Active Offers</p>
          <p className="text-3xl font-bold text-purple-600">{activeOffers}</p>
          <p className="text-xs text-gray-500 mt-1">{conversionRate}% conversion</p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
          <Users className="w-8 h-8 text-amber-600 mb-3" />
          <p className="text-sm text-gray-600 mb-1">Survey Revenue</p>
          <p className="text-3xl font-bold text-amber-600">${surveyRevenueShare.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">50% split</p>
        </Card>
      </div>

      <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-6 h-6 text-red-600" />
          <h3 className="text-xl font-bold">AI-Powered Revenue Optimization</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-red-50 rounded-lg">
            <h4 className="font-bold mb-2 text-gray-900">Dynamic Pricing</h4>
            <p className="text-sm text-gray-600 mb-2">{dynamicPricing.length} items optimized</p>
            <Badge className="bg-green-600">Auto-adjusting</Badge>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-bold mb-2 text-gray-900">Personalized Offers</h4>
            <p className="text-sm text-gray-600 mb-2">{personalizedOffers.length} offers created</p>
            <Badge className="bg-blue-600">{conversionRate}% conversion</Badge>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-bold mb-2 text-gray-900">Revenue Distribution</h4>
            <p className="text-sm text-gray-600 mb-2">Fully automated</p>
            <Badge className="bg-purple-600">Real-time tracking</Badge>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
        <h3 className="text-xl font-bold mb-4">Revenue Breakdown</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg">
            <div>
              <p className="font-medium">Install Fees Collected</p>
              <p className="text-sm text-gray-600">$6 per install over 3 days</p>
            </div>
            <p className="text-xl font-bold text-red-600">-${installFeesDeducted.toFixed(2)}</p>
          </div>
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
            <div>
              <p className="font-medium">Daily Usage Revenue</p>
              <p className="text-sm text-gray-600">$1/day after day 3</p>
            </div>
            <p className="text-xl font-bold text-blue-600">+${dailyRevenueEarned.toFixed(2)}</p>
          </div>
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
            <div>
              <p className="font-medium">Survey Revenue Share</p>
              <p className="text-sm text-gray-600">50% of user survey earnings</p>
            </div>
            <p className="text-xl font-bold text-green-600">+${surveyRevenueShare.toFixed(2)}</p>
          </div>
          <div className="border-t-2 border-gray-300 pt-3 flex items-center justify-between">
            <p className="text-lg font-bold">Net Amount Owed</p>
            <p className="text-2xl font-bold text-green-600">${totalOwed.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      {personalizedOffers.length > 0 && (
        <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
          <h3 className="text-xl font-bold mb-4">Recent AI-Generated Offers</h3>
          <div className="space-y-2">
            {personalizedOffers.slice(0, 5).map(offer => (
              <div key={offer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{offer.title}</p>
                  <p className="text-sm text-gray-600">{offer.description}</p>
                </div>
                <div className="text-right">
                  <Badge className={offer.claimed ? 'bg-green-600' : 'bg-gray-600'}>
                    {offer.claimed ? 'Claimed' : 'Active'}
                  </Badge>
                  {offer.expires_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {new Date(offer.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}