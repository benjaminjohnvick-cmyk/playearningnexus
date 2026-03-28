import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, DollarSign, Target, TrendingUp, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AIPersonalizedRecommendations({ user }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['ai-recommendations', user?.id, refreshKey],
    queryFn: async () => {
      const [responses, sessions, transactions] = await Promise.all([
        base44.entities.PPCSurveyResponse.filter({ user_id: user.id }),
        base44.entities.PPCSession.filter({ user_id: user.id }),
        base44.entities.PPCTransaction.filter({ user_id: user.id })
      ]);

      const totalEarned = transactions.reduce((s, t) => s + (t.amount || 0), 0);
      const surveysCompleted = responses.filter(r => r.completed).length;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a personalized recommendation AI for GamerGain, a gaming + survey rewards platform.

User Profile:
- Name: ${user.full_name}
- Total Earnings: $${(user.total_earnings || 0).toFixed(2)}
- Total Referrals: ${user.total_referrals || 0}
- Surveys Completed: ${surveysCompleted}
- PPC Sessions: ${sessions.length}
- Current Tier: ${user.ppc_tier || 1}

Generate 3 highly specific, actionable recommendations to help this user earn more money RIGHT NOW.
Each recommendation should include: what to do, why it works for this user specifically, and estimated earnings.`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  action: { type: 'string' },
                  reason: { type: 'string' },
                  estimated_earnings: { type: 'string' },
                  type: { type: 'string' },
                  priority: { type: 'string' }
                }
              }
            },
            personalized_tip: { type: 'string' }
          }
        }
      });

      return result;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30 // Cache for 30 min
  });

  const typeColors = {
    survey: 'from-purple-500 to-indigo-600',
    referral: 'from-green-500 to-emerald-600',
    ppc: 'from-blue-500 to-cyan-600',
    game: 'from-amber-500 to-orange-500'
  };

  const typeLinks = {
    survey: 'Surveys',
    referral: 'ReferralHub',
    ppc: 'PPCMarketplace',
    game: 'InAppGameStore'
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Recommendations for You
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={isLoading}
            className="text-purple-600 hover:bg-purple-100"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {data?.personalized_tip && (
          <p className="text-sm text-purple-700 bg-purple-100 rounded-lg px-3 py-2 mt-1">
            💡 {data.personalized_tip}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-purple-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">AI is personalizing your recommendations…</span>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {data?.recommendations?.map((rec, i) => (
              <div key={i} className="bg-white rounded-xl border border-purple-100 p-4 space-y-3 hover:shadow-md transition-shadow">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${typeColors[rec.type] || typeColors.survey} flex items-center justify-center`}>
                  {rec.type === 'referral' ? <TrendingUp className="w-4 h-4 text-white" /> :
                   rec.type === 'ppc' ? <Target className="w-4 h-4 text-white" /> :
                   <DollarSign className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{rec.title}</p>
                    {rec.priority === 'high' && <Badge className="bg-red-100 text-red-700 text-xs">High Priority</Badge>}
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{rec.action}</p>
                  <p className="text-xs text-gray-400 italic mb-3">{rec.reason}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-green-600">{rec.estimated_earnings}</span>
                    <Link to={createPageUrl(typeLinks[rec.type] || 'Surveys')}>
                      <Button size="sm" className={`text-xs h-7 bg-gradient-to-r ${typeColors[rec.type] || typeColors.survey} text-white`}>
                        Go →
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}