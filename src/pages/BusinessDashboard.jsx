import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity, Zap, Target } from 'lucide-react';
import GamePerformanceMetrics from '../components/developer/GamePerformanceMetrics';

export default function BusinessDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState([
    { month: 'Jan', revenue: 4000, target: 3500 },
    { month: 'Feb', revenue: 5200, target: 3800 },
    { month: 'Mar', revenue: 4800, target: 4000 },
    { month: 'Apr', revenue: 6100, target: 4500 },
    { month: 'May', revenue: 7200, target: 5000 },
  ]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <div className="p-8 text-center">Please log in to access the dashboard.</div>;

  const metrics = [
    { title: 'Total Revenue', value: '$28.3K', icon: DollarSign, change: '+12.5%' },
    { title: 'Active Users', value: '1,247', icon: Users, change: '+8.2%' },
    { title: 'Engagement Rate', value: '64.3%', icon: Activity, change: '+3.1%' },
    { title: 'Conversion Rate', value: '3.8%', icon: Target, change: '+1.2%' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Business Dashboard</h1>
          <p className="text-slate-600">AI-powered analytics and insights for your platform</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <Card key={idx} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">{metric.title}</CardTitle>
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900 mb-1">{metric.value}</div>
                  <p className="text-xs text-green-600 font-semibold">{metric.change} from last month</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="game-metrics">🎮 Game Metrics</TabsTrigger>
            <TabsTrigger value="ai-optimization">AI Optimization</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Monthly revenue vs targets</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#e2e8f0' }} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="target" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Game Metrics Tab */}
          <TabsContent value="game-metrics">
            <GamePerformanceMetrics user={user} />
          </TabsContent>

          {/* AI Optimization Tab */}
          <TabsContent value="ai-optimization" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Optimization Recommendations
                  </CardTitle>
                  <CardDescription>AI-powered suggestions to boost performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-1">Price Optimization</h4>
                    <p className="text-sm text-blue-700">AI suggests a 5-8% price increase could improve margins without affecting conversion.</p>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-1">User Engagement</h4>
                    <p className="text-sm text-green-700">Increase notification frequency by 30% to boost daily active users.</p>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h4 className="font-semibold text-purple-900 mb-1">Content Strategy</h4>
                    <p className="text-sm text-purple-700">Focus on educational content - it drives 2.3x higher engagement than promotional.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Performance Score</CardTitle>
                  <CardDescription>AI-calculated business health</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">Overall Score</span>
                      <span className="font-bold text-lg text-blue-600">78/100</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: '78%' }}></div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Revenue Growth</span>
                      <span className="font-semibold text-slate-900">92%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">User Retention</span>
                      <span className="font-semibold text-slate-900">76%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Conversion Efficiency</span>
                      <span className="font-semibold text-slate-900">64%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Predictive Analytics</CardTitle>
                <CardDescription>AI forecasts for the next 3 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#e2e8f0' }} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 5 }} />
                    <Line type="monotone" dataKey="target" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>User Behavior Analysis</CardTitle>
                  <CardDescription>How users interact with your platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Average Session Duration</span>
                      <span className="font-semibold">4m 32s</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Pages per Session</span>
                      <span className="font-semibold">5.2</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Bounce Rate</span>
                      <span className="font-semibold">28%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Return Users</span>
                      <span className="font-semibold">62%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Traffic Sources</CardTitle>
                  <CardDescription>Where users come from</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Direct', value: 35 },
                          { name: 'Organic', value: 28 },
                          { name: 'Referral', value: 22 },
                          { name: 'Social', value: 15 },
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}