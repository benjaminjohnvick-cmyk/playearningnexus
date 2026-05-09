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
  DollarSign, Clock, CheckCircle2, XCircle,
  Loader2, Send, ArrowDownCircle, RefreshCw, Info,
  CreditCard, Wallet, Copy, ChevronDown, ChevronUp, Shield,
  TrendingUp, Zap, BarChart2, ShoppingBag, Search, ArrowRight, Lock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import TransactionHistory from '@/components/earnings/TransactionHistory';
import PayoutTimeline from '@/components/payout/PayoutTimeline';
import SmartPayoutTips from '@/components/payout/SmartPayoutTips';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

const MIN_WITHDRAWAL = 10;
const FULL_ELIGIBILITY_AMOUNT = 50; // $50 = 100% eligible

const PAYOUT_METHODS = [
  { id: 'paypal',   label: 'PayPal',         icon: '🅿️', placeholder: 'your@paypal.com',                   type: 'email', hint: 'Enter your PayPal email address.' },
  { id: 'venmo',    label: 'Venmo',          icon: '💙', placeholder: 'Email or phone linked to Venmo',    type: 'text',  hint: 'Enter the email or phone number linked to your Venmo account for instant automated payout.' },
  { id: 'cashapp',  label: 'Cash App',       icon: '💚', placeholder: null,                                type: 'card',  hint: 'Enter your Cash Card details for an instant payout via Stripe (arrives in ~30 min).' },
  { id: 'bank',     label: 'Bank Transfer',  icon: '🏦', placeholder: 'Account number',                   type: 'text',  hint: 'Bank transfers take 1-3 business days.' },
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

// Inner CashApp form that has access to Stripe hooks
function CashAppWithdrawForm({ user, balance, payouts, queryClient }) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCashAppWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < MIN_WITHDRAWAL) return toast.error(`Minimum withdrawal is $${MIN_WITHDRAWAL}`);
    if (amt > balance) return toast.error('Amount exceeds your available balance');
    if (!stripe || !elements) return toast.error('Stripe not loaded yet.');

    setSubmitting(true);
    try {
      const cardElement = elements.getElement(CardElement);
      const { token, error } = await stripe.createToken(cardElement, { currency: 'usd' });
      if (error) { toast.error(error.message); setSubmitting(false); return; }

      const payout = await base44.entities.Payout.create({
        user_id: user.id,
        recipient_type: 'user',
        recipient_id: user.id,
        recipient_email: user.email,
        amount: amt,
        currency: 'USD',
        method: 'cashapp',
        payout_type: 'manual',
        status: 'pending',
        description: `Cash App Instant Payout — $${amt.toFixed(2)}`,
      });

      await base44.auth.updateMe({ current_balance: Math.max(0, balance - amt) });

      const res = await base44.functions.invoke('cashappPayout', {
        payoutId: payout.id, cardToken: token.id, amount: amt, currency: 'usd',
      });

      if (res.data?.success) {
        toast.success(`💚 $${amt.toFixed(2)} sent to your Cash Card! Arrives ~30 minutes.`);
      } else {
        toast.error(res.data?.error || 'Cash App payout failed.');
      }

      queryClient.invalidateQueries(['withdrawal-history', user.id]);
      setAmount('');
    } catch (e) {
      toast.error('Failed to process Cash App payout. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingTotal = payouts.filter(p => p.status === 'pending' || p.status === 'processing').reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex gap-2 text-sm text-green-700">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Enter your Cash Card (Visa debit) details. Money arrives in your Cash App balance within ~30 minutes via Stripe Instant Payout.
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Cash Card Details</label>
        <div className="border-2 border-gray-200 rounded-lg p-3 bg-white">
          <CardElement options={{ style: { base: { fontSize: '16px', color: '#374151' } } }} />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Amount (USD)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
          <Input type="number" placeholder={`Min $${MIN_WITHDRAWAL}`} value={amount}
            onChange={e => setAmount(e.target.value)} className="pl-7 border-2 text-lg"
            min={MIN_WITHDRAWAL} max={balance} step="0.01" />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Minimum: ${MIN_WITHDRAWAL}</span>
          <span>Available: ${balance.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[10, 25, 50, 100].map(amt => (
          <Button key={amt} variant="outline" size="sm"
            onClick={() => setAmount(Math.min(amt, balance).toString())}
            disabled={balance < amt}
            className="border-green-300 text-green-700 hover:bg-green-50">${amt}</Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => setAmount(balance.toFixed(2))}
          disabled={balance < MIN_WITHDRAWAL}
          className="border-green-300 text-green-700 hover:bg-green-50">Max</Button>
      </div>

      <Button onClick={handleCashAppWithdraw}
        disabled={submitting || !amount || parseFloat(amount) < MIN_WITHDRAWAL || parseFloat(amount) > balance}
        className="w-full bg-green-600 hover:bg-green-700 h-12 text-base">
        {submitting
          ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing…</>
          : <><Send className="w-5 h-5 mr-2" /> Send ${amount || '0.00'} to Cash Card</>}
      </Button>
    </div>
  );
}

export default function Withdrawal() {
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('paypal');
  const [recipient, setRecipient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawalEligibility, setWithdrawalEligibility] = useState({ eligible: true, adsClicked: 0, postsCreated: 0, required: 0 });
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      setRecipient(u.email || '');
      // Part C: check social post requirement (20 posts per ad clicked)
      try {
        const [adClicks, socialPosts] = await Promise.all([
          base44.entities.PPCTransaction.filter({ user_id: u.id, transaction_type: 'ad_click' }),
          base44.entities.SocialMediaPost.filter({ user_id: u.id, status: 'posted' }),
        ]);
        const adsClicked = adClicks.length;
        const postsCreated = socialPosts.length;
        const required = adsClicked * 20;
        setWithdrawalEligibility({
          eligible: postsCreated >= required || adsClicked === 0,
          adsClicked,
          postsCreated,
          required,
        });
      } catch {}
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
            payoutId: payout.id, venmoContact: recipient, amount: amt, currency: 'USD',
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
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="withdraw">Request Payout</TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5">
              Timeline
              {payouts.filter(p => p.status === 'processing').length > 0 && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="tips">💡 Smart Tips</TabsTrigger>
            <TabsTrigger value="earnings" className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" /> Earnings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="withdraw" className="space-y-4 mt-4">
            {/* Non-business user notice — always visible, messaging adapts by role */}
            {user && (
              <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${['admin', 'developer', 'survey_creator', 'ppc_advertiser'].includes(user.role) ? 'bg-green-100' : 'bg-purple-100'}`}>
                      {['admin', 'developer', 'survey_creator', 'ppc_advertiser'].includes(user.role)
                        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                        : <Lock className="w-5 h-5 text-purple-600" />}
                    </div>
                    <div>
                      {['admin', 'developer', 'survey_creator', 'ppc_advertiser'].includes(user.role) ? (
                        <>
                          <p className="font-bold text-green-900 text-base mb-1">✅ You're a Business User — Cash Withdrawals Available</p>
                          <p className="text-sm text-green-700">
                            As a verified business account, you can withdraw your earnings directly to PayPal, Venmo, Cash App, or bank transfer below.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-purple-900 text-base mb-1">Cash Withdrawals Are for Business Users</p>
                          <p className="text-sm text-purple-700">
                            Direct cash payouts are reserved for verified business accounts — developers, survey creators, and PPC advertisers.
                            <strong className="block mt-1">But your earnings don't go to waste!</strong>
                            You can use your balance to search for and buy any product online, delivered right through the site.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Product search graphic / CTA */}
                  <div className="rounded-xl border-2 border-purple-200 bg-white p-4">
                    <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-3">How to spend your earnings</p>
                    <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-gray-600">
                      {/* Step 1 */}
                      <div className="flex flex-col items-center gap-1.5 text-center flex-1">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <Search className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span className="font-semibold text-gray-800">Search Any Product</span>
                        <span className="text-xs text-gray-400">Find millions of items from top retailers</span>
                      </div>
                      <ArrowRight className="w-5 h-5 text-purple-300 hidden sm:block flex-shrink-0" />
                      {/* Step 2 */}
                      <div className="flex flex-col items-center gap-1.5 text-center flex-1">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="font-semibold text-gray-800">Buy With Your Balance</span>
                        <span className="text-xs text-gray-400">Use your GamerGain earnings at checkout</span>
                      </div>
                      <ArrowRight className="w-5 h-5 text-purple-300 hidden sm:block flex-shrink-0" />
                      {/* Step 3 */}
                      <div className="flex flex-col items-center gap-1.5 text-center flex-1">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-amber-600" />
                        </div>
                        <span className="font-semibold text-gray-800">Get It Delivered</span>
                        <span className="text-xs text-gray-400">We order it on your behalf — straight to your door</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-2">
                      <Link to="/Wishlist" className="flex-1">
                        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2">
                          <Search className="w-4 h-4" /> Search & Buy Products →
                        </Button>
                      </Link>
                      <Link to="/Store" className="flex-1">
                        <Button variant="outline" className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 gap-2">
                          <ShoppingBag className="w-4 h-4" /> Browse the Store
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Part C: Social post requirement gate */}
            {!withdrawalEligibility.eligible && (
              <Card className="border-2 border-orange-300 bg-orange-50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-orange-900 mb-1">Social Post Requirement Not Met</p>
                      <p className="text-sm text-orange-700 mb-2">
                        To withdraw, you must create <strong>20 social media posts per ad clicked</strong>.
                        You've clicked <strong>{withdrawalEligibility.adsClicked} ads</strong>, requiring <strong>{withdrawalEligibility.required} posts</strong>.
                        You've created <strong>{withdrawalEligibility.postsCreated}</strong> so far.
                        <span className="block mt-1 font-semibold">
                          {withdrawalEligibility.required - withdrawalEligibility.postsCreated} more post{withdrawalEligibility.required - withdrawalEligibility.postsCreated !== 1 ? 's' : ''} needed.
                        </span>
                      </p>
                      <p className="text-xs text-orange-600 mb-3">
                        Use the AI Content Hub to auto-generate social ads for the products you clicked — AI copies product images, creates captions with your earnings, and posts for you.
                      </p>
                      <a href="/AIContentHub">
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
                          <Zap className="w-3.5 h-3.5 mr-1" /> Create Social Posts with AI →
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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

                {/* CashApp uses its own Stripe card form */}
                {method === 'cashapp' ? (
                  <Elements stripe={stripePromise}>
                    <CashAppWithdrawForm user={user} balance={balance} payouts={payouts} queryClient={queryClient} />
                  </Elements>
                ) : (
                  <>
                    {/* Recipient */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        {selectedMethod?.label} {method === 'paypal' ? 'Email' : method === 'venmo' ? 'Email or Phone' : 'Details'}
                      </label>
                      <Input
                        type={selectedMethod?.type === 'card' ? 'text' : (selectedMethod?.type || 'text')}
                        placeholder={selectedMethod?.placeholder}
                        value={recipient}
                        onChange={e => setRecipient(e.target.value)}
                        className="border-2"
                      />
                      {selectedMethod?.hint && (
                        <p className="text-xs text-gray-400 mt-1">{selectedMethod.hint}</p>
                      )}
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Amount (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                        <Input type="number" placeholder={`Min $${MIN_WITHDRAWAL}`} value={amount}
                          onChange={e => setAmount(e.target.value)} className="pl-7 border-2 text-lg"
                          min={MIN_WITHDRAWAL} max={balance} step="0.01" />
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
                      <Button variant="outline" size="sm" onClick={() => setAmount(balance.toFixed(2))}
                        disabled={balance < MIN_WITHDRAWAL}
                        className="border-green-300 text-green-700 hover:bg-green-50">Max</Button>
                    </div>

                    <Button onClick={handleWithdraw}
                      disabled={submitting || !amount || parseFloat(amount) < MIN_WITHDRAWAL || parseFloat(amount) > balance || !withdrawalEligibility.eligible}
                      className="w-full bg-green-600 hover:bg-green-700 h-12 text-base">
                      {submitting
                        ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…</>
                        : <><Send className="w-5 h-5 mr-2" /> Request ${amount || '0.00'} via {selectedMethod?.label}</>}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings" className="mt-4">
            <TransactionHistory user={user} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <PayoutTimeline payouts={payouts} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="tips" className="mt-4">
            <SmartPayoutTips payouts={payouts} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}