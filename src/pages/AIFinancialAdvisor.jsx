import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, Target, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AIFinancialAdvisor() {
  const [user, setUser] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
  }, []);

  const { data: payoutHistory = [] } = useQuery({
    queryKey: ['payoutHistory', user?.id],
    queryFn: () => user ? base44.entities.Payout.filter({ recipient_id: user.id }, '-completed_date', 20) : [],
    enabled: !!user
  });

  const { data: payoutRecommendations = [] } = useQuery({
    queryKey: ['payoutRecommendations', user?.id],
    queryFn: () => user ? base44.entities.PayoutRecommendation.filter({ user_id: user.id }, '-recommended_date', 5) : [],
    enabled: !!user
  });

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: () => user ? base44.entities.ProductWishlistItem.filter({ user_id: user.id }) : [],
    enabled: !!user
  });

  // Generate AI advice on optimal payout schedule
  useEffect(() => {
    if (payoutHistory.length > 0 && payoutRecommendations.length > 0 && user) {
      const generateAdvice = async () => {
        try {
          const response = await base44.integrations.Core.InvokeLLM({
            prompt: `Analyze this user's financial data and provide personalized payout advice:
            
Payout History (last 20): ${JSON.stringify(payoutHistory.slice(0, 5))}
Recommended Payout Schedule: ${JSON.stringify(payoutRecommendations[0])}
Wishlist Items: ${wishlistItems.length} items worth $${wishlistItems.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2)}
Current Earnings: $${user.total_earnings?.toFixed(2) || 0}

Provide:
1. Optimal payout frequency recommendation
2. Best days to request payouts (based on earning velocity)
3. Savings targets for wishlist items
4. Risk warnings if applicable
5. Quick wins to maximize earnings

Keep response conversational and actionable.`,
            response_json_schema: {
              type: 'object',
              properties: {
                frequency_recommendation: { type: 'string' },
                best_payout_days: { type: 'array', items: { type: 'string' } },
                savings_targets: { type: 'array', items: { type: 'object' } },
                risk_warnings: { type: 'array', items: { type: 'string' } },
                quick_wins: { type: 'array', items: { type: 'string' } },
                overall_score: { type: 'number', minimum: 0, maximum: 100 }
              }
            }
          });

          setAdvice(response);
        } catch (error) {
          console.error('AI advice generation failed:', error);
        } finally {
          setLoading(false);
        }
      };

      generateAdvice();
    }
  }, [payoutHistory, payoutRecommendations, user, wishlistItems]);

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  // Calculate earning velocity
  const last30Days = payoutHistory.filter(p => 
    new Date(p.completed_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const velocity = last30Days.reduce((sum, p) => sum + p.amount, 0) / 30;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">💰 AI Financial Advisor</h1>
          <p className="text-slate-600">Personalized payout optimization & earnings strategy</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">${user.total_earnings?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-slate-500 mt-1">All-time earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Daily Velocity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">${velocity.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">Last 30 days average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Wishlist Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">${wishlistItems.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{wishlistItems.length} items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Financial Health</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-600">{advice?.overall_score || '--'}%</p>
              <p className="text-xs text-slate-500 mt-1">Optimization score</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Recommendations */}
        {advice && (
          <div className="space-y-6">
            {/* Frequency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Optimal Payout Frequency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-slate-900 mb-2">{advice.frequency_recommendation}</p>
                <p className="text-slate-600">Based on your earning velocity and recent payout patterns, this frequency maximizes your returns while minimizing platform fees.</p>
              </CardContent>
            </Card>

            {/* Best Payout Days */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Best Days to Request Payouts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {advice.best_payout_days?.map(day => (
                    <Badge key={day} variant="outline" className="bg-blue-50">{day}</Badge>
                  ))}
                </div>
                <p className="text-sm text-slate-600">Request payouts on these days to align with peak earning cycles and avoid processing delays.</p>
              </CardContent>
            </Card>

            {/* Savings Targets */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Savings Targets for Wishlist Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {advice.savings_targets?.map((target, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">{target.item_name}</p>
                        <p className="text-xs text-slate-600">Target: ${target.target_amount}</p>
                      </div>
                      <Badge>{Math.round((target.current_progress || 0) / target.target_amount * 100)}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Warnings */}
            {advice.risk_warnings?.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-900">
                    <AlertCircle className="w-5 h-5" />
                    Risk Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {advice.risk_warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-yellow-800 flex gap-2">
                        <span className="text-yellow-600">⚠️</span> {warning}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Quick Wins */}
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <CheckCircle2 className="w-5 h-5" />
                  Quick Wins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {advice.quick_wins?.map((win, idx) => (
                    <li key={idx} className="text-sm text-green-800 flex gap-2">
                      <span className="text-green-600">✓</span> {win}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Earnings Chart */}
        {payoutHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Earnings History</CardTitle>
              <CardDescription>Your payout amounts over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={payoutHistory.slice(0, 10).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="completed_date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}