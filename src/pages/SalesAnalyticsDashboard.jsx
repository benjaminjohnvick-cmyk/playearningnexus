import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, ShoppingCart, DollarSign, Users, Package, Loader2, RefreshCw, Brain, Star } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

export default function SalesAnalyticsDashboard() {
  const [user, setUser] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: orders = [], isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['all-transactions'],
    queryFn: () => base44.entities.PPCTransaction.list('-created_date', 200),
    enabled: !!user,
  });

  // Compute analytics
  const totalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const totalServiceFee = orders.reduce((s, o) => s + (o.amount || 0) * (1 / 11), 0); // 10% on base
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Category breakdown from notes/product names
  const categoryMap = {};
  orders.forEach(o => {
    const cat = o.product_type || 'other';
    categoryMap[cat] = (categoryMap[cat] || 0) + (o.amount || 0);
  });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  // Daily orders (last 7 days)
  const dailyMap = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dailyMap[key] = 0;
  }
  orders.forEach(o => {
    const d = new Date(o.created_date || o.requested_at);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (key in dailyMap) dailyMap[key] = (dailyMap[key] || 0) + (o.amount || 0);
  });
  const dailyData = Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue: parseFloat(revenue.toFixed(2)) }));

  // Top products
  const productMap = {};
  orders.forEach(o => {
    const name = o.product_name || 'Unknown';
    if (!productMap[name]) productMap[name] = { name, count: 0, revenue: 0 };
    productMap[name].count++;
    productMap[name].revenue += (o.amount || 0);
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Top buyers
  const buyerMap = {};
  orders.forEach(o => {
    if (!buyerMap[o.user_id]) buyerMap[o.user_id] = { userId: o.user_id, count: 0, spent: 0 };
    buyerMap[o.user_id].count++;
    buyerMap[o.user_id].spent += (o.amount || 0);
  });
  const topBuyers = Object.values(buyerMap).sort((a, b) => b.spent - a.spent).slice(0, 5);

  const generateAIInsights = async () => {
    if (ordersLoading || orders.length === 0) {
      toast.info('No order data to analyze yet');
      return;
    }
    setLoadingInsights(true);
    try {
      const summary = {
        total_orders: totalOrders,
        total_revenue: totalRevenue.toFixed(2),
        total_service_fee_profit: totalServiceFee.toFixed(2),
        avg_order_value: avgOrderValue.toFixed(2),
        top_products: topProducts.slice(0, 3).map(p => `${p.name} (${p.count} orders, $${p.revenue.toFixed(2)})`),
        categories: categoryData.map(c => `${c.name}: $${c.value}`),
        recent_trend: dailyData.slice(-3).map(d => `${d.date}: $${d.revenue}`),
      };

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a sales analytics AI for GamerGain platform. Analyze this sales data and provide insights:

${JSON.stringify(summary, null, 2)}

Provide:
1. Key insights about what's selling well
2. Products/categories to advertise more
3. 3-5 specific product ideas to create based on demand signals
4. Revenue optimization recommendations
5. User behavior patterns
6. Next month revenue prediction

Be specific and actionable.`,
        response_json_schema: {
          type: 'object',
          properties: {
            key_insights: { type: 'array', items: { type: 'string' } },
            advertise_more: { type: 'array', items: { type: 'string' } },
            product_ideas: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, rationale: { type: 'string' }, estimated_demand: { type: 'string' } } } },
            revenue_recommendations: { type: 'array', items: { type: 'string' } },
            user_behavior: { type: 'string' },
            revenue_prediction: { type: 'string' },
          }
        }
      });
      setAiInsights(res);
    } catch (e) {
      toast.error('Failed to generate AI insights');
    }
    setLoadingInsights(false);
  };

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-purple-600" /> Sales Analytics
            </h1>
            <p className="text-gray-500 mt-1">AI-powered sales intelligence — individual & group level</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700" size="sm" onClick={generateAIInsights} disabled={loadingInsights}>
              {loadingInsights ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Brain className="w-4 h-4 mr-1" />}
              AI Insights
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'from-green-500 to-emerald-600' },
            { label: 'Service Fee Profit', value: `$${totalServiceFee.toFixed(2)}`, icon: TrendingUp, color: 'from-purple-500 to-violet-600' },
            { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'from-blue-500 to-cyan-600' },
            { label: 'Avg Order Value', value: `$${avgOrderValue.toFixed(2)}`, icon: Package, color: 'from-orange-500 to-red-500' },
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="border-0 shadow-md overflow-hidden">
                <div className={`bg-gradient-to-br ${kpi.color} p-4 text-white`}>
                  <kpi.icon className="w-6 h-6 opacity-80 mb-2" />
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-sm opacity-90">{kpi.label}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-700">Revenue Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.some(d => d.revenue > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
                    <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No revenue data yet</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-700">Sales by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No category data yet</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Products + AI Insights */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Star className="w-4 h-4 text-yellow-500" /> Top Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-600">{i + 1}</div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.count} orders</p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700">${p.revenue.toFixed(2)}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">No orders yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Users className="w-4 h-4 text-blue-500" /> Top Buyers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topBuyers.length > 0 ? (
                <div className="space-y-3">
                  {topBuyers.map((b, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">{i + 1}</div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">User #{b.userId.slice(-6)}</p>
                          <p className="text-xs text-gray-500">{b.count} orders</p>
                        </div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700">${b.spent.toFixed(2)}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">No buyer data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {aiInsights && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-800">
                  <Brain className="w-5 h-5" /> AI Sales Intelligence Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiInsights.key_insights?.length > 0 && (
                  <div>
                    <p className="font-semibold text-sm text-gray-800 mb-2">📊 Key Insights</p>
                    <ul className="space-y-1">
                      {aiInsights.key_insights.map((insight, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-purple-500 mt-1">•</span> {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiInsights.product_ideas?.length > 0 && (
                  <div>
                    <p className="font-semibold text-sm text-gray-800 mb-2">💡 Product Ideas to Create</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {aiInsights.product_ideas.map((idea, i) => (
                        <div key={i} className="bg-white rounded-lg p-3 border border-purple-200">
                          <p className="font-semibold text-sm text-purple-900">{idea.name}</p>
                          <p className="text-xs text-gray-600">{idea.rationale}</p>
                          <Badge className="mt-1 bg-purple-100 text-purple-700 text-xs">{idea.estimated_demand}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiInsights.revenue_prediction && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="font-semibold text-sm text-green-800">📈 Revenue Prediction</p>
                    <p className="text-sm text-green-700 mt-1">{aiInsights.revenue_prediction}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}