import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, Eye, Download, Star, Clock } from 'lucide-react';

export default function GamePerformanceAnalytics({ user }) {
  const { data: creatorGames = [] } = useQuery({
    queryKey: ['creator-games', user?.id],
    queryFn: () => base44.entities.Game.filter({ developer_id: user.id }),
    enabled: !!user
  });

  const { data: gameEngagements = [] } = useQuery({
    queryKey: ['game-engagements', user?.id],
    queryFn: async () => {
      if (creatorGames.length === 0) return [];
      const gameIds = creatorGames.map(g => g.id);
      return await base44.entities.GameEngagement.filter({
        game_id: { $in: gameIds }
      });
    },
    enabled: creatorGames.length > 0
  });

  const { data: gameReviews = [] } = useQuery({
    queryKey: ['game-reviews', user?.id],
    queryFn: async () => {
      if (creatorGames.length === 0) return [];
      const gameIds = creatorGames.map(g => g.id);
      return await base44.entities.GameReview.filter({
        game_id: { $in: gameIds }
      });
    },
    enabled: creatorGames.length > 0
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['creator-transactions', user?.id],
    queryFn: () => base44.entities.Transaction.filter({
      business_client_id: user.id
    }),
    enabled: !!user
  });

  // Calculate metrics
  const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalInstalls = creatorGames.reduce((sum, g) => sum + (g.total_installs || 0), 0);
  const totalViews = creatorGames.reduce((sum, g) => sum + (g.view_count || 0), 0);
  const avgRating = gameReviews.length > 0 
    ? gameReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / gameReviews.length 
    : 0;

  // Game performance data
  const gamePerformanceData = creatorGames.map(game => ({
    name: game.title,
    installs: game.total_installs || 0,
    views: game.view_count || 0,
    revenue: transactions.filter(t => t.game_id === game.id).reduce((sum, t) => sum + t.amount, 0),
    rating: gameReviews.filter(r => r.game_id === game.id).reduce((sum, r) => sum + (r.rating || 0), 0) / 
            Math.max(1, gameReviews.filter(r => r.game_id === game.id).length)
  }));

  // User engagement over time (last 30 days)
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date.toISOString().split('T')[0];
  });

  const engagementOverTime = last30Days.map(date => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sessions: gameEngagements.filter(e => e.created_date?.startsWith(date)).length,
    revenue: transactions.filter(t => t.created_date?.startsWith(date)).reduce((sum, t) => sum + t.amount, 0)
  }));

  // Revenue breakdown by game
  const revenueByGame = creatorGames.map(game => ({
    name: game.title,
    value: transactions.filter(t => t.game_id === game.id).reduce((sum, t) => sum + t.amount, 0)
  })).filter(g => g.value > 0);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Installs</p>
                <p className="text-2xl font-bold text-blue-600">{totalInstalls}</p>
              </div>
              <Download className="w-8 h-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-purple-600">{totalViews}</p>
              </div>
              <Eye className="w-8 h-8 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Rating</p>
                <p className="text-2xl font-bold text-yellow-600">{avgRating.toFixed(1)}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Game Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={gamePerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="installs" fill="#3b82f6" name="Installs" />
                  <Bar yAxisId="left" dataKey="views" fill="#8b5cf6" name="Views" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement">
          <Card>
            <CardHeader>
              <CardTitle>User Engagement (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={engagementOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={2} name="Sessions" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={revenueByGame}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={entry => `${entry.name}: $${entry.value.toFixed(0)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {revenueByGame.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={engagementOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue ($)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="detailed">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Game Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {creatorGames.map(game => {
                  const gameRevenue = transactions.filter(t => t.game_id === game.id).reduce((sum, t) => sum + t.amount, 0);
                  const gameReviewsCount = gameReviews.filter(r => r.game_id === game.id).length;
                  const gameAvgRating = gameReviewsCount > 0 
                    ? gameReviews.filter(r => r.game_id === game.id).reduce((sum, r) => sum + (r.rating || 0), 0) / gameReviewsCount
                    : 0;

                  return (
                    <div key={game.id} className="p-4 border rounded-lg bg-gradient-to-r from-gray-50 to-white">
                      <h3 className="font-semibold text-lg mb-3">{game.title}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Installs</p>
                          <p className="text-xl font-bold text-blue-600">{game.total_installs || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Views</p>
                          <p className="text-xl font-bold text-purple-600">{game.view_count || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Revenue</p>
                          <p className="text-xl font-bold text-green-600">${gameRevenue.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Reviews</p>
                          <p className="text-xl font-bold text-orange-600">{gameReviewsCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Rating</p>
                          <p className="text-xl font-bold text-yellow-600">{gameAvgRating.toFixed(1)} ⭐</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}