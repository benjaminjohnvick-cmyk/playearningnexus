import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingDown, Zap, Mail, GiftIcon, RefreshCw } from 'lucide-react';

const RISK_COLORS = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

export default function AffiliateChurnMonitor() {
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ['churnPredictions'],
    queryFn: async () => {
      if (user?.role === 'admin') {
        return base44.asServiceRole.entities.AffiliateChurnPrediction.filter(
          { risk_level: { $in: ['high', 'critical'] } }, '-churn_risk_score', 50
        );
      }
      return [];
    },
    enabled: !!user && user.role === 'admin'
  });

  const analysisData = [
    { level: 'Low Risk', count: predictions.filter(p => p.risk_level === 'low').length },
    { level: 'Medium Risk', count: predictions.filter(p => p.risk_level === 'medium').length },
    { level: 'High Risk', count: predictions.filter(p => p.risk_level === 'high').length },
    { level: 'Critical', count: predictions.filter(p => p.risk_level === 'critical').length }
  ];

  const analyseMutation = useMutation({
    mutationFn: async () => {
      setRunningAnalysis(true);
      try {
        await base44.functions.invoke('predictAffiliateChurn', { check_all: true });
        queryClient.invalidateQueries({ queryKey: ['churnPredictions'] });
      } finally {
        setRunningAnalysis(false);
      }
    }
  });

  const sendWinBackMutation = useMutation({
    mutationFn: async (prediction) => {
      const incentive = {
        action_type: 'bonus_offer',
        incentive_amount: 50,
        sent_date: new Date().toISOString(),
        status: 'sent'
      };

      await base44.asServiceRole.entities.AffiliateChurnPrediction.update(prediction.id, {
        win_back_trigger_sent: true,
        win_back_actions: [...(prediction.win_back_actions || []), incentive],
        status: 'win_back_active'
      });

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: prediction.affiliate_email,
        from_name: 'GamerGain',
        subject: '🎁 We Miss You — Special Win-Back Bonus Inside',
        body: `Hi,\n\nWe noticed you haven't been as active lately, and we want to help you succeed!\n\n🎁 Exclusive Offer: +$50 Bonus on your next payout\n\nThis special offer expires in 7 days.\n\nWe're here to support you: https://gamergain.app/AffiliatePortal\n\n— GamerGain Team`
      }).catch(() => null);

      queryClient.invalidateQueries({ queryKey: ['churnPredictions'] });
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Affiliate Churn Monitor</h1>
            <p className="text-slate-600">AI-driven predictions + automated win-back incentives</p>
          </div>
          <Button className="bg-purple-600" onClick={() => analyseMutation.mutate()} disabled={runningAnalysis}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {runningAnalysis ? 'Running Analysis...' : 'Run Analysis Now'}
          </Button>
        </div>

        {/* Risk Distribution Chart */}
        {analysisData.some(d => d.count > 0) && (
          <Card className="mb-8">
            <CardHeader><CardTitle>Risk Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analysisData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" name="Affiliates" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* High Risk Affiliates */}
        {isLoading ? (
          <div className="text-center text-slate-500 py-12">Loading churn predictions...</div>
        ) : predictions.length === 0 ? (
          <Card className="text-center p-12">
            <TrendingDown className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No high-risk affiliates detected</p>
            <Button variant="outline" onClick={() => analyseMutation.mutate()}>Run Full Analysis</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">High-Risk Affiliates</h2>
            {predictions.map(prediction => (
              <Card key={prediction.id} className="border-l-4 border-l-red-400">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div>
                          <p className="font-semibold">{prediction.affiliate_email}</p>
                          <Badge className={RISK_COLORS[prediction.risk_level]}>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {prediction.risk_level.toUpperCase()} — Score {prediction.churn_risk_score}/100
                          </Badge>
                        </div>
                      </div>

                      {/* Engagement Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 rounded-lg p-3 mb-3">
                        <div>
                          <p className="text-slate-500">Days Inactive</p>
                          <p className="font-bold text-slate-900">{prediction.engagement_metrics?.days_since_last_login || 0}d</p>
                        </div>
                        <div>
                          <p className="text-slate-500">No Referrals</p>
                          <p className="font-bold text-slate-900">{prediction.engagement_metrics?.days_since_last_referral || 0}d</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Last Post</p>
                          <p className="font-bold text-slate-900">{prediction.engagement_metrics?.days_since_last_social_post || 0}d</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Ref Velocity</p>
                          <p className="font-bold text-slate-900">{prediction.engagement_metrics?.referral_velocity_30d || 0}/mo</p>
                        </div>
                      </div>

                      {/* Top Indicators */}
                      <div className="mb-3">
                        <p className="text-xs text-slate-500 font-semibold mb-1">Risk Indicators:</p>
                        <div className="space-y-1">
                          {(prediction.churn_indicators || []).slice(0, 3).map((ind, i) => (
                            <p key={i} className="text-sm text-slate-700">• {ind}</p>
                          ))}
                        </div>
                      </div>

                      {/* AI Insights */}
                      <p className="text-sm italic text-slate-600 bg-blue-50 rounded p-2">{prediction.ai_insights}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                        size="sm"
                        onClick={() => sendWinBackMutation.mutate(prediction)}
                        disabled={prediction.win_back_trigger_sent}
                      >
                        <GiftIcon className="w-4 h-4 mr-1" />
                        {prediction.win_back_trigger_sent ? 'Sent' : 'Send Incentive'}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Mail className="w-4 h-4 mr-1" />
                        Personal Outreach
                      </Button>
                    </div>
                  </div>

                  {/* Win-Back History */}
                  {prediction.win_back_actions?.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-slate-500 mb-2">Win-Back History:</p>
                      {prediction.win_back_actions.map((action, i) => (
                        <p key={i} className="text-xs text-slate-600">
                          {action.action_type} - ${action.incentive_amount} ({action.status})
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}