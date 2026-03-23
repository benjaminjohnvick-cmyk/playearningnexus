import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import EnhancedPayoutDashboard from '../components/payout/EnhancedPayoutDashboard';
import CampaignAutomation from '../components/automation/CampaignAutomation';
import AutomatedFollowUps from '../components/automation/AutomatedFollowUps';
import PayoutTaxDocs from '../components/payout/PayoutTaxDocs';
import PendingPayoutSchedule from '../components/payout/PendingPayoutSchedule';
import TierAdvancement from '../components/referral/TierAdvancement';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Users,
  Trophy
} from 'lucide-react';
import { format } from 'date-fns';
import PayoutReceiptDownloader from '@/components/payout/PayoutReceiptDownloader';
import EarningsBreakdownPanel from '@/components/payout/EarningsBreakdownPanel';

export default function PayoutHistory() {
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

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['payouts', user?.id],
    queryFn: () => base44.entities.ReferralPayout.filter({ user_id: user.id }, '-created_date'),
    enabled: !!user
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: lifetimeValues = [] } = useQuery({
    queryKey: ['lifetimeValues', user?.id],
    queryFn: () => base44.entities.ReferralLifetimeValue.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: tierRecord } = useQuery({
    queryKey: ['userTier', user?.id],
    queryFn: async () => {
      const records = await base44.entities.PPCUserTier.filter({ user_id: user.id });
      return records[0] || null;
    },
    enabled: !!user
  });

  // Fetch all transactions for earnings breakdown
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions-breakdown', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 200),
    enabled: !!user
  });

  // Fetch Payout entity (the real payout records from processScheduledPayouts)
  const { data: realPayouts = [] } = useQuery({
    queryKey: ['real-payouts', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 100),
    enabled: !!user
  });

  const totalEarnings = payouts.reduce((sum, p) => sum + (p.net_amount || 0), 0);
  const pendingAmount = payouts
    .filter(p => p.status === 'pending' || p.status === 'scheduled')
    .reduce((sum, p) => sum + (p.net_amount || 0), 0);
  const completedPayouts = payouts.filter(p => p.status === 'completed').length;
  const totalReferrals = referrals.length;
  const userReferrals = referrals.filter(r => r.referral_type === 'user').length;
  const businessReferrals = referrals.filter(r => r.referral_type === 'business').length;
  const totalLifetimeValue = lifetimeValues.reduce((sum, ltv) => sum + (ltv.total_value || 0), 0);

  const statusConfig = {
    pending: { icon: Clock, color: 'bg-amber-100 text-amber-800', label: 'Pending' },
    scheduled: { icon: Calendar, color: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
    processing: { icon: TrendingUp, color: 'bg-purple-100 text-purple-800', label: 'Processing' },
    completed: { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Completed' },
    failed: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Failed' },
    cancelled: { icon: AlertCircle, color: 'bg-gray-100 text-gray-800', label: 'Cancelled' }
  };



  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Payout Management</h1>
          <p className="text-gray-600">Track earnings, manage payouts, and optimize your referrals</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Earnings', value: `$${totalEarnings.toFixed(2)}`, sub: `${completedPayouts} completed`, color: 'text-green-600' },
            { label: 'Pending', value: `$${pendingAmount.toFixed(2)}`, sub: 'Scheduled for payment', color: 'text-amber-600' },
            { label: 'Total Referrals', value: totalReferrals, sub: `${userReferrals} users · ${businessReferrals} biz`, color: 'text-blue-600' },
            { label: 'Lifetime Value', value: `$${totalLifetimeValue.toFixed(2)}`, sub: 'From all referrals', color: 'text-purple-600' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-md">
              <CardContent className="p-5">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="history">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="history" className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> History
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Breakdown
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Schedule
            </TabsTrigger>
            <TabsTrigger value="tax" className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Tax Docs
            </TabsTrigger>
            <TabsTrigger value="tiers" className="flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> Tiers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="breakdown" className="mt-4">
            <EarningsBreakdownPanel transactions={transactions} />
          </TabsContent>

          <TabsContent value="schedule" className="mt-4">
            <div className="grid md:grid-cols-2 gap-6">
              <PendingPayoutSchedule pendingPayouts={payouts.filter(p => p.status === 'pending' || p.status === 'scheduled')} />
              <EnhancedPayoutDashboard user={user} />
            </div>
          </TabsContent>

          <TabsContent value="tax" className="mt-4">
            <div className="max-w-2xl">
              <PayoutTaxDocs user={user} payouts={payouts} />
            </div>
          </TabsContent>

          <TabsContent value="tiers" className="mt-4">
            <div className="max-w-2xl">
              <TierAdvancement
                currentTier={tierRecord?.current_tier || 1}
                activeReferrals={referrals.filter(r => r.status === 'active').length}
                totalCommission={totalEarnings}
                tier2Days={tierRecord?.tier2_days_active || 0}
              />
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-6">
            {/* Real payouts from processScheduledPayouts */}
            {realPayouts.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" /> Processed Payouts
                  </CardTitle>
                  <CardDescription>Scheduled and manual payout requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {realPayouts.map(p => {
                      const StatusIcon = statusConfig[p.status]?.icon || Clock;
                      return (
                        <div key={p.id} className="flex items-center justify-between border rounded-lg p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${p.status === 'completed' ? 'bg-green-100' : p.status === 'failed' ? 'bg-red-100' : 'bg-amber-100'}`}>
                              <StatusIcon className={`w-4 h-4 ${p.status === 'completed' ? 'text-green-600' : p.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">${(p.amount || 0).toFixed(2)} via {(p.method || 'paypal').toUpperCase()}</p>
                              <p className="text-xs text-gray-500">{p.description || 'Payout'}</p>
                              <p className="text-xs text-gray-400">{p.created_date ? format(new Date(p.created_date), 'MMM dd, yyyy') : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusConfig[p.status]?.color || ''}>{statusConfig[p.status]?.label || p.status}</Badge>
                            <PayoutReceiptDownloader payout={p} user={user} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>Detailed breakdown of all your referral payments</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12 text-gray-500">Loading payout history...</div>
                ) : payouts.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No payouts yet</p>
                    <p className="text-sm text-gray-400">Start referring to earn your first payout!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {payouts.map((payout) => {
                      const StatusIcon = statusConfig[payout.status]?.icon || Clock;
                      return (
                        <div key={payout.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  ${payout.net_amount.toFixed(2)}
                                </h3>
                                <Badge className={statusConfig[payout.status]?.color || ''}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusConfig[payout.status]?.label || payout.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-500">
                                {format(new Date(payout.period_start), 'MMM dd, yyyy')} - {format(new Date(payout.period_end), 'MMM dd, yyyy')}
                              </p>
                              {payout.invoice_number && (
                                <p className="text-xs text-gray-400 mt-1">Invoice: {payout.invoice_number}</p>
                              )}
                            </div>
                            <PayoutReceiptDownloader payout={payout} user={user} />
                          </div>

                          <div className="grid md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">User Referrals</p>
                              <p className="text-2xl font-semibold text-gray-900">{payout.user_referrals}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">Business Referrals</p>
                              <p className="text-2xl font-semibold text-gray-900">{payout.business_referrals}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">Total Referrals</p>
                              <p className="text-2xl font-semibold text-gray-900">{payout.total_referrals}</p>
                            </div>
                          </div>

                          <div className="border-t pt-4">
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Gross Amount:</span>
                                  <span className="font-medium">${payout.gross_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-red-600">
                                  <span>Platform Fee:</span>
                                  <span>-${payout.platform_fee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-red-600">
                                  <span>Tax Withheld:</span>
                                  <span>-${payout.tax_withheld.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t">
                                  <span>Net Payout:</span>
                                  <span>${payout.net_amount.toFixed(2)}</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <FileText className="w-4 h-4" />
                                  <span className="capitalize">{payout.payout_method?.replace('_', ' ')}</span>
                                </div>
                                {payout.scheduled_date && (
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <Calendar className="w-4 h-4" />
                                    <span>Scheduled: {format(new Date(payout.scheduled_date), 'MMM dd, yyyy')}</span>
                                  </div>
                                )}
                                {payout.paid_date && (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Paid: {format(new Date(payout.paid_date), 'MMM dd, yyyy')}</span>
                                  </div>
                                )}
                                {payout.transaction_id && (
                                  <p className="text-xs text-gray-400">TX: {payout.transaction_id}</p>
                                )}
                                {payout.failure_reason && (
                                  <p className="text-xs text-red-600">{payout.failure_reason}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}