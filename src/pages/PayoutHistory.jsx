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
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Users,
  Building2,
  Trophy
} from 'lucide-react';
import { format } from 'date-fns';

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

  // Calculate stats
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

  const downloadReport = (payout) => {
    const report = `
PAYOUT REPORT
Invoice: ${payout.invoice_number || 'N/A'}
Period: ${format(new Date(payout.period_start), 'MMM dd, yyyy')} - ${format(new Date(payout.period_end), 'MMM dd, yyyy')}

REFERRAL BREAKDOWN:
- User Referrals: ${payout.user_referrals}
- Business Referrals: ${payout.business_referrals}
- Total Referrals: ${payout.total_referrals}

EARNINGS:
Gross Amount: $${payout.gross_amount.toFixed(2)}
Platform Fee: -$${payout.platform_fee.toFixed(2)}
Tax Withheld: -$${payout.tax_withheld.toFixed(2)}
Net Payout: $${payout.net_amount.toFixed(2)}

Payment Method: ${payout.payout_method}
Status: ${payout.status}
${payout.paid_date ? `Paid: ${format(new Date(payout.paid_date), 'MMM dd, yyyy HH:mm')}` : ''}
${payout.transaction_id ? `Transaction ID: ${payout.transaction_id}` : ''}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-${payout.invoice_number || payout.id}.txt`;
    a.click();
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

        <EnhancedPayoutDashboard user={user} />
        
        <div className="grid lg:grid-cols-2 gap-6">
          <CampaignAutomation user={user} />
          <AutomatedFollowUps user={user} />
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Detailed Payout History</h2>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">${totalEarnings.toFixed(2)}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{completedPayouts} completed payouts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Pending Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-amber-600">${pendingAmount.toFixed(2)}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Scheduled for payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Total Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{totalReferrals}</span>
              </div>
              <div className="flex gap-3 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {userReferrals}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {businessReferrals}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Lifetime Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600">${totalLifetimeValue.toFixed(2)}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">From all referrals</p>
            </CardContent>
          </Card>
        </div>

        {/* Payout History */}
        <Card>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadReport(payout)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Report
                        </Button>
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
      </div>
    </div>
  );
}