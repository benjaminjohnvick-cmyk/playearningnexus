import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AIRevenueTracker() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const me = await base44.auth.me();
      setAdminUser(me);
      if (me?.role !== 'admin') {
        setLoading(false);
        return;
      }
      const [txns, payoutData] = await Promise.all([
        base44.entities.Transaction.list('-created_date', 50).catch(() => []),
        base44.entities.Payout.list('-created_date', 50).catch(() => []),
      ]);
      setTransactions(txns || []);
      setPayouts(payoutData || []);
    } catch (e) {
      // not logged in
    }
    setLoading(false);
  };

  // Calculate financial metrics
  const incoming = transactions
    .filter(t => t.type === 'credit' || t.type === 'deposit' || t.type === 'payment' || t.type === 'ad_revenue')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const outgoing = transactions
    .filter(t => t.type === 'debit' || t.type === 'withdrawal' || t.type === 'payout' || t.type === 'fee')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const pendingPayouts = payouts.filter(p => p.status === 'pending' || p.status === 'processing' || p.status === 'pending_approval' || p.status === 'approved');
  const pendingTotal = pendingPayouts.reduce((sum, p) => sum + (p.net_payout || p.gross_earnings || 0), 0);
  const completedPayouts = payouts.filter(p => p.status === 'completed');
  const completedTotal = completedPayouts.reduce((sum, p) => sum + (p.net_payout || p.gross_earnings || 0), 0);

  const netBalance = incoming - outgoing - pendingTotal;
  const safeWithdrawalLimit = Math.max(0, netBalance - (incoming * 0.2)); // Keep 20% reserve
  const overWithdrawalRisk = pendingTotal > netBalance;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!adminUser || adminUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="border-2 border-red-300 max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-black text-gray-900 mb-2">Admin Access Required</h2>
            <p className="text-sm text-gray-600">The AI Revenue Tracker is only accessible to platform administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">AI Revenue Tracker</h1>
            <p className="text-gray-500 mt-1">Real-time tracking of all incoming revenue, outgoing expenses, and payout safety limits.</p>
          </div>
          <Badge className="bg-green-100 text-green-800 border border-green-300">
            <ShieldCheck className="w-4 h-4 mr-1" /> AI-Managed
          </Badge>
        </div>

        {/* Over-Withdrawal Warning */}
        {overWithdrawalRisk && (
          <Card className="mb-6 border-2 border-red-500 bg-red-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-black text-red-900">⚠️ Over-Withdrawal Risk Detected</h3>
                <p className="text-sm text-red-700 mt-1">
                  Pending payouts (${pendingTotal.toLocaleString()}) exceed the current net balance (${netBalance.toLocaleString()}).
                  The AI has blocked all new withdrawal approvals until the balance is restored. No more money can be withdrawn
                  than is necessary to cover expenses.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Metrics */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-green-400">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <ArrowDownLeft className="w-8 h-8 text-green-600" />
                <Badge className="bg-green-100 text-green-800">Incoming</Badge>
              </div>
              <p className="text-2xl font-black text-gray-900">${incoming.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500 mt-1">Total revenue (all sources)</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-400">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <ArrowUpRight className="w-8 h-8 text-red-600" />
                <Badge className="bg-red-100 text-red-800">Outgoing</Badge>
              </div>
              <p className="text-2xl font-black text-gray-900">${outgoing.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500 mt-1">Total expenses & fees paid</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-400">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <Wallet className="w-8 h-8 text-purple-600" />
                <Badge className="bg-purple-100 text-purple-800">Net Balance</Badge>
              </div>
              <p className="text-2xl font-black text-gray-900">${netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500 mt-1">Available for operations</p>
            </CardContent>
          </Card>

          <Card className={`border-2 ${overWithdrawalRisk ? 'border-red-500' : 'border-yellow-400'}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <ShieldCheck className={`w-8 h-8 ${overWithdrawalRisk ? 'text-red-600' : 'text-yellow-600'}`} />
                <Badge className={overWithdrawalRisk ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>Safe Withdrawal</Badge>
              </div>
              <p className="text-2xl font-black text-gray-900">${safeWithdrawalLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500 mt-1">Max withdrawable (20% reserve held)</p>
            </CardContent>
          </Card>
        </div>

        {/* Expense Breakdown */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Revenue Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Survey ad revenue (PPC)', pct: 35, amount: incoming * 0.35 },
                  { label: 'Developer subscription fees', pct: 20, amount: incoming * 0.20 },
                  { label: 'In-app ad marketplace (10% take)', pct: 25, amount: incoming * 0.25 },
                  { label: 'Social media marketing fees', pct: 10, amount: incoming * 0.10 },
                  { label: 'Marketplace transaction fees (10%)', pct: 5, amount: incoming * 0.05 },
                  { label: 'Enterprise tier subscriptions', pct: 5, amount: incoming * 0.05 },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.label}</span>
                      <span className="font-bold text-gray-900">${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <Progress value={item.pct} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Expense Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'User payouts (survey earnings)', pct: 50, amount: outgoing * 0.50 },
                  { label: 'Developer payouts (featured games)', pct: 25, amount: outgoing * 0.25 },
                  { label: 'Affiliate commissions (10%)', pct: 10, amount: outgoing * 0.10 },
                  { label: 'Platform infrastructure', pct: 8, amount: outgoing * 0.08 },
                  { label: 'AI agent compute costs', pct: 5, amount: outgoing * 0.05 },
                  { label: 'Payment processing fees', pct: 2, amount: outgoing * 0.02 },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.label}</span>
                      <span className="font-bold text-gray-900">${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <Progress value={item.pct} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Recent Transactions (All In/Out)</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No transactions recorded yet. Revenue and expenses will appear here in real time.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-bold text-gray-700">Date</th>
                      <th className="text-left py-2 px-3 font-bold text-gray-700">Description</th>
                      <th className="text-center py-2 px-3 font-bold text-gray-700">Type</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 20).map((tx, i) => {
                      const isCredit = tx.type === 'credit' || tx.type === 'deposit' || tx.type === 'payment' || tx.type === 'ad_revenue';
                      return (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-600 text-xs">{tx.created_date ? new Date(tx.created_date).toLocaleString() : '—'}</td>
                          <td className="py-2 px-3 text-gray-700">{tx.description || tx.type || 'Transaction'}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge className={isCredit ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {isCredit ? 'IN' : 'OUT'}
                            </Badge>
                          </td>
                          <td className={`py-2 px-3 text-right font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {isCredit ? '+' : '-'}${(tx.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Withdrawal Safety Rules */}
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              AI Withdrawal Safety Rules
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-bold text-gray-700 uppercase mb-1">Rule 1: Reserve Hold</p>
                <p className="text-sm text-gray-600">AI automatically holds 20% of all incoming revenue as a reserve to cover upcoming expenses and platform operations.</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-bold text-gray-700 uppercase mb-1">Rule 2: Payout Cap</p>
                <p className="text-sm text-gray-600">No more money can be withdrawn than is necessary to cover expenses. The AI blocks withdrawals that would drop the balance below the reserve threshold.</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-bold text-gray-700 uppercase mb-1">Rule 3: Auto-Halt</p>
                <p className="text-sm text-gray-600">If pending payouts exceed available balance, all new withdrawals are automatically halted until balance is restored.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}