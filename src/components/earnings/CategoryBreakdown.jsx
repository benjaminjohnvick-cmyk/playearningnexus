import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tag, TrendingUp } from 'lucide-react';

const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

// Infer category from transaction description
function inferCategory(tx) {
  const desc = (tx.description || tx.transaction_type || '').toLowerCase();
  if (desc.includes('gaming') || desc.includes('game')) return 'Gaming';
  if (desc.includes('tech') || desc.includes('technology')) return 'Tech';
  if (desc.includes('health') || desc.includes('medical')) return 'Health';
  if (desc.includes('finance') || desc.includes('financial')) return 'Finance';
  if (desc.includes('lifestyle') || desc.includes('consumer')) return 'Lifestyle';
  if (desc.includes('food') || desc.includes('grocery')) return 'Food';
  if (desc.includes('travel')) return 'Travel';
  if (desc.includes('referral') || desc.includes('commission')) return 'Referrals';
  if (desc.includes('ppc') || desc.includes('session')) return 'PPC Sessions';
  return 'General Surveys';
}

export default function CategoryBreakdown({ transactions = [] }) {
  const categoryData = useMemo(() => {
    const map = {};
    transactions
      .filter(tx => tx.amount > 0 && (tx.transaction_type === 'ppc_earning' || tx.transaction_type === 'survey_payout' || tx.transaction_type === 'referral_commission' || tx.transaction_type === 'survey_completion'))
      .forEach(tx => {
        const cat = inferCategory(tx);
        if (!map[cat]) map[cat] = { name: cat, amount: 0, count: 0 };
        map[cat].amount += tx.net_amount || tx.amount || 0;
        map[cat].count++;
      });

    return Object.values(map)
      .sort((a, b) => b.amount - a.amount)
      .map(d => ({ ...d, amount: parseFloat(d.amount.toFixed(2)) }));
  }, [transactions]);

  const topCategory = categoryData[0];
  const total = categoryData.reduce((s, d) => s + d.amount, 0);

  if (categoryData.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-500" /> Top Earning Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-gray-400 text-sm">
          Complete more surveys to see your category breakdown
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-500" /> Top Earning Categories
          </CardTitle>
          {topCategory && (
            <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> Best: {topCategory.name}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
            <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'Earned']} />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {categoryData.map((_, i) => (
                <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Category pills */}
        <div className="space-y-2">
          {categoryData.slice(0, 5).map((cat, i) => (
            <div key={cat.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-medium text-gray-700 truncate">{cat.name}</span>
                  <span className="text-gray-500 flex-shrink-0 ml-2">{cat.count} surveys · ${cat.amount.toFixed(2)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${total > 0 ? (cat.amount / total) * 100 : 0}%`,
                      background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                    }}
                  />
                </div>
              </div>
              <span className="text-xs font-bold text-gray-600 flex-shrink-0 w-8 text-right">
                {total > 0 ? Math.round((cat.amount / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}