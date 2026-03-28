import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Loader2, Lightbulb, Clock, Users, TrendingUp, Target, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const TIP_ICONS = { timing: Clock, demographic: Users, category: Target, performance: TrendingUp };
const TIP_COLORS = {
  timing: 'text-blue-600 bg-blue-50 border-blue-100',
  demographic: 'text-purple-600 bg-purple-50 border-purple-100',
  category: 'text-green-600 bg-green-50 border-green-100',
  performance: 'text-amber-600 bg-amber-50 border-amber-100',
};

export default function AISurveyCoach({ user }) {
  const [tips, setTips] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: responses = [] } = useQuery({
    queryKey: ['coach-responses', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['coach-transactions', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const { data: surveys = [] } = useQuery({
    queryKey: ['coach-surveys'],
    queryFn: () => base44.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 50),
  });

  const generateCoaching = async () => {
    setLoading(true);
    try {
      const completedResponses = responses.filter(r => r.completed);
      const hourCounts = completedResponses.reduce((acc, r) => {
        const hour = new Date(r.created_date).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});
      const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      const categoryCounts = completedResponses.reduce((acc, r) => {
        const survey = surveys.find(s => s.id === r.survey_id);
        if (survey?.survey_type) acc[survey.survey_type] = (acc[survey.survey_type] || 0) + 1;
        return acc;
      }, {});

      const avgQuality = completedResponses.length > 0
        ? completedResponses.reduce((s, r) => s + (r.quality_score || 70), 0) / completedResponses.length
        : 0;

      const totalEarned = transactions.reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a survey earning coach. Analyze this user's performance and give 4 specific, actionable tips.

User stats:
- Total surveys completed: ${completedResponses.length}
- Average quality score: ${avgQuality.toFixed(0)}/100
- Total earned: $${totalEarned.toFixed(2)}
- Most active hour: ${bestHour ? `${bestHour}:00` : 'unknown'}
- Top categories: ${Object.entries(categoryCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}(${v})`).join(', ') || 'none yet'}
- Flagged responses: ${responses.filter(r => r.is_flagged).length}

Give exactly 4 coaching tips. Each tip should be specific, actionable, and tailored to this user's data.
Focus on: timing optimization, demographic targeting, category selection, quality improvement.`,
        response_json_schema: {
          type: 'object',
          properties: {
            tips: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['timing', 'demographic', 'category', 'performance'] },
                  headline: { type: 'string' },
                  detail: { type: 'string' },
                  impact: { type: 'string', enum: ['high', 'medium', 'low'] },
                  action: { type: 'string' },
                }
              }
            },
            summary: { type: 'string' },
            weekly_goal: { type: 'string' },
          }
        }
      });
      setTips(result);
    } catch (e) {
      toast.error('Could not generate coaching tips. Try again.');
    }
    setLoading(false);
  };

  const impactColor = { high: 'bg-green-100 text-green-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-600' };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            AI Survey Coach
          </CardTitle>
          <Button
            size="sm"
            onClick={generateCoaching}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analyzing…</>
              : tips
                ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Tips</>
                : <><Lightbulb className="w-3.5 h-3.5 mr-1.5" /> Get My Tips</>}
          </Button>
        </div>
        <p className="text-xs text-gray-500">Personalized coaching based on your survey history and performance data</p>
      </CardHeader>

      <CardContent>
        {!tips && !loading && (
          <div className="text-center py-8 text-gray-400">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-600">Your AI coach is ready</p>
            <p className="text-xs mt-1">Click "Get My Tips" to analyze your performance and get personalized recommendations</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {['Best times to take surveys', 'Top-paying categories for you', 'Quality improvement tips', 'Weekly goal recommendation'].map(hint => (
                <Badge key={hint} variant="outline" className="text-xs">{hint}</Badge>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-10 text-indigo-600">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">Analyzing your survey history…</p>
            <p className="text-xs text-gray-400 mt-1">This takes just a moment</p>
          </div>
        )}

        {tips && !loading && (
          <div className="space-y-4">
            {/* Summary */}
            {tips.summary && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-800">
                <span className="font-semibold">Assessment: </span>{tips.summary}
              </div>
            )}

            {/* Tips grid */}
            <div className="grid sm:grid-cols-2 gap-3">
              {(tips.tips || []).map((tip, i) => {
                const Icon = TIP_ICONS[tip.type] || Lightbulb;
                const colorClass = TIP_COLORS[tip.type] || TIP_COLORS.performance;
                return (
                  <div key={i} className={`rounded-xl p-4 border ${colorClass}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="font-semibold text-sm">{tip.headline}</span>
                      </div>
                      <Badge className={`text-xs flex-shrink-0 ${impactColor[tip.impact] || impactColor.medium}`}>
                        {tip.impact} impact
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed mb-2 opacity-90">{tip.detail}</p>
                    {tip.action && (
                      <div className="flex items-center gap-1 text-xs font-medium">
                        <ChevronRight className="w-3 h-3" />
                        <span>Action: {tip.action}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Weekly goal */}
            {tips.weekly_goal && (
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4" />
                  <span className="font-semibold text-sm">Your Weekly Goal</span>
                </div>
                <p className="text-sm text-indigo-100">{tips.weekly_goal}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}