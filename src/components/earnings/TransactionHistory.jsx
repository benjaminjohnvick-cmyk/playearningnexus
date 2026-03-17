import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, TrendingUp, Users, Award, RefreshCw,
  ArrowUpCircle, ArrowDownCircle, Minus, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const TYPE_CONFIG = {
  survey_completion:    { label: 'Survey Earned',      icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100', badgeClass: 'bg-green-100 text-green-700' },
  ppc_earning:          { label: 'PPC Earning',         icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100', badgeClass: 'bg-purple-100 text-purple-700' },
  referral_commission:  { label: 'Referral Commission', icon: Users,      color: 'text-blue-600',  bg: 'bg-blue-100',   badgeClass: 'bg-blue-100 text-blue-700' },
  platform_fee:         { label: 'Platform Fee',        icon: Minus,      color: 'text-red-500',   bg: 'bg-red-100',    badgeClass: 'bg-red-100 text-red-700' },
  survey_payout:        { label: 'Survey Payout',       icon: Award,      color: 'text-teal-600',  bg: 'bg-teal-100',   badgeClass: 'bg-teal-100 text-teal-700' },
  brand_purchase:       { label: 'Brand Purchase',      icon: ArrowDownCircle, color: 'text-orange-600', bg: 'bg-orange-100', badgeClass: 'bg-orange-100 text-orange-700' },
};

const ALL_TYPES = ['all', ...Object.keys(TYPE_CONFIG)];

function TxRow({ tx }) {
  const cfg = TYPE_CONFIG[tx.transaction_type] || { label: tx.transaction_type, icon: DollarSign, color: 'text-gray-600', bg: 'bg-gray-100', badgeClass: 'bg-gray-100 text-gray-700' };
  const Icon = cfg.icon;
  const isDebit = tx.transaction_type === 'platform_fee' || tx.transaction_type === 'brand_purchase';

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
      <div className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{tx.description || cfg.label}</p>
        <p className="text-xs text-gray-400">
          {tx.created_date ? format(new Date(tx.created_date), 'MMM d, yyyy · h:mm a') : '—'}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`font-bold ${isDebit ? 'text-red-500' : 'text-green-600'}`}>
          {isDebit ? '-' : '+'}${(tx.amount || 0).toFixed(2)}
        </p>
        {tx.fee_amount > 0 && (
          <p className="text-xs text-gray-400">-${tx.fee_amount.toFixed(2)} fee</p>
        )}
        <Badge className={`text-xs mt-0.5 ${cfg.badgeClass}`}>{cfg.label}</Badge>
      </div>
    </div>
  );
}

export default function TransactionHistory({ user }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [limit, setLimit] = useState(30);

  const { data: ppcTxs = [], isLoading: loadingPPC, refetch } = useQuery({
    queryKey: ['all-transactions', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const { data: payouts = [], isLoading: loadingPayouts } = useQuery({
    queryKey: ['all-payouts-history', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-history', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user?.id,
  });

  // Combine & normalize
  const allTx = [
    ...ppcTxs.map(t => ({ ...t, _source: 'ppc' })),
    ...payouts.map(p => ({
      id: p.id, created_date: p.created_date,
      transaction_type: 'survey_payout',
      amount: p.amount, fee_amount: 0,
      description: p.description || `${p.method} payout`,
      status: p.status, _source: 'payout',
    })),
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const filtered = typeFilter === 'all' ? allTx : allTx.filter(t => t.transaction_type === typeFilter);
  const displayed = filtered.slice(0, limit);

  // Summary stats
  const surveyTotal = ppcTxs.filter(t => t.transaction_type === 'ppc_earning' || t.transaction_type === 'survey_payout').reduce((s, t) => s + (t.amount || 0), 0);
  const referralTotal = ppcTxs.filter(t => t.transaction_type === 'referral_commission').reduce((s, t) => s + (t.amount || 0), 0);
  const feesTotal = ppcTxs.filter(t => t.transaction_type === 'platform_fee').reduce((s, t) => s + (t.amount || 0), 0);
  const payoutTotal = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);

  // Chart data — last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const dayTx = ppcTxs.filter(t => t.created_date?.startsWith(key));
    return {
      day: format(d, 'EEE'),
      earned: dayTx.reduce((s, t) => s + (['ppc_earning', 'survey_payout', 'referral_commission'].includes(t.transaction_type) ? (t.amount || 0) : 0), 0),
    };
  });

  const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#4f46e5', '#3730a3'];

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Survey & PPC Earnings', value: surveyTotal, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
          { label: 'Referral Commissions', value: referralTotal, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Total Paid Out', value: payoutTotal, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          { label: 'Platform Fees', value: feesTotal, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
        ].map((kpi, i) => (
          <Card key={i} className={`border-2 ${kpi.bg}`}>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-0.5">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.color}`}>${kpi.value.toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 7-day chart */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Earnings Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={last7Days} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'Earned']} />
              <Bar dataKey="earned" radius={[4, 4, 0, 0]}>
                {last7Days.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filters + Transaction List */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" /> Transaction History
              <Badge className="bg-gray-100 text-gray-600 text-xs">{filtered.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44 text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-600">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPPC ? (
            <div className="text-center py-10"><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : displayed.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No transactions found{typeFilter !== 'all' ? ' for this type' : ''}.</p>
          ) : (
            <div className="space-y-2">
              {displayed.map(tx => <TxRow key={tx.id} tx={tx} />)}
              {filtered.length > limit && (
                <Button variant="outline" className="w-full mt-3" onClick={() => setLimit(l => l + 30)}>
                  Load More ({filtered.length - limit} remaining)
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}