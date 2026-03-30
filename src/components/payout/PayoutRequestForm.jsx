import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2, Shield, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function PayoutRequestForm({ user }) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [result, setResult] = useState(null);

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('requestPayout', {
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        payment_details: { email: paymentEmail },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.auto_approved) {
        toast.success('✓ Payout approved! Processing now.');
      } else {
        toast.info('Request submitted for review.');
      }
      setAmount('');
      setPaymentEmail('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Request failed');
    },
  });

  const availableBalance = user.total_earnings - (user.pending_payouts || 0);
  const isMinimum = parseFloat(amount) >= 5;

  if (result) {
    return (
      <Card className={result.auto_approved ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}>
        <CardHeader>
          <div className="flex items-center gap-2">
            {result.auto_approved ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-blue-600" />
            )}
            <CardTitle className={result.auto_approved ? 'text-green-900' : 'text-blue-900'}>
              {result.auto_approved ? 'Payout Approved!' : 'Request Submitted'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-bold">${result.request_id || amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Trust Score:</span>
              <span className="font-semibold">{result.trust_score}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Risk Assessment:</span>
              <span className={`font-semibold ${result.risk_score < 50 ? 'text-green-600' : 'text-orange-600'}`}>
                {result.risk_score}%
              </span>
            </div>
          </div>

          <p className="text-sm leading-relaxed">{result.next_steps}</p>

          <Button
            onClick={() => {
              setResult(null);
              setAmount('');
            }}
            className="w-full"
            variant="outline"
          >
            New Request
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Request Payout
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Balance Info */}
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
            <p className="text-xs text-blue-600 font-semibold">Available Balance</p>
            <p className="text-2xl font-bold text-blue-900">${availableBalance.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
            <p className="text-xs text-purple-600 font-semibold">Lifetime Earnings</p>
            <p className="text-2xl font-bold text-purple-900">${(user.total_earnings || 0).toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
            <p className="text-xs text-green-600 font-semibold">Min Payout</p>
            <p className="text-2xl font-bold text-green-900">$5.00</p>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">Amount</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-3 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="5"
                max={availableBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-6 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAmount(availableBalance.toFixed(2))}
            >
              Max
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Minimum: $5.00</p>
        </div>

        {/* Payment Method */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="paypal">PayPal</option>
            <option value="stripe">Stripe</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>

        {/* Payment Email */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">{paymentMethod === 'paypal' ? 'PayPal Email' : 'Email'}</label>
          <input
            type="email"
            value={paymentEmail}
            onChange={(e) => setPaymentEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Safety Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
          <div className="flex gap-2">
            <Shield className="w-5 h-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="font-semibold">Auto-Approval Checks</p>
              <p className="text-xs mt-1">Requests with sufficient trust score and earnings history are auto-approved and processed instantly.</p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => requestMutation.mutate()}
          disabled={!isMinimum || !paymentEmail || requestMutation.isPending}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          {requestMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Request Payout'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}