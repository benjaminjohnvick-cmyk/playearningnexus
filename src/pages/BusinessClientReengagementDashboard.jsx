import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, Mail, DollarSign, Target } from 'lucide-react';

export default function BusinessClientReengagementDashboard() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch retention campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['businessReengagementCampaigns'],
    queryFn: async () => {
      const data = await base44.entities.RetentionCampaign.filter(
        { campaign_type: 'business_inactivity_reengagement' },
        '-created_at',
        100
      );
      return data || [];
    },
    refetchInterval: 60000
  });

  // Launch re-engagement campaigns
  const launchMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('businessClientReengagementEngine', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessReengagementCampaigns'] });
    }
  });

  // Approve campaign for sending
  const approveMutation = useMutation({
    mutationFn: async (campaignId) => {
      await base44.entities.RetentionCampaign.update(campaignId, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.email
      });
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessReengagementCampaigns'] });
    }
  });

  // Calculate stats
  const approvedCampaigns = campaigns.filter(c => c.status === 'approved');
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending_approval');
  const totalTargetValue = campaigns.reduce((sum, c) => sum + (c.annual_value_target || 0), 0);

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
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Business Client Re-engagement</h1>
          <p className="text-slate-600">Automated inactive business recovery with personalized outreach</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-slate-900">{campaigns.length}</div>
              <p className="text-sm text-slate-600 mt-1">Total Campaigns</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-emerald-600">{approvedCampaigns.length}</div>
              <p className="text-sm text-slate-600 mt-1">Approved & Sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-600">{pendingCampaigns.length}</div>
              <p className="text-sm text-slate-600 mt-1">Awaiting Review</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-purple-600">${(totalTargetValue / 1000).toFixed(0)}k</div>
              <p className="text-sm text-slate-600 mt-1">Target Annual Value</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Bar */}
        <Card className="mb-8">
          <CardContent className="pt-6 flex gap-3">
            <Button
              onClick={() => launchMutation.mutate()}
              disabled={launchMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              {launchMutation.isPending ? 'Analyzing...' : 'Scan & Generate Campaigns'}
            </Button>
          </CardContent>
        </Card>

        {/* Campaign Details */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6 flex justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
              </CardContent>
            </Card>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No campaigns yet. Click "Scan & Generate Campaigns" to identify inactive businesses.</p>
              </CardContent>
            </Card>
          ) : (
            campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardContent className="pt-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          className={
                            campaign.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : campaign.status === 'pending_approval'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-800'
                          }
                        >
                          {campaign.status?.replace('_', ' ').toUpperCase()}
                        </Badge>
                        {campaign.discount_percent && (
                          <Badge className="bg-orange-100 text-orange-800">{campaign.discount_percent}% Discount</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Campaign Details */}
                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">EMAIL SUBJECT</p>
                      <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded">{campaign.email_subject}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">EMAIL BODY</p>
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded max-h-32 overflow-y-auto">
                        {campaign.email_body}
                      </p>
                    </div>
                  </div>

                  {/* Campaign Metrics */}
                  <div className="grid grid-cols-4 gap-3 mb-4 bg-slate-50 p-3 rounded-lg">
                    <div>
                      <p className="text-xs text-slate-600">Discount</p>
                      <p className="text-lg font-bold text-orange-600">{campaign.discount_percent}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Offer Code</p>
                      <p className="text-sm font-mono text-slate-900">{campaign.offer_code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Annual Value</p>
                      <p className="text-sm font-bold text-slate-900">${(campaign.annual_value_target || 0) / 1000}k</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Target Metric</p>
                      <p className="text-sm font-bold text-slate-900">{campaign.target_metric}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {campaign.status === 'pending_approval' && (
                      <Button
                        onClick={() => approveMutation.mutate(campaign.id)}
                        disabled={approveMutation.isPending}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        size="sm"
                      >
                        <Mail className="w-3 h-3 mr-1" />
                        Approve & Send Campaign
                      </Button>
                    )}
                    {campaign.status === 'approved' && (
                      <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-xs text-emerald-900">
                          ✓ Campaign sent on {new Date(campaign.approved_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="flex-1">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      View Results
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}