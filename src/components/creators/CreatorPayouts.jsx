import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Download, 
  Calendar, 
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function CreatorPayouts({ user }) {
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const queryClient = useQueryClient();

  // Fetch payout history
  const { data: payouts = [] } = useQuery({
    queryKey: ['creatorPayouts', user?.id],
    queryFn: () => base44.entities.CreatorPayout.filter({ creator_user_id: user.id }),
    enabled: !!user
  });

  // Calculate current period earnings
  const { data: currentEarnings } = useQuery({
    queryKey: ['currentEarnings', user?.id],
    queryFn: async () => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const tips = await base44.entities.StreamerTip.filter({ streamer_user_id: user.id });
      const recentTips = tips.filter(t => new Date(t.created_date) >= firstDay);
      const tipsAmount = recentTips.reduce((sum, tip) => 
        sum + (tip.currency === 'USD' ? tip.amount : tip.amount * 0.01), 0
      );

      const subs = await base44.entities.StreamerSubscription.filter({ 
        streamer_user_id: user.id, 
        is_active: true 
      });
      const subsAmount = subs.reduce((sum, sub) => sum + sub.price_monthly, 0);

      const sponsorships = await base44.entities.SponsoredContent.filter({ 
        creator_user_id: user.id,
        payment_status: 'paid'
      });
      const sponsoredAmount = sponsorships
        .filter(c => new Date(c.created_date) >= firstDay)
        .reduce((sum, c) => sum + c.agreed_price + (c.performance_bonus || 0), 0);

      const total = tipsAmount + subsAmount + sponsoredAmount;
      const platformFee = total * 0.05; // 5% platform fee
      const net = total - platformFee;

      return {
        tips_amount: tipsAmount,
        subscriptions_amount: subsAmount,
        sponsorships_amount: sponsoredAmount,
        total_amount: total,
        platform_fee: platformFee,
        net_amount: net
      };
    },
    enabled: !!user
  });

  // Request payout mutation
  const requestPayoutMutation = useMutation({
    mutationFn: async (paymentMethod) => {
      if (!currentEarnings || currentEarnings.net_amount < 50) {
        throw new Error('Minimum payout is $50');
      }

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      
      return await base44.entities.CreatorPayout.create({
        creator_user_id: user.id,
        period_start: firstDay.toISOString().split('T')[0],
        period_end: now.toISOString().split('T')[0],
        tips_amount: currentEarnings.tips_amount,
        subscriptions_amount: currentEarnings.subscriptions_amount,
        sponsorships_amount: currentEarnings.sponsorships_amount,
        total_amount: currentEarnings.total_amount,
        platform_fee: currentEarnings.platform_fee,
        net_amount: currentEarnings.net_amount,
        payment_method: paymentMethod,
        status: 'pending'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['creatorPayouts']);
      queryClient.invalidateQueries(['currentEarnings']);
      toast.success('Payout requested successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to request payout');
    }
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const downloadReport = (payout) => {
    const report = `
CREATOR EARNINGS REPORT
Period: ${new Date(payout.period_start).toLocaleDateString()} - ${new Date(payout.period_end).toLocaleDateString()}

EARNINGS BREAKDOWN:
Tips: $${payout.tips_amount.toFixed(2)}
Subscriptions: $${payout.subscriptions_amount.toFixed(2)}
Sponsorships: $${payout.sponsorships_amount.toFixed(2)}

Subtotal: $${payout.total_amount.toFixed(2)}
Platform Fee (5%): -$${payout.platform_fee.toFixed(2)}

NET PAYOUT: $${payout.net_amount.toFixed(2)}

Payment Method: ${payout.payment_method}
Status: ${payout.status}
Transaction ID: ${payout.transaction_id || 'N/A'}
    `;
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-report-${payout.period_start}.txt`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Current Period Card */}
      <Card className="border-2 border-green-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Current Period Earnings
            </span>
            <Badge className="bg-green-600">Active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentEarnings && (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Tips</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${currentEarnings.tips_amount.toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Subscriptions</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${currentEarnings.subscriptions_amount.toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-4 bg-pink-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Sponsorships</p>
                  <p className="text-2xl font-bold text-pink-600">
                    ${currentEarnings.sponsorships_amount.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <span>Subtotal</span>
                  <span className="font-bold">${currentEarnings.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2 text-red-600">
                  <span>Platform Fee (5%)</span>
                  <span>-${currentEarnings.platform_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Net Amount</span>
                  <span className="text-green-600">${currentEarnings.net_amount.toFixed(2)}</span>
                </div>
              </div>

              {currentEarnings.net_amount >= 50 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Select payment method:</p>
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-blue-600"
                      onClick={() => requestPayoutMutation.mutate('paypal')}
                      disabled={requestPayoutMutation.isPending}
                    >
                      PayPal
                    </Button>
                    <Button 
                      className="flex-1 bg-purple-600"
                      onClick={() => requestPayoutMutation.mutate('stripe')}
                      disabled={requestPayoutMutation.isPending}
                    >
                      Stripe
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 text-center">
                  Minimum payout is $50. Current: ${currentEarnings.net_amount.toFixed(2)}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Payout History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payouts.length === 0 ? (
              <p className="text-center text-gray-600 py-8">No payouts yet</p>
            ) : (
              payouts.map((payout) => (
                <Card key={payout.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold">
                            {new Date(payout.period_start).toLocaleDateString()} - {new Date(payout.period_end).toLocaleDateString()}
                          </p>
                          {getStatusIcon(payout.status)}
                          <Badge variant={
                            payout.status === 'completed' ? 'default' : 
                            payout.status === 'failed' ? 'destructive' : 
                            'secondary'
                          }>
                            {payout.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">via {payout.payment_method}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          ${payout.net_amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Total: ${payout.total_amount.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-600">Tips</p>
                        <p className="font-medium">${payout.tips_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Subscriptions</p>
                        <p className="font-medium">${payout.subscriptions_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Sponsorships</p>
                        <p className="font-medium">${payout.sponsorships_amount.toFixed(2)}</p>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => downloadReport(payout)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Report
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}