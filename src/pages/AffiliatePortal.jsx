import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, Target, Award, BarChart3, Copy } from 'lucide-react';

export default function AffiliatePortal() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch affiliate's referrals
  const { data: referrals = [] } = useQuery({
    queryKey: ['myReferrals'],
    queryFn: async () => {
      if (!user) return [];
      const data = await base44.entities.Referral.filter(
        { created_by: user.email },
        '-created_date',
        500
      );
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000
  });

  // Fetch optimization suggestions
  const { data: optimization = null, isLoading: optimizationLoading } = useQuery({
    queryKey: ['affiliateOptimization'],
    queryFn: async () => {
      const response = await base44.functions.invoke('aiAffiliateOptimizationEngine', {});
      return response.data;
    },
    enabled: !!user,
    refetchInterval: 3600000
  });

  // Calculate metrics
  const conversions = referrals.filter(r => r.status === 'converted');
  const totalEarnings = referrals.reduce((sum, r) => sum + (r.commission_earned || 0), 0);
  const conversionRate = referrals.length > 0 ? ((conversions.length / referrals.length) * 100).toFixed(1) : 0;
  const pendingEarnings = referrals
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + (r.estimated_commission || 0), 0);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Please log in to view your affiliate dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Affiliate Dashboard</h1>
          <p className="text-slate-600">Real-time earnings tracking with AI-powered optimization</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-emerald-200 bg-emerald-50">
            <CardContent className="pt-6">
              <div className="text-sm text-emerald-600 font-semibold mb-1">Total Earnings</div>
              <div className="text-3xl font-bold text-emerald-900">${totalEarnings.toFixed(2)}</div>
              <p className="text-xs text-emerald-700 mt-2">Lifetime commission</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="text-sm text-blue-600 font-semibold mb-1">Pending Earnings</div>
              <div className="text-3xl font-bold text-blue-900">${pendingEarnings.toFixed(2)}</div>
              <p className="text-xs text-blue-700 mt-2">{referrals.filter(r => r.status === 'pending').length} conversions pending</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-slate-600 font-semibold mb-1">Conversions</div>
              <div className="text-3xl font-bold text-slate-900">{conversions.length}</div>
              <p className="text-xs text-slate-500 mt-2">from {referrals.length} total referrals</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-slate-600 font-semibold mb-1">Conversion Rate</div>
              <div className="text-3xl font-bold text-slate-900">{conversionRate}%</div>
              <p className="text-xs text-slate-500 mt-2">Industry avg: 2-5%</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Optimization Suggestions */}
        {optimization && (
          <Card className="mb-8 border-2 border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                AI Optimization Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {optimization.optimization_suggestions?.slice(0, 3).map((suggestion, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-purple-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{suggestion.action}</h4>
                      <Badge className="bg-green-100 text-green-800">
                        +{suggestion.estimated_lift_percent}% lift
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700">{suggestion.reason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Content Performance */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Top Content Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              {optimization?.content_analysis ? (
                <div className="space-y-3">
                  {Object.entries(optimization.content_analysis)
                    .filter(([k]) => !k.startsWith('channel_'))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-700">{type}</span>
                        <Badge>{count} conversions</Badge>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Top Channels */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Best Performing Channels
              </CardTitle>
            </CardHeader>
            <CardContent>
              {optimization?.content_analysis ? (
                <div className="space-y-3">
                  {Object.entries(optimization.content_analysis)
                    .filter(([k]) => k.startsWith('channel_'))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([channel, count]) => (
                      <div key={channel} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-700">
                          {channel.replace('channel_', '')}
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-800">{count}</Badge>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Performance vs Targets */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                Performance Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">Conversion Rate Target</span>
                  <span className="font-bold">{conversionRate}% / 5%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min((parseFloat(conversionRate) / 5) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">Monthly Earnings Goal</span>
                  <span className="font-bold">${(totalEarnings % 1000).toFixed(0)} / $500</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full"
                    style={{ width: `${Math.min(((totalEarnings % 1000) / 500) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Referrals */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Referral Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2 px-4 text-slate-700 font-semibold">Source</th>
                    <th className="text-left py-2 px-4 text-slate-700 font-semibold">Status</th>
                    <th className="text-right py-2 px-4 text-slate-700 font-semibold">Commission</th>
                    <th className="text-left py-2 px-4 text-slate-700 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.slice(0, 10).map((ref) => (
                    <tr key={ref.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-900">{ref.referral_source || 'Direct'}</td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            ref.status === 'converted'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ref.status === 'pending'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-800'
                          }
                        >
                          {ref.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ${(ref.commission_earned || ref.estimated_commission || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {new Date(ref.created_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}