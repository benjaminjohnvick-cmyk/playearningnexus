import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Loader2, AlertTriangle, TrendingUp, BarChart2, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const freqColors = { very_high: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-gray-100 text-gray-600' };
const impactColors = { critical: 'text-red-600', high: 'text-orange-600', medium: 'text-yellow-600', low: 'text-gray-500' };
const sentimentEmoji = { very_negative: '😡', negative: '😟', neutral: '😐', positive: '🙂', very_positive: '😊' };

function PainPointCard({ point }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button className="w-full p-3 flex items-center gap-3 text-left hover:bg-gray-50" onClick={() => setOpen(!open)}>
        <Badge className={`text-xs ${freqColors[point.frequency]}`}>{point.frequency?.replace('_', ' ')}</Badge>
        <span className="flex-1 text-sm font-medium text-gray-800">{point.issue}</span>
        <span className={`text-xs font-semibold ${impactColors[point.impact]}`}>{point.impact} impact</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t bg-gray-50">
          <p className="text-xs text-gray-600 pt-2">{point.description}</p>
          {point.suggested_fix && (
            <div className="flex items-start gap-2 bg-green-50 rounded-md p-2">
              <Zap className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-700"><span className="font-semibold">Suggested fix: </span>{point.suggested_fix}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AIFeedbackAnalyzer() {
  const [result, setResult] = useState(null);

  const mutation = useMutation({
    mutationFn: () => base44.functions.invoke('aiSupportEngine', { action: 'analyze_feedback' }),
    onSuccess: (res) => setResult(res.data),
  });

  const data = result?.data;

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          AI Feedback Analyzer
          <Badge className="bg-blue-100 text-blue-700 text-xs ml-auto">Admin</Badge>
        </CardTitle>
        <p className="text-xs text-gray-500">Analyze all support tickets to identify common pain points and trends</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data && !mutation.isPending && (
          <div className="text-center py-6 border-2 border-dashed border-blue-200 rounded-xl">
            <BarChart2 className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-3">Scan all support tickets to discover pain points and improvement opportunities</p>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => mutation.mutate()}>
              <Sparkles className="w-4 h-4" /> Analyze Feedback
            </Button>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-blue-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Analyzing {result?.ticket_count || ''} support tickets...</p>
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {/* Header stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{result?.ticket_count || 0}</p>
                <p className="text-xs text-gray-500">Tickets analyzed</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{data.overall_health_score || '—'}<span className="text-sm text-gray-400">/100</span></p>
                <p className="text-xs text-gray-500">Health score</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl">{sentimentEmoji[data.sentiment_overview] || '😐'}</p>
                <p className="text-xs text-gray-500">{data.sentiment_overview?.replace('_', ' ') || 'neutral'}</p>
              </div>
            </div>

            {/* Health score bar */}
            {data.overall_health_score && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Platform health</span>
                  <span className="font-semibold">{data.overall_health_score}%</span>
                </div>
                <Progress value={data.overall_health_score} className="h-2" />
              </div>
            )}

            {/* Summary */}
            {data.summary && (
              <p className="text-xs text-gray-600 bg-blue-50 rounded-lg p-3 border border-blue-100">{data.summary}</p>
            )}

            {/* Urgent actions */}
            {data.urgent_actions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Urgent Actions
                </p>
                <ul className="space-y-1">
                  {data.urgent_actions.map((a, i) => (
                    <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5 bg-red-50 rounded px-2 py-1.5 border border-red-100">
                      <span className="text-red-500 font-bold flex-shrink-0">!</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pain points */}
            {data.top_pain_points?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Top Pain Points
                </p>
                <div className="space-y-2">
                  {data.top_pain_points.map((p, i) => <PainPointCard key={i} point={p} />)}
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {data.category_breakdown?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Category Breakdown</p>
                <div className="space-y-2">
                  {data.category_breakdown.map((c, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span className="capitalize">{c.category?.replace('_', ' ')}</span>
                        <span className="font-medium">{c.count} ({c.percentage}%)</span>
                      </div>
                      <Progress value={c.percentage} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => { setResult(null); mutation.mutate(); }}>
              <Sparkles className="w-3.5 h-3.5" /> Re-analyze
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}