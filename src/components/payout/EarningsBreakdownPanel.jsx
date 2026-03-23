import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileText, Users, DollarSign, TrendingUp } from 'lucide-react';

const SOURCE_COLORS = {
  survey_payout: '#6366f1',
  referral_commission: '#10b981',
  ppc_earning: '#f59e0b',
  brand_purchase: '#ec4899',
  platform_fee: '#ef4444',
  other: '#94a3b8',
};

const SOURCE_LABELS = {
  survey_payout: 'Survey Payouts',
  referral_commission: 'Referral Commissions',
  ppc_earning: 'PPC Earnings',
  brand_purchase: 'Brand Purchases',
  platform_fee: 'Platform Fees',
  other: 'Other',
};

export default function EarningsBreakdownPanel({ transactions = [] }) {
  // Aggregate by transaction type
  const byType = transactions.reduce((acc, tx) => {
    const key = tx.transaction_type || 'other';
    acc[key] = (acc[key] || 0) + Math.abs(tx.amount || 0);
    return acc;
  }, {});

  const chartData = Object.entries(byType)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: SOURCE_LABELS[key] || key,
      value: parseFloat(value.toFixed(2)),
      key
    }))
    .sort((a, b) => b.value - a.value);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (!chartData.length) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 text-center text-gray-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          No transaction data available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-indigo-600" /> Earnings Breakdown by Source
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
              label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              labelLine={false}>
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={SOURCE_COLORS[entry.key] || SOURCE_COLORS.other} />
              ))}
            </Pie>
            <Tooltip formatter={(val) => [`$${val.toFixed(2)}`, 'Amount']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        <div className="space-y-2">
          {chartData.map(entry => (
            <div key={entry.key} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: SOURCE_COLORS[entry.key] || SOURCE_COLORS.other }} />
                <span className="text-sm text-gray-700">{entry.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">${entry.value.toFixed(2)}</span>
                <Badge variant="outline" className="text-xs">{((entry.value / total) * 100).toFixed(1)}%</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}