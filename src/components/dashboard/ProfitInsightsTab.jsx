import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, Search, Zap, Target } from 'lucide-react';

const COLORS = ['#22c55e', '#ef4444', '#8b5cf6', '#f59e0b', '#3b82f6'];

// Fee constants (must match checkout logic)
const MARKUP_RATE = 0.10;
const SEARCH_FEE = 0.05;
const DAILY_SURVEY_GOAL = 3.00;
const PPC_TASK_EARN = 0.40;

function ProjectedMonthlyWidget({ user, completedTasksToday }) {
  const totalTasks = 10; // approximate total daily tasks
  const completionRate = totalTasks > 0 ? completedTasksToday / totalTasks : 0;
  const dailyEarnings = (PPC_TASK_EARN + DAILY_SURVEY_GOAL - SEARCH_FEE) * completionRate;
  const projectedMonthly = dailyEarnings * 30;
  const projectedYearly = dailyEarnings * 365;

  return (
    <Card className="bg-gradient-to-br from-green-600 to-emerald-700 text-white border-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Target className="w-5 h-5" /> Projected Monthly Payout
        </CardTitle>
        <p className="text-green-100 text-xs">Based on your current daily task completion rate ({Math.round(completionRate * 100)}%)</p>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-black mb-1">${projectedMonthly.toFixed(2)}</div>
        <p className="text-green-200 text-sm mb-4">per month · ${projectedYearly.toFixed(2)}/yr if sustained</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/20 rounded-xl p-2">
            <p className="text-xs text-green-100">PPC Daily</p>
            <p className="font-bold">${PPC_TASK_EARN.toFixed(2)}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-2">
            <p className="text-xs text-green-100">Surveys Daily</p>
            <p className="font-bold">${DAILY_SURVEY_GOAL.toFixed(2)}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-2">
            <p className="text-xs text-red-200">Search Fee</p>
            <p className="font-bold text-red-200">−${SEARCH_FEE.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-3 bg-white/10 rounded-xl p-2 text-center">
          <p className="text-xs text-green-100">Net daily at 100% completion</p>
          <p className="font-bold text-lg">${(PPC_TASK_EARN + DAILY_SURVEY_GOAL - SEARCH_FEE).toFixed(2)}/day</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfitInsightsTab({ user }) {
  const todayKey = `todo_completed_${user?.id}_${new Date().toDateString()}`;
  const completedToday = JSON.parse(localStorage.getItem(todayKey) || '[]');

  const { data: transactions = [] } = useQuery({
    queryKey: ['profit-transactions', user?.id],
    queryFn: () => base44.entities.Transaction.filter({ user_id: user.id }, '-created_date', 30),
    enabled: !!user?.id,
  });

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['daily-earnings-chart', user?.id],
    queryFn: () => base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 14),
    enabled: !!user?.id,
  });

  // Build last 7-day earnings vs fees chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const match = dailyEarnings.find(e => e.date === dateStr);
    const earned = match?.total_earned || 0;
    const fees = (earned * MARKUP_RATE) + SEARCH_FEE;
    return { label, earned: parseFloat(earned.toFixed(2)), fees: parseFloat(fees.toFixed(2)), net: parseFloat((earned - fees).toFixed(2)) };
  });

  // Task earnings breakdown
  const taskBreakdown = [
    { name: 'PPC Ads', value: PPC_TASK_EARN, color: '#8b5cf6' },
    { name: 'Surveys', value: DAILY_SURVEY_GOAL, color: '#22c55e' },
    { name: 'Search Fee', value: -SEARCH_FEE, color: '#ef4444' },
    { name: 'Store Markup (10%)', value: -(transactions.reduce((s, t) => s + (t.amount || 0), 0) * MARKUP_RATE / Math.max(transactions.length, 1)), color: '#f59e0b' },
  ];

  const totalEarned = user?.total_earnings || 0;
  const estimatedFeesPaid = transactions.reduce((s, t) => s + ((t.amount || 0) * MARKUP_RATE), 0) + (completedToday.length * SEARCH_FEE * 0.5);
  const netEarnings = totalEarned - estimatedFeesPaid;

  const pieData = [
    { name: 'Your Net Earnings', value: Math.max(netEarnings, 0) },
    { name: 'Platform Fees', value: estimatedFeesPaid },
  ];

  return (
    <div className="space-y-6">
      {/* Projected Monthly Payout Widget */}
      <ProjectedMonthlyWidget user={user} completedTasksToday={completedToday.length} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <p className="text-xs text-gray-500">Total Earned</p>
            </div>
            <p className="text-2xl font-black text-green-700">${totalEarned.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <p className="text-xs text-gray-500">Est. Fees Paid</p>
            </div>
            <p className="text-2xl font-black text-red-600">−${estimatedFeesPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-500">Net Earnings</p>
            </div>
            <p className="text-2xl font-black text-blue-700">${Math.max(netEarnings, 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-purple-600" />
              <p className="text-xs text-gray-500">Tasks Done Today</p>
            </div>
            <p className="text-2xl font-black text-purple-700">{completedToday.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Earnings vs Fees Line Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" /> 7-Day Earnings vs. Platform Fees
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={last7Days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v, name) => [`$${v.toFixed(2)}`, name]} />
              <Legend />
              <Line type="monotone" dataKey="earned" name="Gross Earnings" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="fees" name="Fees" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="net" name="Net" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Task Contribution Bar Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-600" /> Daily Task Earnings Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={[{ name: 'Today', ppc: PPC_TASK_EARN, surveys: DAILY_SURVEY_GOAL, searchFee: SEARCH_FEE }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="ppc" name="PPC Earn" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="surveys" name="Surveys" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="searchFee" name="Search Fee" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Earnings vs Fees Pie */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" /> Your Earnings vs. Platform Fees (All Time)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6 flex-wrap">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                <span className="text-sm text-gray-700">{item.name}</span>
                <Badge className="text-xs" style={{ background: COLORS[i] }}>${item.value.toFixed(2)}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fee breakdown legend */}
      <Card className="border border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <p className="font-semibold text-amber-800 text-sm mb-2">📌 How Platform Fees Work</p>
          <ul className="text-xs text-amber-700 space-y-1">
            <li>• <strong>Shop Search:</strong> $0.05 per daily search (auto-deducted from $0.40 PPC earnings)</li>
            <li>• <strong>Store Purchases:</strong> 10% markup on all sales</li>
            <li>• <strong>Credit Card:</strong> $1 flat or 3% (whichever is higher)</li>
            <li>• <strong>PPC Ads:</strong> You earn $0.20, GamerGain earns $0.20 per completed ad survey</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}