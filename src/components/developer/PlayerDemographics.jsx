import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, DollarSign, Target } from 'lucide-react';
import moment from 'moment';

export default function PlayerDemographics({ game }) {
  const { data: transactions = [] } = useQuery({
    queryKey: ['gameTransactions', game.id],
    queryFn: () => base44.entities.Transaction.filter({ game_id: game.id }),
    enabled: !!game
  });

  const { data: engagements = [] } = useQuery({
    queryKey: ['gameEngagement', game.id],
    queryFn: () => base44.entities.GameEngagement.filter({ game_id: game.id }),
    enabled: !!game
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list()
  });

  // Get unique players
  const playerIds = [...new Set([
    ...transactions.map(t => t.user_id),
    ...engagements.map(e => e.user_id)
  ])];

  const players = allUsers.filter(u => playerIds.includes(u.id));

  // User segmentation by spending
  const userSegments = players.reduce((acc, user) => {
    const spent = transactions
      .filter(t => t.user_id === user.id && t.status === 'completed')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    let segment;
    if (spent === 0) segment = 'Free';
    else if (spent < 10) segment = 'Minnow';
    else if (spent < 50) segment = 'Dolphin';
    else segment = 'Whale';

    acc[segment] = (acc[segment] || 0) + 1;
    return acc;
  }, {});

  const segmentData = Object.entries(userSegments).map(([name, value]) => ({ name, value }));

  // Session type distribution
  const sessionTypes = engagements.reduce((acc, e) => {
    acc[e.session_type || 'organic'] = (acc[e.session_type || 'organic'] || 0) + 1;
    return acc;
  }, {});

  const sessionData = Object.entries(sessionTypes).map(([name, value]) => ({ 
    name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
    value 
  }));

  // Player lifetime value
  const playerLTV = players.map(user => {
    const spent = transactions
      .filter(t => t.user_id === user.id && t.status === 'completed')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return spent;
  });

  const avgLTV = playerLTV.length > 0 
    ? playerLTV.reduce((sum, v) => sum + v, 0) / playerLTV.length 
    : 0;

  // Cohort analysis (by signup month)
  const cohortData = players.reduce((acc, user) => {
    const month = moment(user.created_date).format('MMM YYYY');
    if (!acc[month]) {
      acc[month] = { month, users: 0, revenue: 0 };
    }
    acc[month].users++;
    acc[month].revenue += transactions
      .filter(t => t.user_id === user.id && t.status === 'completed')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return acc;
  }, {});

  const cohortArray = Object.values(cohortData)
    .sort((a, b) => moment(a.month, 'MMM YYYY').diff(moment(b.month, 'MMM YYYY')))
    .slice(-12);

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Key Demographics */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{players.length}</p>
                <p className="text-xs text-gray-600">Total Players</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${avgLTV.toFixed(2)}</p>
                <p className="text-xs text-gray-600">Avg Lifetime Value</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {((players.filter(p => {
                    const spent = transactions
                      .filter(t => t.user_id === p.id && t.status === 'completed')
                      .reduce((sum, t) => sum + (t.amount || 0), 0);
                    return spent > 0;
                  }).length / players.length) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-600">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* User Segments */}
        <Card>
          <CardHeader>
            <CardTitle>Player Segments by Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={segmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Session Types */}
        <Card>
          <CardHeader>
            <CardTitle>Session Acquisition Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sessionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sessionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cohort Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Cohorts</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cohortArray}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="users" fill="#3b82f6" name="New Users" />
              <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue ($)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}