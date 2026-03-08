import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, Clock, CheckCircle2, XCircle, AlertCircle,
  Loader2, Send, ArrowDownCircle, RefreshCw, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const MIN_WITHDRAWAL = 10;

const statusConfig = {
  pending:    { icon: Clock,        color: 'bg-amber-100 text-amber-800',  label: 'Pending',    dot: 'bg-amber-400' },
  processing: { icon: RefreshCw,    color: 'bg-blue-100 text-blue-800',    label: 'Processing', dot: 'bg-blue-400' },
  completed:  { icon: CheckCircle2, color: 'bg-green-100 text-green-800',  label: 'Approved',   dot: 'bg-green-500' },
  failed:     { icon: XCircle,      color: 'bg-red-100 text-red-800',      label: 'Rejected',   dot: 'bg-red-500' },
};

export default function Withdrawal() {
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setPaypalEmail(u.email || ''); }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['withdrawal-history', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user
  });

  const balance = user?.current_balance || 0;
  const pendingTotal = payouts.filter(p => p.status === 'pending' || p.status === 'processing').reduce((s, p) => s + (p.amount || 0), 0);
  const approvedTotal = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < MIN_WITHDRAWAL) return toast.error(`Minimum withdrawal is $${MIN_WITHDRAWAL}`);
    if (amt > balance) return toast.error('Amount exceeds your available balance');
    if (!paypalEmail || !paypalEmail.includes('@')) return toast.error('Please enter a valid PayPal email');

    setSubmitting(true);
    try {
      await base44.entities.Payout.create({
        user_id: user.id,
        recipient_type: 'user',
        recipient_id: user.id,
        recipient_email: paypalEmail,
        amount: amt,
        currency: 'USD',
        method: 'paypal',
        payout_type: 'manual',
        status: 'pending',
        description: `PayPal withdrawal request for $${amt.toFixed(2)}`
      });
      // Deduct from balance
      await base44.auth.updateMe({ current_balance: Math.max(0, balance - amt) });
      const updated = await base44.auth.me();
      setUser(updated);
      queryClient.invalidateQueries(['withdrawal-history', user.id]);
      setAmount('');
      toast.success(`Withdrawal request for $${amt.toFixed(2)} submitted! Processing within 3-5 business days.`);
    } catch (e) {
      toast.error('Failed to submit withdrawal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-green-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <ArrowDownCircle className="w-9 h-9 text-green-600" /> Withdrawal
          </h1>
          <p className="text-gray-500 mt-1">Request a PayPal payout from your earned balance</p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-5">
              <p className="text-sm text-green-700 font-medium">Available Balance</p>
              <p className="text-3xl font-bold text-green-600">${balance.toFixed(2)}</p>
              <p className="text-xs text-green-500 mt-1">Ready to withdraw</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-amber-300 bg-amber-50">
            <CardContent className="p-5">
              <p className="text-sm text-amber-700 font-medium">Pending Withdrawals</p>
              <p className="text-3xl font-bold text-amber-600">${pendingTotal.toFixed(2)}</p>
              <p className="text-xs text-amber-500 mt-1">Being processed</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardContent className="p-5">
              <p className="text-sm text-blue-700 font-medium">Total Withdrawn</p>
              <p className="text-3xl font-bold text-blue-600">${approvedTotal.toFixed(2)}</p>
              <p className="text-xs text-blue-500 mt-1">Successfully paid</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="withdraw">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="withdraw">Request Withdrawal</TabsTrigger>
            <TabsTrigger value="history">Transaction History</TabsTrigger>
          </TabsList>

          {/* Withdraw Form */}
          <TabsContent value="withdraw" className="space-y-4 mt-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" /> Request PayPal Payout
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">PayPal Email</label>
                  <Input
                    type="email"
                    placeholder="your@paypal.com"
                    value={paypalEmail}
                    onChange={e => setPaypalEmail(e.target.value)}
                    className="border-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                    <Input
                      type="number"
                      placeholder={`Min $${MIN_WITHDRAWAL}`}
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="pl-7 border-2 text-lg"
                      min={MIN_WITHDRAWAL}
                      max={balance}
                      step="0.01"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Minimum: ${MIN_WITHDRAWAL}</span>
                    <span>Available: ${balance.toFixed(2)}</span>
                  </div>
                </div>

                {/* Quick amount buttons */}
                <div className="flex gap-2 flex-wrap">
                  {[10, 25, 50, 100].map(amt => (
                    <Button key={amt} variant="outline" size="sm"
                      onClick={() => setAmount(Math.min(amt, balance).toString())}
                      disabled={balance < amt}
                      className="border-green-300 text-green-700 hover:bg-green-50">
                      ${amt}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm"
                    onClick={() => setAmount(balance.toFixed(2))}
                    disabled={balance < MIN_WITHDRAWAL}
                    className="border-green-300 text-green-700 hover:bg-green-50">
                    Max
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-sm text-blue-700">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Withdrawals are processed within 3–5 business days. You'll receive an email confirmation once approved.</span>
                </div>

                <Button
                  onClick={handleWithdraw}
                  disabled={submitting || !amount || parseFloat(amount) < MIN_WITHDRAWAL || parseFloat(amount) > balance}
                  className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><Send className="w-5 h-5 mr-2" /> Request Withdrawal</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transaction History */}
          <TabsContent value="history" className="mt-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-500" /> Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div>
                ) : payouts.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No withdrawals yet</p>
                    <p className="text-sm text-gray-400 mt-1">Submit your first withdrawal request above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Filter summary */}
                    <div className="flex gap-3 text-xs flex-wrap mb-2">
                      {['pending', 'processing', 'completed', 'failed'].map(s => {
                        const count = payouts.filter(p => p.status === s).length;
                        if (!count) return null;
                        const cfg = statusConfig[s];
                        return (
                          <span key={s} className={`px-2 py-1 rounded-full ${cfg.color} font-medium`}>
                            {cfg.label}: {count}
                          </span>
                        );
                      })}
                    </div>

                    {payouts.map((payout) => {
                      const cfg = statusConfig[payout.status] || statusConfig.pending;
                      const StatusIcon = cfg.icon;
                      return (
                        <div key={payout.id} className="flex items-center justify-between border-2 border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.color.split(' ')[0]}`}>
                              <StatusIcon className={`w-5 h-5 ${cfg.color.split(' ')[1]}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">${(payout.amount || 0).toFixed(2)} via PayPal</p>
                              <p className="text-xs text-gray-400">
                                {payout.recipient_email && <span>{payout.recipient_email} · </span>}
                                {payout.created_date ? format(new Date(payout.created_date), 'MMM d, yyyy h:mm a') : 'Unknown date'}
                              </p>
                              {payout.description && <p className="text-xs text-gray-400 mt-0.5">{payout.description}</p>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Badge className={cfg.color}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1.5 inline-block`}></span>
                              {cfg.label}
                            </Badge>
                            {payout.external_transaction_id && (
                              <p className="text-xs text-gray-400 mt-1">TX: {payout.external_transaction_id.slice(0, 12)}…</p>
                            )}
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