import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Activity, AlertTriangle, TrendingUp, Eye, Clock, MousePointer, Zap } from 'lucide-react';
import { toast } from 'sonner';

const priorityColor = { high: 'bg-red-100 text-red-700 border-red-300', medium: 'bg-yellow-100 text-yellow-700 border-yellow-300', low: 'bg-blue-100 text-blue-700 border-blue-300' };

export default function SurveyHeatmapDashboard({ surveyId, gameTitle }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiSurveyHeatmapAnalyzer', {
        action: 'analyze',
        survey_id: surveyId,
      });
      setData(res.data);
      toast.success('Heatmap analysis complete!');
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  const uxScore = data?.ai_insights?.overall_ux_score || 0;
  const scoreColor = uxScore >= 75 ? 'text-green-600' : uxScore >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-5 h-5 text-blue-600" />
          UX Session Heatmap
          <Badge className="bg-blue-100 text-blue-700 ml-auto">Privacy-Safe</Badge>
        </CardTitle>
        <p className="text-xs text-gray-500">AI analyzes where users get stuck or drop off — no personal data collected.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600 mb-3">Analyze session recordings to find UX friction points and improve completion rates.</p>
            <Button onClick={runAnalysis} disabled={loading} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              {loading ? 'Analyzing Sessions...' : 'Run AI Heatmap Analysis'}
            </Button>
          </div>
        )}

        {data && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Eye, label: 'Sessions', val: data.stats?.total_sessions || 0, color: 'text-blue-600' },
                { icon: TrendingUp, label: 'Completion', val: `${(data.stats?.completion_rate || 0).toFixed(0)}%`, color: 'text-green-600' },
                { icon: Clock, label: 'Avg Time', val: `${Math.round(data.stats?.avg_completion_time_seconds || 0)}s`, color: 'text-purple-600' },
                { icon: AlertTriangle, label: 'Suspicious', val: data.stats?.suspicious_sessions || 0, color: 'text-red-600' },
              ].map(s => (
                <div key={s.label} className="p-3 bg-gray-50 rounded-xl text-center border">
                  <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                  <p className={`font-black text-lg ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* UX Score */}
            {data.ai_insights && (
              <div className="p-4 bg-white border-2 border-gray-100 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-800 text-sm">Overall UX Score</p>
                  <p className={`text-2xl font-black ${scoreColor}`}>{uxScore}/100</p>
                </div>
                <Progress value={uxScore} className="h-2 mb-2" />
                <p className="text-xs text-gray-500">{data.ai_insights.engagement_insight}</p>
              </div>
            )}

            {/* Question Heatmap */}
            {data.question_heatmap?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                  <MousePointer className="w-3.5 h-3.5" /> Question-Level Heatmap
                </p>
                <div className="space-y-2">
                  {data.question_heatmap.map(q => {
                    const isHot = data.ai_insights?.high_confusion_questions?.includes(q.question_index);
                    return (
                      <div key={q.question_index} className={`p-2.5 rounded-lg border text-xs ${isHot ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700">Q{q.question_index + 1}</span>
                          {isHot && <Badge className="bg-red-200 text-red-700 text-[10px]">⚠️ Friction Point</Badge>}
                          <span className="text-gray-500">{q.response_count} responses</span>
                        </div>
                        <div className="flex gap-4 text-gray-600">
                          <span>⏱ {q.avg_time_seconds}s avg</span>
                          <span>🔄 {q.confusion_rate}% changed answer</span>
                        </div>
                        <Progress value={Math.min(q.avg_time_seconds * 5, 100)} className="h-1 mt-1" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            {data.ai_insights?.recommendations?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">💡 AI Recommendations</p>
                <div className="space-y-2">
                  {data.ai_insights.recommendations.map((rec, i) => (
                    <div key={i} className={`p-2.5 rounded-lg border text-xs ${priorityColor[rec.priority] || priorityColor.medium}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-[10px] ${priorityColor[rec.priority]}`}>{rec.priority?.toUpperCase()}</Badge>
                        <span className="font-bold">{rec.issue}</span>
                      </div>
                      <p className="text-gray-700">→ {rec.fix}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">Impact: {rec.estimated_impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drop-off */}
            {Object.keys(data.drop_off_points || {}).length > 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                <p className="text-xs font-bold text-orange-700 mb-1">📉 Drop-off Analysis</p>
                <p className="text-xs text-orange-600">{data.ai_insights?.drop_off_analysis}</p>
              </div>
            )}

            {data.ai_insights?.predicted_completion_boost && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-xs font-bold text-green-700">🚀 Predicted Improvement</p>
                <p className="text-xs text-green-600">{data.ai_insights.predicted_completion_boost}</p>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Refresh Analysis
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}