import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, Clock, CheckCircle2, XCircle, AlertCircle,
  Loader2, Send, ArrowDownCircle, RefreshCw, Info,
  CreditCard, Wallet, Copy, ChevronDown, ChevronUp, Shield,
  TrendingUp, Star, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const MIN_WITHDRAWAL = 10;
const FULL_ELIGIBILITY_AMOUNT = 50; // $50 = 100% eligible

const PAYOUT_METHODS = [
  { id: 'paypal',   label: 'PayPal',         icon: '🅿️', field: 'paypal_email',   placeholder: 'your@paypal.com',         type: 'email' },
  { id: 'venmo',    label: 'Venmo',          icon: '💙', field: 'venmo_username', placeholder: '@username',               type: 'text' },
  { id: 'cashapp',  label: 'Cash App',       icon: '💚', field: 'cashapp_username',placeholder: '$cashtag',               type: 'text' },
  { id: 'bank',     label: 'Bank Transfer',  icon: '🏦', field: 'bank_account_number', placeholder: 'Account number',    type: 'text' },
];

const statusConfig = {
  pending:    { icon: Clock,        color: 'bg-amber-100 text-amber-800',  label: 'Pending',    dot: 'bg-amber-400',  bar: 'bg-amber-400' },
  processing: { icon: RefreshCw,    color: 'bg-blue-100 text-blue-800',    label: 'Processing', dot: 'bg-blue-400',   bar: 'bg-blue-500' },
  completed:  { icon: CheckCircle2, color: 'bg-green-100 text-green-800',  label: 'Completed',  dot: 'bg-green-500',  bar: 'bg-green-500' },
  failed:     { icon: XCircle,      color: 'bg-red-100 text-red-800',      label: 'Failed',     dot: 'bg-red-500',    bar: 'bg-red-500' },
};

function EligibilityBar({ balance }) {
  const pct = Math.min(100, (balance / FULL_ELIGIBILITY_AMOUNT) * 100);
  const tier = balance >= FULL_ELIGIBILITY_AMOUNT ? 'Instant Payout'
    : balance >= 25 ? 'Standard Payout'
    : balance >= MIN_WITHDRAWAL ? 'Eligible'
    : 'Not Yet Eligible';
  const tierColor = balance >= FULL_ELIGIBILITY_AMOUNT ? 'text-green-600'
    : balance >= 25 ? 'text-blue-600'
    : balance >= MIN_WITHDRAWAL ? 'text-amber-600'
    : 'text-red-500';

  const milestones = [
    { pct: 20, label: `$${MIN_WITHDRAWAL}`, sub: 'Min' },
    { pct: 50, label: '$25',  sub: 'Standard' },
    { pct: 100, label: `$${FULL_ELIGIBILITY_AMOUNT}`, sub: 'Instant' },
  ];

  return (
    <Card className="border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-gray-900">Payout Eligibility</span>
          </div>
          <span className={`font-bold text-sm ${tierColor}`}>{tier}</span>
        </div>

        <div className="relative mb-1">
          <Progress value={pct} className="h-4 bg-gray-200" />
          <div
            className="absolute top-0 left-0 h-4 rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct >= 100 ? 'linear-gradient(90deg,#22c55e,#16a34a)' :
                          pct >= 50  ? 'linear-gradient(90deg,#3b82f6,#6366f1)' :
                          pct >= 20  ? 'linear-gradient(90deg,#f59e0b,#f97316)' :
                                       'linear-gradient(90deg,#ef4444,#f97316)',
            }}
          />
        </div>

        {/* Milestone markers */}
        <div className="relative h-6 mt-1">
          {milestones.map(m => (
            <div
              key={m.label}
              className="absolute top-0 text-center"
              style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className={`text-xs font-semibold ${pct >= m.pct ? tierColor : 'text-gray-400'}`}>{m.label}</div>
              <div className="text-xs text-gray-400">{m.sub}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-600">Current balance: <span className="font-bold text-gray-900">${balance.toFixed(2)}</span></span>
          {balance < FULL_ELIGIBILITY_AMOUNT && (
            <span className="text-gray-400">
              ${(FULL_ELIGIBILITY_AMOUNT - balance).toFixed(2)} more for instant payout
            </span>
          )}
          {balance >= FULL_ELIGIBILITY_AMOUNT && (
            <span className="text-green-600 font-semibold flex items-center gap-1">
              <Zap className="w-4 h-4" /> Instant payout unlocked!
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionRow({ payout }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[payout.status] || statusConfig.pending;
  const StatusIcon = cfg.icon;
  const methodLabel = PAYOUT_METHODS.find(m => m.id === payout.method)?.label || payout.method || 'PayPal';

  const confId = payout.paypal_batch_id || payout.external_transaction_id || payout.paypal_payout_item_id;

  return (
    <div className="border-2 border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors">
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color.split(' ')[0]}`}>
            <StatusIcon className={`w-5 h-5 ${cfg.color.split(' ')[1]}`} />
          </div>
          <div>
            <p className="font-semibold text-gray-800">${(payout.amount || 0).toFixed(2)} via {methodLabel}</p>
            <p className="text-xs text-gray-400">
              {payout.created_date ? format(new Date(payout.created_date), 'MMM d, yyyy · h:mm a') : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge className={cfg.color}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1.5 inline-block`} />
            {cfg.label}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Recipient</p>
              <p className="text-gray-700 font-medium truncate">{payout.recipient_email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Method</p>
              <p className="text-gray-700 font-medium">{methodLabel}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Amount</p>
              <p className="text-green-600 font-bold">${(payout.amount || 0).toFixed(2)} USD</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
              <p className={`font-medium ${payout.status === 'completed' ? 'text-green-600' : payout.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>{cfg.label}</p>
            </div>
          </div>

          {confId && (
            <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Confirmation ID</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs text-gray-700 font-mono break-all">{confId}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(confId); toast.success('Copied!'); }}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {payout.paypal_batch_id && payout.paypal_batch_id !== confId && (
            <div className="p-2 bg-white rounded-lg border border-gray-200">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Batch ID</p>
              <code className="text-xs text-gray-700 font-mono">{payout.paypal_batch_id}</code>
            </div>
          )}

          {payout.error_message && (
            <div className="p-2 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700">
              ⚠️ {payout.error_message}
            </div>
          )}

          {payout.completed_date && (
            <p className="text-xs text-gray-400">
              Completed: {format(new Date(payout.completed_date), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Withdrawal() {
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('paypal');
  const [recipient, setRecipient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setRecipient(u.email || '');
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['withdrawal-history', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const balance = user?.current_balance || 0;
  const pendingTotal = payouts.filter(p => p.status === 'pending' || p.status === 'processing').reduce((s, p) => s + (p.amount || 0), 0);
  const approvedTotal = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);

  const selectedMethod = PAYOUT_METHODS.find(m => m.id === method);

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < MIN_WITHDRAWAL) return toast.error(`Minimum withdrawal is $${MIN_WITHDRAWAL}`);
    if (amt > balance) return toast.error('Amount exceeds your available balance');
    if (!recipient || recipient.length < 3) return toast.error(`Please enter your ${selectedMethod?.label} details`);

    setSubmitting(true);
    try {
      const payout = await base44.entities.Payout.create({
        user_id: user.id,
        recipient_type: 'user',
        recipient_id: user.id,
        recipient_email: recipient,
        amount: amt,
        currency: 'USD',
        method,
        payout_type: 'manual',
        status: 'pending',
        description: `${selectedMethod?.label} withdrawal — $${amt.toFixed(2)}`,
      });

      await base44.auth.updateMe({ current_balance: Math.max(0, balance - amt) });

      if (method === 'paypal') {
        try {
          const res = await base44.functions.invoke('paypalPayout', {
            payoutId: payout.id, recipientEmail: recipient, amount: amt, currency: 'USD',
          });
          if (res.data?.success) {
            toast.success(`✅ $${amt.toFixed(2)} sent via PayPal! Batch ID: ${res.data.batch_id}`);
          } else {
            toast.success(`Withdrawal for $${amt.toFixed(2)} submitted — processing soon.`);
          }
        } catch (_) {
          toast.success(`Withdrawal for $${amt.toFixed(2)} submitted — we'll process it shortly.`);
        }
      } else if (method === 'venmo') {
        try {
          const res = await base44.functions.invoke('venmoPayout', {
            payoutId: payout.id, venmoUsername: recipient, amount: amt, currency: 'USD',
          });
          if (res.data?.success) {
            const msg = res.data.status === 'queued'
              ? `💙 Venmo payout queued! You'll receive $${amt.toFixed(2)} within 24 hours.`
              : `💙 $${amt.toFixed(2)} sent via Venmo! Batch ID: ${res.data.batch_id}`;
            toast.success(msg);
          } else {
            toast.success(`Venmo withdrawal for $${amt.toFixed(2)} submitted — processing soon.`);
          }
        } catch (_) {
          toast.success(`Venmo withdrawal for $${amt.toFixed(2)} submitted — we'll process it shortly.`);
        }
      } else if (method === 'cashapp') {
        try {
          const res = await base44.functions.invoke('cashappPayout', {
            payoutId: payout.id, cashtag: recipient, amount: amt, currency: 'usd',
          });
          if (res.data?.success) {
            toast.success(`💚 Cash App payout queued! You'll receive $${amt.toFixed(2)} within 24 hours.`);
          } else {
            toast.success(`Cash App withdrawal for $${amt.toFixed(2)} submitted — processing soon.`);
          }
        } catch (_) {
          toast.success(`Cash App withdrawal for $${amt.toFixed(2)} submitted — we'll process it shortly.`);
        }
      } else {
        toast.success(`$${amt.toFixed(2)} withdrawal via ${selectedMethod?.label} submitted! Processing in 1-3 business days.`);
      }

      const updated = await base44.auth.me();
      setUser(updated);
      queryClient.invalidateQueries(['withdrawal-history', user.id]);
      setAmount('');
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ArrowDownCircle className="w-8 h-8 text-green-600" /> Withdrawal
          </h1>
          <p className="text-gray-500 mt-1">Request payouts to your preferred digital wallet</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-5">
              <p className="text-sm text-green-700 font-medium flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Available Balance</p>
              <p className="text-3xl font-bold text-green-600">${balance.toFixed(2)}</p>
              <p className="text-xs text-green-500 mt-1">Ready to withdraw</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-amber-300 bg-amber-50">
            <CardContent className="p-5">
              <p className="text-sm text-amber-700 font-medium flex items-center gap-1.5"><Clock className="w-4 h-4" /> Pending</p>
              <p className="text-3xl font-bold text-amber-600">${pendingTotal.toFixed(2)}</p>
              <p className="text-xs text-amber-500 mt-1">Being processed</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardContent className="p-5">
              <p className="text-sm text-blue-700 font-medium flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Total Paid Out</p>
              <p className="text-3xl font-bold text-blue-600">${approvedTotal.toFixed(2)}</p>
              <p className="text-xs text-blue-500 mt-1">Successfully completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Eligibility bar */}
        <EligibilityBar balance={balance} />

        <Tabs defaultValue="withdraw">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="withdraw">Request Payout</TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5">
              Transaction History
              {payouts.filter(p => p.status === 'processing').length > 0 && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="withdraw" className="space-y-4 mt-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-600" /> Payout Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Method selector */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Payout Method</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PAYOUT_METHODS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMethod(m.id); setRecipient(''); }}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                          method === m.id
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <span className="text-xl">{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {selectedMethod?.label} {selectedMethod?.id === 'paypal' ? 'Email' : 'Details'}
                  </label>
                  <Input
                    type={selectedMethod?.type || 'text'}
                    placeholder={selectedMethod?.placeholder}
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    className="border-2"
                  />
                </div>

                {/* Amount */}
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

                {/* Quick amounts */}
                <div className="flex gap-2 flex-wrap">
                  {[10, 25, 50, 100].map(amt => (
                    <Button key={amt} variant="outline" size="sm"
                      onClick={() => setAmount(Math.min(amt, balance).toString())}
                      disabled={balance < amt}
                      className="border-green-300 text-green-700 hover:bg-green-50">${amt}</Button>
                  ))}
                  <Button variant="outline" size="sm"
                    onClick={() => setAmount(balance.toFixed(2))}
                    disabled={balance < MIN_WITHDRAWAL}
                    className="border-green-300 text-green-700 hover:bg-green-50">Max</Button>
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-sm text-blue-700">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {method === 'paypal' ? 'PayPal payouts are processed instantly via the PayPal Payouts API.' :
                     method === 'bank'   ? 'Bank transfers take 1-3 business days to arrive.' :
                     `${selectedMethod?.label} payouts typically arrive within 24 hours.`}
                  </span>
                </div>

                <Button
                  onClick={handleWithdraw}
                  disabled={submitting || !amount || parseFloat(amount) < MIN_WITHDRAWAL || parseFloat(amount) > balance}
                  className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
                >
                  {submitting
                    ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…</>
                    : <><Send className="w-5 h-5 mr-2" /> Request ${amount || '0.00'} via {selectedMethod?.label}</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-500" /> Transaction History
                  </CardTitle>
                  <button onClick={() => queryClient.invalidateQueries(['withdrawal-history', user?.id])}
                    className="text-gray-400 hover:text-gray-600">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div>
                ) : payouts.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No withdrawals yet</p>
                    <p className="text-sm text-gray-400 mt-1">Submit your first withdrawal request above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Summary chips */}
                    <div className="flex gap-2 flex-wrap mb-4">
                      {['pending','processing','completed','failed'].map(s => {
                        const count = payouts.filter(p => p.status === s).length;
                        if (!count) return null;
                        const cfg = statusConfig[s];
                        return (
                          <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} inline-block mr-1`} />
                            {cfg.label}: {count}
                          </span>
                        );
                      })}
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 ml-auto">
                        Total: {payouts.length} transactions
                      </span>
                    </div>

                    {payouts.map(p => <TransactionRow key={p.id} payout={p} />)}
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