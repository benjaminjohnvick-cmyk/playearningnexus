import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, ShoppingCart, Users, CreditCard } from 'lucide-react';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function RevenueAnalytics({ games, developerId }) {
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['devTransactions', developerId],
    queryFn: () => base44.entities.Transaction.filter({ business_client_id: developerId })
  });

  const { data: iapItems = [] } = useQuery({
    queryKey: ['allIAPItems', developerId],
    queryFn: async () => {
      const items = [];
      for (const game of games) {
        const gameItems = await base44.entities.InAppPurchase.filter({ game_id: game.id });
        items.push(...gameItems);
      }
      return items;
    },
    enabled: games.length > 0
  });

  // Revenue per game
  const revenuePerGame = games.map(game => {
    const gameTransactions = allTransactions.filter(t => t.game_id === game.id && t.status === 'completed');
    const revenue = gameTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    return {
      name: game.title.substring(0, 20),
      revenue: parseFloat(revenue.toFixed(2)),
      transactions: gameTransactions.length
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Monetization model breakdown
  const monetizationBreakdown = [
    {
      name: 'In-App Purchase',
      value: allTransactions.filter(t => t.transaction_type === 'in_app_purchase' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0)
    },
    {
      name: 'Subscription',
      value: allTransactions.filter(t => t.transaction_type === 'subscription' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0)
    },
    {
      name: 'Game Purchase',
      value: allTransactions.filter(t => t.transaction_type === 'purchase' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0)
    },
    {
      name: 'Survey Revenue',
      value: allTransactions.filter(t => t.transaction_type === 'survey_share' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0)
    }
  ].filter(item => item.value > 0);

  // Monthly revenue trend
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    return date;
  });

  const monthlyRevenue = last6Months.map(date => {
    const monthStr = date.toISOString().substring(0, 7);
    const monthRevenue = allTransactions
      .filter(t => t.created_date?.startsWith(monthStr) && t.status === 'completed')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      revenue: parseFloat(monthRevenue.toFixed(2))
    };
  });

  // Top performing IAP items
  const topIAPItems = iapItems
    .sort((a, b) => (b.total_purchases || 0) - (a.total_purchases || 0))
    .slice(0, 5)
    .map(item => ({
      name: item.item_name,
      purchases: item.total_purchases || 0,
      revenue: (item.price * (item.total_purchases || 0)).toFixed(2)
    }));

  const totalRevenue = allTransactions.filter(t => t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0);
  const avgTransactionValue = totalRevenue / (allTransactions.filter(t => t.status === 'completed').length || 1);
  const totalTransactions = allTransactions.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Transactions</p>
                <p className="text-2xl font-bold text-blue-600">{totalTransactions}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Transaction</p>
                <p className="text-2xl font-bold text-purple-600">${avgTransactionValue.toFixed(2)}</p>
              </div>
              <CreditCard className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Games</p>
                <p className="text-2xl font-bold text-amber-600">{games.length}</p>
              </div>
              <Users className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Revenue Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue per Game */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Game</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenuePerGame}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monetization Models */}
        <Card>
          <CardHeader>
            <CardTitle>Monetization Model Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={monetizationBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {monetizationBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top IAP Items */}
      {topIAPItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Performing In-App Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topIAPItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-purple-600">{idx + 1}</Badge>
                    <div>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.purchases} purchases</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-green-600">${item.revenue}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}