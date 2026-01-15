import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, DollarSign, FileText, Gamepad2 } from 'lucide-react';
import moment from 'moment';

export default function UserStats({ user, transactions, ratings, achievements }) {
  // Calculate stats
  const surveyTransactions = transactions.filter(t => t.transaction_type === 'survey_completion');
  const gamesPurchased = transactions.filter(t => t.transaction_type === 'game_purchase').length;
  const totalSpent = transactions
    .filter(t => t.transaction_type === 'game_purchase' && t.status === 'completed')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Monthly earnings
  const last6Months = [...Array(6)].map((_, i) => {
    const month = moment().subtract(i, 'months');
    const monthTransactions = surveyTransactions.filter(t => 
      moment(t.created_date).isSame(month, 'month')
    );
    return {
      month: month.format('MMM'),
      earnings: monthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    };
  }).reverse();

  // Games by category
  const categoryData = ratings.reduce((acc, rating) => {
    const category = rating.category || 'Other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${(user.total_earnings || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-600">Total Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{surveyTransactions.length}</p>
                <p className="text-xs text-gray-600">Surveys Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Gamepad2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{gamesPurchased}</p>
                <p className="text-xs text-gray-600">Games Owned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalSpent.toFixed(2)}</p>
                <p className="text-xs text-gray-600">Total Spent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Earnings Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={last6Months}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="earnings" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Games by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No game data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions.slice(0, 10).map((transaction, index) => (
              <div key={index} className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="font-medium capitalize">
                    {transaction.transaction_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {moment(transaction.created_date).format('MMM D, YYYY')}
                  </p>
                </div>
                <p className={`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                  {transaction.amount > 0 ? '+' : ''}${(transaction.amount || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}