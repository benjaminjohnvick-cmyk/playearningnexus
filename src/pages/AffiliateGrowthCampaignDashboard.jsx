import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, Users, CheckCircle, RefreshCw } from 'lucide-react';

export default function AffiliateGrowthCampaignDashboard() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Run enrollment
  const enrollMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('identifyAndEnrollUnderperformers', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growthCampaigns'] });
    }
  });

  // Send sequences
  const sequenceMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('sendGrowthCampaignSequence', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growthCampaigns'] });
    }
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['growthCampaigns'],
    queryFn: async () => {
      const data = await base44.entities.AffiliateGrowthCampaign.filter(
        {},
        '-enrolled_date',
        200
      );
      return data || [];
    },
    enabled: user?.role === 'admin',
    refetchInterval: 300000
  });

  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const completedCampaigns = campaigns.filter(c => c.status === 'completed');

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Affiliate Growth Campaigns</h1>
          <p className="text-slate-600">Automated enrollment and coaching for underperforming affiliates</p>
        </div>

        {/* Action Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6 flex gap-3">
            <Button
              onClick={() => enrollMutation.mutate()}
              disabled={enrollMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              {enrollMutation.isPending ? 'Identifying...' : 'Run Enrollment Scan'}
            </Button>
            <Button
              onClick={() => sequenceMutation.mutate()}
              disabled={sequenceMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {sequenceMutation.isPending ? 'Sending...' : 'Send Daily Sequences'}
            </Button>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['growthCampaigns'] })} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600 mb-1">Total Campaigns</p>
              <p className="text-3xl font-bold text-slate-900">{campaigns.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-blue-600 mb-1">Active</p>
              <p className="text-3xl font-bold text-blue-900">{activeCampaigns.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-green-600 mb-1">Completed</p>
              <p className="text-3xl font-bold text-green-900">{completedCampaigns.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-purple-600 mb-1">Avg Improvement</p>
              <p className="text-3xl font-bold text-purple-900">
                {completedCampaigns.length > 0
                  ? (
                      completedCampaigns.reduce((sum, c) => sum + (c.conversion_improvement || 0), 0) /
                      completedCampaigns.length
                    ).toFixed(1)
                  : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Active Campaigns */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-12 pb-12 flex justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
            </CardContent>
          </Card>
        ) : activeCampaigns.length > 0 ? (
          <div className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Active Campaigns</h2>
            {activeCampaigns.map((campaign) => {
              const daysSinceStart = Math.floor(
                (new Date() - new Date(campaign.enrolled_date)) / (1000 * 60 * 60 * 24)
              );
              const progress = (daysSinceStart / 30) * 100;

              return (
                <Card key={campaign.id} className="border-l-4 border-l-blue-600">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-slate-900 text-lg">{campaign.affiliate_email}</h3>
                          <Badge className="bg-blue-100 text-blue-800">Day {daysSinceStart + 1}/30</Badge>
                        </div>

                        <p className="text-sm text-slate-700 mb-3">{campaign.campaign_goal}</p>

                        {/* Progress */}
                        <div className="mb-4">
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-4 mb-4 bg-slate-50 p-3 rounded">
                          <div>
                            <p className="text-xs text-slate-600">Emails Sent</p>
                            <p className="text-lg font-bold text-slate-900">{campaign.emails_sent || 0}/7</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600">Posts Published</p>
                            <p className="text-lg font-bold text-slate-900">{campaign.posts_published || 0}/7</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600">Baseline Conv.</p>
                            <p className="text-lg font-bold text-slate-900">
                              {(campaign.performance_baseline?.current_conversion_rate * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600">Improvement</p>
                            <p className="text-lg font-bold text-green-900">
                              {campaign.conversion_improvement ? `+${campaign.conversion_improvement.toFixed(1)}%` : 'Pending'}
                            </p>
                          </div>
                        </div>

                        {/* Motivation Message */}
                        <div className="bg-purple-50 border border-purple-200 p-3 rounded mb-3">
                          <p className="text-xs text-purple-600 font-semibold mb-1">AI Motivation</p>
                          <p className="text-sm text-purple-900">{campaign.ai_motivation_message}</p>
                        </div>

                        {/* Tips */}
                        <div>
                          <p className="text-xs text-slate-600 font-semibold mb-2">Personalized Tips</p>
                          <ul className="space-y-1">
                            {campaign.ai_personalized_advice?.slice(0, 3).map((tip, idx) => (
                              <li key={idx} className="text-xs text-slate-700 flex gap-2">
                                <span className="text-green-600 font-bold">✓</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Affiliate Baseline */}
                      <div className="ml-4 text-right min-w-[150px]">
                        <p className="text-xs text-slate-600 font-semibold mb-2">Baseline Metrics</p>
                        <div className="space-y-1 text-sm">
                          <p className="text-slate-900">
                            <span className="text-slate-600">Referrals:</span> {campaign.performance_baseline?.total_referrals_30d}
                          </p>
                          <p className="text-slate-900">
                            <span className="text-slate-600">Conversions:</span> {campaign.performance_baseline?.total_conversions_30d}
                          </p>
                          <p className="text-slate-900">
                            <span className="text-slate-600">Earnings:</span> ${campaign.performance_baseline?.earnings_30d?.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="mb-8">
            <CardContent className="pt-12 pb-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No active campaigns. Run enrollment scan to identify underperformers.</p>
            </CardContent>
          </Card>
        )}

        {/* Completed Campaigns */}
        {completedCampaigns.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Completed Campaigns</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedCampaigns.map((campaign) => (
                <Card key={campaign.id} className="border-l-4 border-l-green-600">
                  <CardContent className="pt-6">
                    <h4 className="font-bold text-slate-900 mb-2">{campaign.affiliate_email}</h4>
                    <div className="space-y-2 text-sm">
                      <p className="text-slate-700">
                        Baseline: {(campaign.performance_baseline?.current_conversion_rate * 100).toFixed(1)}%
                      </p>
                      <p className="text-slate-700">
                        Improvement: <span className="font-bold text-green-600">+{campaign.conversion_improvement?.toFixed(1)}%</span>
                      </p>
                      <p className="text-slate-700">
                        Emails: {campaign.emails_sent}/7 | Posts: {campaign.posts_published}/7
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}