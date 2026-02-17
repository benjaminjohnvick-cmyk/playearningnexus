import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, Star } from 'lucide-react';

export default function CreatorAnalytics({ user }) {
  // Fetch subscriber growth data
  const { data: subscriberGrowth = [] } = useQuery({
    queryKey: ['subscriberGrowth', user?.id],
    queryFn: async () => {
      const subs = await base44.entities.StreamerSubscription.filter({ streamer_user_id: user.id });
      const monthlyData = {};
      
      subs.forEach(sub => {
        const month = new Date(sub.start_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthlyData[month] = (monthlyData[month] || 0) + 1;
      });
      
      return Object.entries(monthlyData).map(([month, count]) => ({ month, subscribers: count }));
    },
    enabled: !!user
  });

  // Fetch tip patterns
  const { data: tipData = [] } = useQuery({
    queryKey: ['tipPatterns', user?.id],
    queryFn: async () => {
      const tips = await base44.entities.StreamerTip.filter({ streamer_user_id: user.id });
      const dailyTips = {};
      
      tips.forEach(tip => {
        const day = new Date(tip.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const amount = tip.currency === 'USD' ? tip.amount : tip.amount * 0.01;
        dailyTips[day] = (dailyTips[day] || 0) + amount;
      });
      
      return Object.entries(dailyTips).map(([day, amount]) => ({ day, amount: parseFloat(amount.toFixed(2)) })).slice(-14);
    },
    enabled: !!user
  });

  // Fetch sponsored content performance
  const { data: sponsoredPerformance = [] } = useQuery({
    queryKey: ['sponsoredPerformance', user?.id],
    queryFn: async () => {
      const content = await base44.entities.SponsoredContent.filter({ creator_user_id: user.id });
      return content.map(c => ({
        title: c.title.substring(0, 20) + '...',
        views: c.views,
        engagement: c.engagement_rate,
        earnings: c.agreed_price + (c.performance_bonus || 0)
      }));
    },
    enabled: !!user
  });

  // Fetch subscription tier distribution
  const { data: tierDistribution = [] } = useQuery({
    queryKey: ['tierDistribution', user?.id],
    queryFn: async () => {
      const tiers = await base44.entities.CreatorSubscriptionTier.filter({ creator_user_id: user.id });
      return tiers.map(t => ({
        name: t.tier_name,
        value: t.subscriber_count,
        revenue: t.subscriber_count * t.price_monthly
      }));
    },
    enabled: !!user
  });

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
        <TabsTrigger value="revenue">Revenue</TabsTrigger>
        <TabsTrigger value="content">Content</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Subscriber Growth (Last 6 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={subscriberGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="subscribers" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Tip Patterns (Last 14 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tipData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="amount" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Subscribers Tab */}
      <TabsContent value="subscribers" className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Subscription Tier Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={tierDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={entry => entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {tierDistribution.map((entry, index) => (
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
              <CardTitle>Tier Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tierDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#3b82f6" name="Subscribers" />
                  <Bar dataKey="revenue" fill="#10b981" name="Monthly Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Revenue Tab */}
      <TabsContent value="revenue" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Daily Tips (Last 14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={tipData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Content Tab */}
      <TabsContent value="content" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Sponsored Content Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={sponsoredPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="views" fill="#3b82f6" name="Views" />
                <Bar yAxisId="left" dataKey="engagement" fill="#ec4899" name="Engagement %" />
                <Bar yAxisId="right" dataKey="earnings" fill="#10b981" name="Earnings ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}