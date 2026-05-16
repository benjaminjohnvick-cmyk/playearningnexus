import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Brain, TrendingUp, MessageSquare, Lightbulb, BarChart2, Loader2, RefreshCw, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

const sentimentColor = {
  positive: 'text-green-600 bg-green-50 border-green-200',
  neutral: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  negative: 'text-red-600 bg-red-50 border-red-200',
  mixed: 'text-blue-600 bg-blue-50 border-blue-200',
};
const SentimentIcon = ({ s }) => s === 'positive' ? <ThumbsUp className="w-4 h-4" /> : s === 'negative' ? <ThumbsDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />;

export default function SurveyInsightsDashboard({ surveyId }) {
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['surveyInsights', surveyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('aiSurveyInsightsDashboard', surveyId ? { survey_id: surveyId } : {});
      return res.data;
    },
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 15,
  });

  const loading = isLoading || isRefetching;
  const analysis = data?.analysis;
  const meta = data?.meta;

  return (
    <Card className="border-0 shadow-xl">
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-xl">
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          AI Survey Insights Dashboard
          <Badge className="ml-auto bg-white/20 text-white text-xs">Real-time AI</Badge>
        </CardTitle>
        <p className="text-purple-200 text-xs mt-1">Sentiment analysis, theme extraction & actionable recommendations</p>
      </CardHeader>
      <CardContent className="pt-5">
        {!shouldFetch && !data ? (
          <div className="text-center py-10 space-y-3">
            <Brain className="w-14 h-14 text-purple-200 mx-auto" />
            <p className="text-gray-500 text-sm">Analyze all your survey responses with AI to uncover trends, sentiment and key insights.</p>
            <Button onClick={() => { setShouldFetch(true); }} className="bg-purple-600 hover:bg-purple-700">
              <Brain className="w-4 h-4 mr-2" /> Run AI Analysis
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            <p className="text-sm">Analyzing responses… this may take a moment</p>
          </div>
        ) : analysis ? (
          <div className="space-y-5">
            {/* Meta stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Responses', value: meta?.total_responses || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Avg Quality', value: `${meta?.avg_quality_score?.toFixed(0) || 0}/100`, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Completion', value: `${meta?.completion_rate?.toFixed(0) || 0}%`, color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'NPS Score', value: analysis.nps_estimate >= 0 ? `+${analysis.nps_estimate}` : `${analysis.nps_estimate}`, color: analysis.nps_estimate >= 0 ? 'text-green-600' : 'text-red-600', bg: analysis.nps_estimate >= 0 ? 'bg-green-50' : 'bg-red-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Sentiment */}
            <div className={`rounded-xl border-2 p-4 flex items-center gap-4 ${sentimentColor[analysis.overall_sentiment] || sentimentColor.neutral}`}>
              <SentimentIcon s={analysis.overall_sentiment} />
              <div className="flex-1">
                <p className="font-semibold text-sm capitalize">Overall Sentiment: {analysis.overall_sentiment}</p>
                <p className="text-xs opacity-80">{analysis.trend_summary}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{analysis.sentiment_score}</p>
                <p className="text-xs opacity-70">/ 100</p>
              </div>
            </div>

            {/* Top Themes */}
            {analysis.top_themes?.length > 0 && (
              <div>
                <p className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-indigo-500" />Top Response Themes</p>
                <div className="space-y-2">
                  {analysis.top_themes.map((t, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-gray-800">{t.theme}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">{t.sentiment}</Badge>
                          <span className="text-xs text-gray-400">{t.count} mentions</span>
                        </div>
                      </div>
                      {t.representative_quote && (
                        <p className="text-xs text-gray-500 italic">"{t.representative_quote}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Insights */}
            {analysis.key_insights?.length > 0 && (
              <div>
                <p className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-blue-500" />Key Insights</p>
                <div className="space-y-1.5">
                  {analysis.key_insights.map((ins, i) => (
                    <div key={i} className="flex gap-2 bg-blue-50 rounded-lg p-2.5">
                      <span className="text-blue-400 font-bold text-xs">{i + 1}.</span>
                      <p className="text-xs text-blue-900">{ins}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations?.length > 0 && (
              <div>
                <p className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-yellow-500" />Actionable Recommendations</p>
                <div className="space-y-1.5">
                  {analysis.recommendations.map((r, i) => (
                    <div key={i} className="flex gap-2 bg-yellow-50 rounded-lg p-2.5 border border-yellow-100">
                      <Lightbulb className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-800">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Word Cloud (text-based) */}
            {analysis.word_cloud_terms?.length > 0 && (
              <div>
                <p className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-1.5"><BarChart2 className="w-4 h-4 text-purple-500" />Most Mentioned Terms</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.word_cloud_terms.slice(0, 15).map((t, i) => {
                    const maxFreq = analysis.word_cloud_terms[0]?.frequency || 1;
                    const size = 10 + Math.round((t.frequency / maxFreq) * 8);
                    return (
                      <span key={i} className="bg-purple-50 text-purple-700 rounded-full px-3 py-1 border border-purple-100" style={{ fontSize: `${size}px` }}>
                        {t.word}
                        <span className="text-purple-400 ml-1 text-xs">({t.frequency})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <Button size="sm" variant="outline" onClick={() => refetch()} className="w-full" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh Analysis
            </Button>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">No data available. Try again.</div>
        )}
      </CardContent>
    </Card>
  );
}