import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Clock, DollarSign, FileText, Zap, TrendingUp } from 'lucide-react';

const STATUS_COLORS = {
  pending_validation: 'bg-yellow-100 text-yellow-800',
  pending_tax_form: 'bg-orange-100 text-orange-800',
  pending_payment: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-800'
};

const STATUS_ICONS = {
  pending_validation: Clock,
  pending_tax_form: FileText,
  pending_payment: DollarSign,
  processing: Zap,
  completed: CheckCircle,
  failed: AlertCircle,
  cancelled: AlertCircle
};

export default function AffiliatePayoutManager() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [processing, setProcessing] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['payouts', selectedMonth],
    queryFn: async () => {
      if (user?.role === 'admin') {
        return base44.asServiceRole.entities.PayoutRequest.filter({ payout_month: selectedMonth }, '-created_date', 100);
      } else {
        return base44.entities.PayoutRequest.filter({ affiliate_user_id: user.id, payout_month: selectedMonth }, '-created_date', 20);
      }
    },
    enabled: !!user
  });

  const { data: stats } = useQuery({
    queryKey: ['payoutStats', selectedMonth],
    queryFn: async () => {
      const monthPayouts = payouts;
      return {
        total_payouts: monthPayouts.length,
        total_earnings: monthPayouts.reduce((sum, p) => sum + (p.gross_earnings || 0), 0),
        total_processed: monthPayouts.filter(p => p.status === 'completed').length,
        pending_tax: monthPayouts.filter(p => p.status === 'pending_tax_form').length,
        avg_payout: monthPayouts.length > 0
          ? monthPayouts.reduce((sum, p) => sum + (p.net_payout_amount || 0), 0) / monthPayouts.length
          : 0
      };
    },
    enabled: payouts.length > 0
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      setProcessing(true);
      try {
        const result = await base44.functions.invoke('processMonthlyAffiliatePayouts', {
          payout_month: selectedMonth,
          test_mode: false
        });
        queryClient.invalidateQueries({ queryKey: ['payouts'] });
        return result;
      } finally {
        setProcessing(false);
      }
    }
  });

  const prevMonth = () => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() - 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const nextMonth = () => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() + 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Affiliate Payout Manager</h1>
          <p className="text-slate-600">Manage Stripe/PayPal payments and tax form submissions</p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={prevMonth}>← Previous</Button>
            <h2 className="text-xl font-semibold">{new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</h2>
            <Button variant="outline" onClick={nextMonth}>Next →</Button>
          </div>
          {user?.role === 'admin' && (
            <Button className="bg-green-600" onClick={() => processMutation.mutate()} disabled={processing}>
              <Zap className="w-4 h-4 mr-2" />
              {processing ? 'Processing...' : 'Run Payout Processing'}
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Total Payouts</p>
                <p className="text-2xl font-bold">{stats.total_payouts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Total Earnings</p>
                <p className="text-2xl font-bold text-green-600">${stats.total_earnings.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Processed</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total_processed}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Pending Tax Forms</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pending_tax}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Avg Payout</p>
                <p className="text-2xl font-bold">${stats.avg_payout.toFixed(0)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payouts Table */}
        {isLoading ? (
          <div className="text-center text-slate-500 py-12">Loading payouts...</div>
        ) : payouts.length === 0 ? (
          <Card className="text-center p-12">
            <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No payouts for this month</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {payouts.map(payout => {
              const sc = STATUS_COLORS[payout.status];
              const Icon = STATUS_ICONS[payout.status];
              return (
                <Card key={payout.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="font-mono text-sm text-slate-500">{payout.affiliate_email}</span>
                          <Badge className={sc}><Icon className="w-3 h-3 mr-1" />{payout.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500">Referrals:</span>
                            <p className="font-medium">{payout.referral_count}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Conversions:</span>
                            <p className="font-medium">{payout.conversion_count}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Tax Form:</span>
                            <p className="font-medium capitalize">{payout.tax_form_status}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Method:</span>
                            <p className="font-medium capitalize">{payout.payment_method}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500 mb-1">Net Payout</p>
                        <p className="text-2xl font-bold text-green-600">${payout.net_payout_amount || 0}</p>
                        {payout.transaction_id && (
                          <p className="text-xs text-slate-500 mt-1">TXN: {payout.transaction_id.slice(-8)}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}