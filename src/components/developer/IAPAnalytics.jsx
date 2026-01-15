import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import moment from 'moment';

export default function IAPAnalytics({ items, transactions, games }) {
  // Revenue by item
  const itemRevenue = items.map(item => {
    const itemTransactions = transactions.filter(t => 
      t.description?.includes(item.item_name) && t.status === 'completed'
    );
    const revenue = itemTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    return {
      name: item.item_name,
      revenue,
      sales: itemTransactions.length
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Revenue over time (last 30 days)
  const last30Days = [...Array(30)].map((_, i) => {
    const date = moment().subtract(i, 'days');
    const dayTransactions = transactions.filter(t => 
      moment(t.created_date).isSame(date, 'day') && t.status === 'completed'
    );
    return {
      date: date.format('MMM D'),
      revenue: dayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      sales: dayTransactions.length
    };
  }).reverse();

  // Revenue by game
  const gameRevenue = games.map(game => {
    const gameTransactions = transactions.filter(t => 
      t.game_id === game.id && t.status === 'completed'
    );
    const revenue = gameTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    return {
      name: game.title,
      value: revenue
    };
  }).filter(g => g.value > 0);

  // Payment method breakdown
  const paymentMethods = transactions.reduce((acc, t) => {
    if (t.status !== 'completed') return acc;
    const method = t.payment_method || 'credit_card';
    acc[method] = (acc[method] || 0) + (t.amount || 0);
    return acc;
  }, {});

  const paymentData = Object.entries(paymentMethods).map(([name, value]) => ({
    name: name === 'survey' ? 'Survey' : 'Credit Card',
    value
  }));

  const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Top Performing Items */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={itemRevenue.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue ($)" />
              <Bar dataKey="sales" fill="#ec4899" name="Sales" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={last30Days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} name="Revenue ($)" />
              <Line type="monotone" dataKey="sales" stroke="#ec4899" strokeWidth={2} name="Sales" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by Game */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Game</CardTitle>
          </CardHeader>
          <CardContent>
            {gameRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={gameRevenue}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {gameRevenue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No revenue data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No payment data
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}