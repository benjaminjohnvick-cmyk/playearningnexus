import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { format, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';

export default function ReferralGrowthChart({ referrals = [] }) {
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
    return days.map(day => {
      const label = format(day, 'MMM d');
      const key = format(day, 'yyyy-MM-dd');
      const newRefs = referrals.filter(r => format(new Date(r.created_date), 'yyyy-MM-dd') === key).length;
      const activeRefs = referrals.filter(r => {
        const created = new Date(r.created_date);
        return created <= day && r.status === 'active';
      }).length;
      return { label, new: newRefs, active: activeRefs };
    });
  }, [referrals]);

  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() });
    return months.map(month => {
      const label = format(month, 'MMM yyyy');
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const newRefs = referrals.filter(r => {
        const d = new Date(r.created_date);
        return d >= start && d <= end;
      }).length;
      const active = referrals.filter(r => {
        const d = new Date(r.created_date);
        return d <= end && r.status === 'active';
      }).length;
      return { label, new: newRefs, active };
    });
  }, [referrals]);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Referral Growth</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="daily">
          <TabsList className="mb-4">
            <TabsTrigger value="daily">Daily (30d)</TabsTrigger>
            <TabsTrigger value="monthly">Monthly (6m)</TabsTrigger>
          </TabsList>
          <TabsContent value="daily">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="newGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="new" name="New Referrals" stroke="#6366f1" fill="url(#newGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="active" name="Active Referrals" stroke="#10b981" fill="url(#activeGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>
          <TabsContent value="monthly">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="new" name="New Referrals" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="active" name="Active Referrals" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}