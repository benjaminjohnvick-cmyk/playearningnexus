import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, Send, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DeveloperPayoutDashboard() {
  const [user, setUser] = useState(null);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  // Fetch payouts
  const { data: payouts = [] } = useQuery({
    queryKey: ['developerPayouts', user?.id],
    queryFn: async () => {
      const result = await base44.entities.DeveloperPayout.filter({
        developer_id: user.id
      });
      return result.sort((a, b) => new Date(b.period_end) - new Date(a.period_end));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5
  });

  // Fetch withdrawal requests
  const { data: withdrawals = [] } = useQuery({
    queryKey: ['withdrawalRequests', user?.id],
    queryFn: async () => {
      const result = await base44.entities.WithdrawalRequest.filter({
        developer_id: user.id
      });
      return result.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5
  });

  // Calculate available balance
  const processedPayouts = payouts.filter(p => p.status === 'processed');
  const totalEarned = processedPayouts.reduce((sum, p) => sum + (p.net_payout_amount || 0), 0);
  const totalWithdrawn = withdrawals
    .filter(w => w.status === 'completed')
    .reduce((sum, w) => sum + (w.amount || 0), 0);
  const availableBalance = totalEarned - totalWithdrawn;

  const totalAdCredits = payouts.reduce((sum, p) => sum + (p.advertising_credit_earned || 0), 0);
  const totalAdUsed = payouts.reduce((sum, p) => sum + (p.advertising_credit_used || 0), 0);

  // Withdrawal mutation
  const withdrawalMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('processWithdrawalRequest', {
        amount: parseFloat(withdrawAmount),
        payment_method: paymentMethod
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalRequests'] });
      setWithdrawAmount('');
      setShowWithdrawForm(false);
    }
  });

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    processing: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700'
  };

  const statusIcon = {
    pending: Clock,
    approved: CheckCircle,
    completed: CheckCircle,
    failed: AlertCircle
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Developer Payout Dashboard</h1>
          <p className="text-slate-600">Manage earnings, track payouts, and request withdrawals</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Available Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700">${availableBalance.toFixed(2)}</div>
              <p className="text-xs text-slate-500 mt-1">Ready to withdraw</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Total Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">${totalEarned.toFixed(2)}</div>
              <p className="text-xs text-slate-500 mt-1">All-time (processed)</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-purple-600" />
                Ad Credits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-700">${(totalAdCredits - totalAdUsed).toFixed(2)}</div>
              <p className="text-xs text-slate-500 mt-1">Available credits</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Send className="w-4 h-4 text-orange-600" />
                Total Withdrawn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-700">${totalWithdrawn.toFixed(2)}</div>
              <p className="text-xs text-slate-500 mt-1">Completed withdrawals</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="payouts" className="mb-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="payouts">Payout History</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="breakdown">Revenue Breakdown</TabsTrigger>
          </TabsList>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payouts.length === 0 ? (
                    <p className="text-slate-500 text-sm">No payouts yet</p>
                  ) : (
                    payouts.map(payout => (
                      <div key={payout.id} className="p-4 border rounded-lg hover:bg-slate-50 transition">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">
                              {new Date(payout.period_start).toLocaleDateString()} - {new Date(payout.period_end).toLocaleDateString()}
                            </p>
                            <div className="flex gap-3 mt-2 text-sm text-slate-600">
                              <span>Revenue: <span className="font-semibold text-slate-900">${(payout.total_revenue || 0).toFixed(2)}</span></span>
                              <span>Your Share (50%): <span className="font-semibold text-green-700">${(payout.developer_share_50_percent || 0).toFixed(2)}</span></span>
                            </div>
                          </div>
                          <Badge className={statusColor[payout.status]}>
                            {payout.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Withdrawal Requests</CardTitle>
                <Button
                  onClick={() => setShowWithdrawForm(!showWithdrawForm)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Request Withdrawal
                </Button>
              </CardHeader>
              <CardContent>
                {showWithdrawForm && (
                  <div className="p-4 mb-6 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold mb-3 text-slate-900">Request Withdrawal</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Amount (USD)</label>
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.00"
                          max={availableBalance}
                          className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-slate-500 mt-1">Available: ${availableBalance.toFixed(2)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Payment Method</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="paypal">PayPal</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="stripe">Stripe</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => withdrawalMutation.mutate()}
                          disabled={!withdrawAmount || parseFloat(withdrawAmount) > availableBalance || withdrawalMutation.isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {withdrawalMutation.isPending ? 'Processing...' : 'Submit Request'}
                        </Button>
                        <Button variant="outline" onClick={() => setShowWithdrawForm(false)} className="flex-1">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {withdrawals.length === 0 ? (
                    <p className="text-slate-500 text-sm">No withdrawal requests yet</p>
                  ) : (
                    withdrawals.map(withdrawal => {
                      const StatusIcon = statusIcon[withdrawal.status] || Clock;
                      return (
                        <div key={withdrawal.id} className="p-4 border rounded-lg hover:bg-slate-50 transition">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <StatusIcon className="w-4 h-4 text-slate-600" />
                                <p className="font-semibold text-slate-900">${withdrawal.amount.toFixed(2)}</p>
                              </div>
                              <p className="text-sm text-slate-600">
                                {withdrawal.payment_method} · Requested {new Date(withdrawal.requested_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge className={statusColor[withdrawal.status]}>
                              {withdrawal.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Breakdown Tab */}
          <TabsContent value="breakdown">
            <Card>
              <CardHeader>
                <CardTitle>50/50 Revenue Split Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {payouts.length === 0 ? (
                    <p className="text-slate-500 text-sm">No payout data available</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="font-semibold text-slate-900 mb-4">Split Summary</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Total Platform Revenue</span>
                              <span className="font-semibold">${payouts.reduce((sum, p) => sum + (p.total_revenue || 0), 0).toFixed(2)}</span>
                            </div>
                            <div className="border-t pt-3">
                              <div className="flex justify-between items-center text-green-700">
                                <span>Your 50% Share</span>
                                <span className="font-bold text-lg">${payouts.reduce((sum, p) => sum + (p.developer_share_50_percent || 0), 0).toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                              <span>Platform 50% Share</span>
                              <span className="font-semibold">${payouts.reduce((sum, p) => sum + (p.developer_share_50_percent || 0), 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-semibold text-slate-900 mb-4">Advertising Credits</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Credits Earned</span>
                              <span className="font-semibold text-purple-700">${totalAdCredits.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Credits Used</span>
                              <span className="font-semibold text-orange-700">${totalAdUsed.toFixed(2)}</span>
                            </div>
                            <div className="border-t pt-3">
                              <div className="flex justify-between items-center">
                                <span>Available Credits</span>
                                <span className="font-bold text-lg text-purple-700">${(totalAdCredits - totalAdUsed).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {payouts.length > 1 && (
                        <div className="mt-6">
                          <h3 className="font-semibold text-slate-900 mb-4">Earnings Trend</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={payouts.reverse()}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="period_end"
                                tickFormatter={(date) => new Date(date).toLocaleDateString()}
                              />
                              <YAxis />
                              <Tooltip
                                formatter={(value) => `$${value.toFixed(2)}`}
                                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                              />
                              <Line
                                type="monotone"
                                dataKey="developer_share_50_percent"
                                stroke="#16a34a"
                                name="Your Share"
                                strokeWidth={2}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}