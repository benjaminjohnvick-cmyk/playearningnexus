import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

export default function CampaignAutomation({ user }) {
  const queryClient = useQueryClient();

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns-auto', user.id],
    queryFn: () => base44.entities.ReferralCampaign.filter({ user_id: user.id })
  });

  const { data: links = [] } = useQuery({
    queryKey: ['links-auto', user.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id })
  });

  const { data: automation } = useQuery({
    queryKey: ['automation', user.id],
    queryFn: async () => {
      const autos = await base44.entities.ReferralAutomation.filter({ user_id: user.id }, '-automation_date', 1);
      return autos[0];
    }
  });

  const runAutomationMutation = useMutation({
    mutationFn: async () => {
      const prompt = `Analyze referral campaign performance and provide optimization recommendations.

CAMPAIGNS:
${campaigns.map(c => `- ${c.campaign_name}: ${c.total_clicks} clicks, ${c.total_conversions} conversions (${c.conversion_rate}% rate), $${c.total_earned} earned, Status: ${c.status}`).join('\n')}

LINKS:
${links.map(l => `- ${l.link_code}: ${l.clicks} clicks, ${l.conversions} conversions, $${l.total_earned} earned`).join('\n')}

Provide analysis as JSON with:
- top_performing_campaigns: array of {campaign_id, performance_score (0-100), recommendation}
- underperforming_campaigns: array of campaigns to optimize or pause
- budget_recommendations: suggestions for resource allocation
- suggested_actions: actionable steps
- estimated_impact: expected improvement description`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            top_performing_campaigns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  campaign_id: { type: 'string' },
                  performance_score: { type: 'number' },
                  recommendation: { type: 'string' }
                }
              }
            },
            underperforming_campaigns: { type: 'array', items: { type: 'object' } },
            budget_recommendations: { type: 'object' },
            suggested_actions: { type: 'array', items: { type: 'string' } },
            estimated_impact: { type: 'string' }
          }
        }
      });

      return await base44.entities.ReferralAutomation.create({
        user_id: user.id,
        automation_date: new Date().toISOString().split('T')[0],
        ...result
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['automation']);
      toast.success('AI analysis complete!');
    }
  });

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            Campaign Automation
          </CardTitle>
          <Button 
            onClick={() => runAutomationMutation.mutate()}
            disabled={runAutomationMutation.isPending}
          >
            {runAutomationMutation.isPending ? 'Analyzing...' : 'Run AI Analysis'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!automation ? (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>Run AI analysis to get optimization recommendations</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-2 border-green-200 bg-green-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {automation.top_performing_campaigns?.slice(0, 3).map((camp, i) => {
                      const campaign = campaigns.find(c => c.id === camp.campaign_id);
                      return (
                        <div key={i} className="p-2 bg-white rounded border">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm">{campaign?.campaign_name || 'Campaign'}</p>
                            <Badge className="bg-green-200 text-green-800">{camp.performance_score}/100</Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{camp.recommendation}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-amber-200 bg-amber-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Needs Attention
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {automation.underperforming_campaigns?.slice(0, 3).map((camp, i) => (
                      <div key={i} className="p-2 bg-white rounded border">
                        <p className="text-sm">{camp.issue || 'Low performance detected'}</p>
                        <p className="text-xs text-gray-600 mt-1">{camp.suggestion || 'Consider optimization'}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  Recommended Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {automation.suggested_actions?.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-purple-600">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                  <p className="text-sm font-semibold text-purple-800">Expected Impact:</p>
                  <p className="text-sm text-purple-700">{automation.estimated_impact}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </CardContent>
    </Card>
  );
}