import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, Eye, Clock, Gift, Crown, Heart, MapPin } from 'lucide-react';

export default function StreamerAnalytics() {
  const [user, setUser] = useState(null);
  const [dateRange, setDateRange] = useState('week');

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: streamSessions = [] } = useQuery({
    queryKey: ['streamSessions', user?.id],
    queryFn: () => base44.entities.StreamSession.filter({ streamer_id: user.id }, '-start_time'),
    enabled: !!user
  });

  const { data: tips = [] } = useQuery({
    queryKey: ['streamerTips', user?.id],
    queryFn: () => base44.entities.StreamerTip.filter({ streamer_user_id: user.id }),
    enabled: !!user
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['streamerSubs', user?.id],
    queryFn: () => base44.entities.StreamerSubscription.filter({ streamer_user_id: user.id }),
    enabled: !!user
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ['streamerGifts', user?.id],
    queryFn: () => base44.entities.GiftTransaction.filter({ recipient_id: user.id }),
    enabled: !!user
  });

  const { data: spectators = [] } = useQuery({
    queryKey: ['spectatorData', user?.id],
    queryFn: () => base44.entities.GameEngagement.filter({ 
      session_type: 'spectating'
    }),
    enabled: !!user
  });

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>;
  }

  // Calculate metrics
  const totalTips = tips.reduce((sum, t) => sum + (t.currency === 'USD' ? t.amount : t.amount / 100), 0);
  const totalGifts = gifts.reduce((sum, g) => sum + (g.cost / 100), 0);
  const activeSubscriptions = subscriptions.filter(s => s.is_active);
  const monthlySubRevenue = activeSubscriptions.reduce((sum, s) => sum + s.price_monthly, 0);

  const tierBreakdown = activeSubscriptions.reduce((acc, s) => {
    acc[s.tier] = (acc[s.tier] || 0) + 1;
    return acc;
  }, {});

  const tierData = Object.entries(tierBreakdown).map(([tier, count]) => ({
    name: tier,
    value: count
  }));

  const revenueData = streamSessions.slice(0, 7).reverse().map(session => ({
    date: new Date(session.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: session.total_views,
    peakViewers: session.peak_viewers
  }));

  const avgWatchTime = spectators.length > 0 
    ? spectators.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / spectators.length 
    : 0;

  const subscriberGrowth = subscriptions
    .filter(s => new Date(s.start_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .length;

  const subscriberChurn = subscriptions
    .filter(s => !s.is_active && new Date(s.end_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .length;

  const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Streamer Analytics</h1>
          <p className="text-gray-600">Track your performance and revenue metrics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">${(totalTips + totalGifts + monthlySubRevenue).toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Subscribers</p>
                  <p className="text-2xl font-bold text-purple-600">{activeSubscriptions.length}</p>
                </div>
                <Crown className="w-8 h-8 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Tips</p>
                  <p className="text-2xl font-bold text-pink-600">{tips.length}</p>
                </div>
                <Heart className="w-8 h-8 text-pink-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Watch Time</p>
                  <p className="text-2xl font-bold text-blue-600">{avgWatchTime.toFixed(0)}m</p>
                </div>
                <Clock className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="engagement" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="monetization">Monetization</TabsTrigger>
            <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
          </TabsList>

          <TabsContent value="engagement" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Viewer Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="peakViewers" stroke="#8b5cf6" name="Peak Viewers" />
                    <Line type="monotone" dataKey="views" stroke="#3b82f6" name="Total Views" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">Peak Viewers</p>
                  <p className="text-3xl font-bold">{Math.max(...streamSessions.map(s => s.peak_viewers || 0))}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">Total Streams</p>
                  <p className="text-3xl font-bold">{streamSessions.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">Avg Viewers</p>
                  <p className="text-3xl font-bold">
                    {(streamSessions.reduce((sum, s) => sum + (s.peak_viewers || 0), 0) / streamSessions.length || 0).toFixed(0)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monetization" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tips Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-pink-600">${totalTips.toFixed(2)}</p>
                  <p className="text-sm text-gray-600 mt-1">{tips.length} tips received</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Subscription Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-purple-600">${monthlySubRevenue.toFixed(2)}/mo</p>
                  <p className="text-sm text-gray-600 mt-1">{activeSubscriptions.length} active subs</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gifts Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-600">${totalGifts.toFixed(2)}</p>
                  <p className="text-sm text-gray-600 mt-1">{gifts.length} gifts received</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Tips', value: totalTips },
                            { name: 'Subscriptions', value: monthlySubRevenue },
                            { name: 'Gifts', value: totalGifts }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[0, 1, 2].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                      <span className="font-medium">Tips</span>
                      <span className="font-bold">${totalTips.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="font-medium">Subscriptions</span>
                      <span className="font-bold">${monthlySubRevenue.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="font-medium">Gifts</span>
                      <span className="font-bold">${totalGifts.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscribers" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Subscriber Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <TrendingUp className="w-12 h-12 text-green-600" />
                    <div>
                      <p className="text-3xl font-bold text-green-600">+{subscriberGrowth}</p>
                      <p className="text-sm text-gray-600">New subscribers (30 days)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subscriber Churn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Users className="w-12 h-12 text-red-600" />
                    <div>
                      <p className="text-3xl font-bold text-red-600">{subscriberChurn}</p>
                      <p className="text-sm text-gray-600">Cancelled (30 days)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Tiers</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tierData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="demographics">
            <Card>
              <CardHeader>
                <CardTitle>Audience Demographics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Demographic data coming soon</p>
                  <p className="text-sm mt-2">Track viewer locations, age groups, and preferences</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}