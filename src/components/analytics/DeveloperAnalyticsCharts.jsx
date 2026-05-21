import React from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, Zap } from 'lucide-react';

export const PayoutTrendsChart = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <DollarSign className="w-5 h-5" />
        Payout Trends
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip formatter={(value) => `$${value}`} />
          <Legend />
          <Line type="monotone" dataKey="payouts" stroke="#10b981" strokeWidth={2} name="Total Payouts" />
          <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="Pending Payouts" />
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

export const ReferralSuccessChart = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Users className="w-5 h-5" />
        Referral Success Rate
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => `${value}%`} />
          <Legend />
          <Bar dataKey="conversionRate" fill="#3b82f6" name="Conversion Rate (%)" />
          <Bar dataKey="referralCount" fill="#8b5cf6" name="Referral Count" />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

export const EngagementMetricsChart = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Zap className="w-5 h-5" />
        User Engagement Metrics
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="activeUsers" stroke="#06b6d4" strokeWidth={2} name="Active Users" />
          <Line type="monotone" dataKey="sessionDuration" stroke="#ec4899" strokeWidth={2} name="Avg Session (min)" />
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

export const PlatformHealthChart = ({ data }) => {
  const colors = ['#10b981', '#f59e0b', '#ef4444'];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Platform Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value}%`} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export const GameCategoryBreakdownChart = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle>Revenue by Game Category</CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="category" type="category" width={100} />
          <Tooltip formatter={(value) => `$${value}`} />
          <Bar dataKey="revenue" fill="#6366f1" name="Revenue" />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);