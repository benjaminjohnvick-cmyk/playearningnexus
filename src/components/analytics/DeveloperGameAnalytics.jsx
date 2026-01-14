import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Star, 
  Download,
  Brain,
  Target,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function DeveloperGameAnalytics({ game, developerId }) {
  const { data: transactions = [] } = useQuery({
    queryKey: ['gameTransactions', game.id],
    queryFn: async () => {
      const all = await base44.entities.Transaction.list();
      return all.filter(t => t.game_id === game.id);
    }
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['gameRatings', game.id],
    queryFn: () => base44.entities.GameRating.filter({ game_id: game.id })
  });

  const { data: automatedPayments = [] } = useQuery({
    queryKey: ['gamePayments', game.id],
    queryFn: () => base44.entities.AutomatedPayment.filter({ game_id: game.id })
  });

  // Analytics Calculations
  const totalInstalls = game.total_installs || 0;
  const avgRating = ratings.length > 0 
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
    : 0;
  const totalRevenue = automatedPayments.reduce((sum, p) => sum + (p.amount_owed || 0), 0);
  const activeUsers = automatedPayments.filter(p => p.days_since_install <= 30).length;
  
  // Retention metrics
  const retention7Day = automatedPayments.filter(p => p.days_since_install >= 7).length;
  const retention30Day = automatedPayments.filter(p => p.days_since_install >= 30).length;
  const retentionRate = totalInstalls > 0 ? (retention30Day / totalInstalls * 100).toFixed(1) : 0;

  // AI Insights
  const sentimentScore = avgRating / 5; // 0-1 scale
  const churnRisk = retentionRate < 30 ? 'high' : retentionRate < 60 ? 'medium' : 'low';
  const growthTrend = totalInstalls > 100 ? 'growing' : 'early';

  // Revenue forecast (simple projection)
  const avgRevenuePerUser = totalInstalls > 0 ? totalRevenue / totalInstalls : 0;
  const projectedRevenue = avgRevenuePerUser * totalInstalls * 1.2; // 20% growth projection

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Download className="w-8 h-8 text-blue-600" />
                <Badge className="bg-blue-600">Installs</Badge>
              </div>
              <p className="text-3xl font-bold text-blue-700">{totalInstalls}</p>
              <p className="text-sm text-gray-600 mt-1">Total downloads</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-green-600" />
                <Badge className="bg-green-600">Active</Badge>
              </div>
              <p className="text-3xl font-bold text-green-700">{activeUsers}</p>
              <p className="text-sm text-gray-600 mt-1">30-day active users</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-2 border-yellow-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Star className="w-8 h-8 text-yellow-600" />
                <Badge className="bg-yellow-600">Rating</Badge>
              </div>
              <p className="text-3xl font-bold text-yellow-700">{avgRating.toFixed(1)}/5</p>
              <p className="text-sm text-gray-600 mt-1">{ratings.length} reviews</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-2 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-purple-600" />
                <Badge className="bg-purple-600">Revenue</Badge>
              </div>
              <p className="text-3xl font-bold text-purple-700">${totalRevenue.toFixed(2)}</p>
              <p className="text-sm text-gray-600 mt-1">Total earnings</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* AI Insights */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            AI-Driven Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold">User Sentiment</h4>
              </div>
              <p className="text-2xl font-bold text-blue-700 mb-1">
                {(sentimentScore * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-gray-600">
                {sentimentScore > 0.8 ? 'Very Positive' : sentimentScore > 0.6 ? 'Positive' : 'Needs Improvement'}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h4 className="font-bold">Growth Trend</h4>
              </div>
              <p className="text-2xl font-bold text-green-700 mb-1 capitalize">{growthTrend}</p>
              <p className="text-sm text-gray-600">
                {growthTrend === 'growing' ? 'Strong momentum' : 'Building audience'}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className={`w-5 h-5 ${churnRisk === 'high' ? 'text-red-600' : churnRisk === 'medium' ? 'text-amber-600' : 'text-green-600'}`} />
                <h4 className="font-bold">Churn Risk</h4>
              </div>
              <p className={`text-2xl font-bold mb-1 capitalize ${churnRisk === 'high' ? 'text-red-700' : churnRisk === 'medium' ? 'text-amber-700' : 'text-green-700'}`}>
                {churnRisk}
              </p>
              <p className="text-sm text-gray-600">{retentionRate}% 30-day retention</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border">
            <h4 className="font-bold mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-600" />
              AI Recommendations
            </h4>
            <ul className="space-y-2 text-sm">
              {avgRating < 4 && (
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-600 mt-1.5" />
                  <span>Address user feedback to improve ratings - focus on common complaints in reviews</span>
                </li>
              )}
              {retentionRate < 50 && (
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5" />
                  <span>Improve retention with personalized challenges and rewards for returning players</span>
                </li>
              )}
              {totalInstalls < 500 && (
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
                  <span>Consider running a marketing campaign to increase visibility and installs</span>
                </li>
              )}
              {avgRevenuePerUser < 5 && (
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5" />
                  <span>Optimize monetization with A/B testing on pricing and in-app purchase placement</span>
                </li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="engagement">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement">
          <Card>
            <CardHeader>
              <CardTitle>User Engagement Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium">Total Installs</span>
                  <span className="text-2xl font-bold text-blue-600">{totalInstalls}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium">30-Day Active Users</span>
                  <span className="text-2xl font-bold text-green-600">{activeUsers}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium">7-Day Retention</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {totalInstalls > 0 ? ((retention7Day / totalInstalls) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium">30-Day Retention</span>
                  <span className="text-2xl font-bold text-amber-600">{retentionRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium">Total Revenue</span>
                  <span className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium">Avg Revenue Per User</span>
                  <span className="text-2xl font-bold text-blue-600">${avgRevenuePerUser.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium">Projected Revenue (90 days)</span>
                  <span className="text-2xl font-bold text-purple-600">${projectedRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <span className="font-medium">Revenue Growth Potential</span>
                  <span className="text-2xl font-bold text-green-700">+20%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>User Reviews & Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-yellow-600">{avgRating.toFixed(1)}</p>
                    <div className="flex mt-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${star <= avgRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{ratings.length} reviews</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = ratings.filter(r => r.rating === star).length;
                      const percentage = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-sm w-6">{star}★</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-yellow-400 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {ratings.slice(0, 5).map(rating => (
                  <div key={rating.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${star <= rating.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(rating.created_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{rating.review}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}