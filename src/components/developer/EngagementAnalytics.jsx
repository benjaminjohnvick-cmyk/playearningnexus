import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock, Users, TrendingUp, Activity } from 'lucide-react';
import moment from 'moment';

export default function EngagementAnalytics({ game }) {
  const { data: engagements = [] } = useQuery({
    queryKey: ['gameEngagement', game.id],
    queryFn: () => base44.entities.GameEngagement.filter({ game_id: game.id }, '-session_start'),
    enabled: !!game
  });

  // Calculate metrics
  const totalSessions = engagements.length;
  const uniqueUsers = [...new Set(engagements.map(e => e.user_id))].length;
  const avgSessionDuration = engagements.length > 0
    ? engagements.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / engagements.length
    : 0;

  // Daily active users (last 30 days)
  const last30Days = [...Array(30)].map((_, i) => {
    const date = moment().subtract(i, 'days');
    const dayEngagements = engagements.filter(e => 
      moment(e.session_start).isSame(date, 'day')
    );
    const dau = [...new Set(dayEngagements.map(e => e.user_id))].length;
    const sessions = dayEngagements.length;
    const avgDuration = sessions > 0 
      ? dayEngagements.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / sessions 
      : 0;

    return {
      date: date.format('MMM D'),
      dau,
      sessions,
      avgDuration: parseFloat(avgDuration.toFixed(1))
    };
  }).reverse();

  // Retention calculation (Day 1, Day 7, Day 30)
  const firstSessionUsers = engagements.reduce((acc, e) => {
    if (!acc[e.user_id] || moment(e.session_start).isBefore(moment(acc[e.user_id]))) {
      acc[e.user_id] = e.session_start;
    }
    return acc;
  }, {});

  const calculateRetention = (days) => {
    let retained = 0;
    let total = 0;

    Object.entries(firstSessionUsers).forEach(([userId, firstSession]) => {
      const daysSinceFirst = moment().diff(moment(firstSession), 'days');
      if (daysSinceFirst >= days) {
        total++;
        const targetDate = moment(firstSession).add(days, 'days');
        const hasSessionOnDay = engagements.some(e => 
          e.user_id === userId && moment(e.session_start).isSame(targetDate, 'day')
        );
        if (hasSessionOnDay) retained++;
      }
    });

    return total > 0 ? ((retained / total) * 100).toFixed(1) : 0;
  };

  const retentionData = [
    { day: 'Day 1', rate: parseFloat(calculateRetention(1)) },
    { day: 'Day 7', rate: parseFloat(calculateRetention(7)) },
    { day: 'Day 30', rate: parseFloat(calculateRetention(30)) }
  ];

  // Feature usage
  const featureUsage = engagements.reduce((acc, e) => {
    (e.features_used || []).forEach(feature => {
      acc[feature] = (acc[feature] || 0) + 1;
    });
    return acc;
  }, {});

  const featureData = Object.entries(featureUsage)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueUsers}</p>
                <p className="text-xs text-gray-600">Unique Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSessions}</p>
                <p className="text-xs text-gray-600">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgSessionDuration.toFixed(1)}</p>
                <p className="text-xs text-gray-600">Avg Session (min)</p>
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
                <p className="text-2xl font-bold">{calculateRetention(1)}%</p>
                <p className="text-xs text-gray-600">Day 1 Retention</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Active Users */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Active Users & Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={last30Days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="dau" stroke="#3b82f6" strokeWidth={2} name="DAU" />
              <Line yAxisId="right" type="monotone" dataKey="avgDuration" stroke="#8b5cf6" strokeWidth={2} name="Avg Duration (min)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Retention Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Retention Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={retentionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="rate" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Feature Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Top Features Used</CardTitle>
          </CardHeader>
          <CardContent>
            {featureData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={featureData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ec4899" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                No feature usage data
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}