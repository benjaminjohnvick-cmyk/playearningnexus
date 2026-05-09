import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Bot, Zap, RefreshCw, TrendingUp, BarChart2, Lightbulb, CheckCircle, Star, FlaskConical, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const PRIORITY_CONFIG = {
  high: { color: 'text-red-600', bg: 'bg-red-50 border-red-100', label: 'High' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', label: 'Medium' },
  low: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', label: 'Low' },
};

const WINNER_CONFIG = {
  a: { color: 'bg-indigo-100 text-indigo-700', label: '🅰 Variant A Wins' },
  b: { color: 'bg-purple-100 text-purple-700', label: '🅱 Variant B Wins' },
  continue: { color: 'bg-gray-100 text-gray-600', label: '⏳ Continue Testing' },
};

export default function AIFeedbackABDashboard() {
  const [user, setUser] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: abTests = [] } = useQuery({
    queryKey: ['ab-tests-summary'],
    queryFn: () => base44.entities.SurveyABTest.list('-created_date', 30),
    enabled: !!user,
  });

  const { data: feedbackResponses = [] } = useQuery({
    queryKey: ['feedback-summary'],
    queryFn: () => base44.entities.FeedbackSurveyResponse.list('-created_date', 100),
    enabled: !!user,
  });

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiFeedbackABOptimizer', { action: 'analyze_feedback' });
      setAnalysis(res.data.analysis);
      toast.success(`AI analyzed ${res.data.feedback_count} feedback responses & ${res.data.tests_analyzed} A/B tests`);
    } catch {
      toast.error('Analysis failed. Try again.');
    }
    setLoading(false);
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-red-600" /></div>;

  const avgRating = feedbackResponses.length > 0
    ? feedbackResponses.reduce((s, r) => s + (r.overall_rating || 0), 0) / feedbackResponses.length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FlaskConical className="w-7 h-7 text-indigo-600" /> AI Feedback & A/B Intelligence
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Survey-driven dynamic A/B testing with AI-powered site optimization</p>
          </div>
          <Button onClick={runAnalysis} disabled={loading} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            {loading ? 'Analyzing...' : analysis ? 'Re-run Analysis' : 'Run AI Analysis'}
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Avg Feedback Rating</p>
              <p className="text-2xl font-black text-amber-500 mt-1">{avgRating.toFixed(1)}<span className="text-sm text-gray-400">/5</span></p>
              <div className="flex justify-center gap-0.5 mt-1">
                {[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Total Responses</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{feedbackResponses.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Active A/B Tests</p>
              <p className="text-2xl font-black text-green-600 mt-1">{abTests.filter(t => t.status === 'active').length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">UX Health</p>
              <p className="text-2xl font-black text-indigo-600 mt-1">{analysis?.overall_ux_health || '—'}<span className="text-sm text-gray-400">{analysis ? '/100' : ''}</span></p>
            </CardContent>
          </Card>
        </div>

        {/* No analysis yet */}
        {!analysis && !loading && (
          <Card className="border-2 border-dashed border-indigo-200 bg-indigo-50/40">
            <CardContent className="py-14 text-center">
              <FlaskConical className="w-14 h-14 text-indigo-300 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-700 mb-2">AI-Driven Optimization Engine</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
                AI reads survey feedback, analyzes A/B test results, identifies UX patterns, and recommends specific site changes — then auto-concludes tests with statistical confidence ≥95%.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400 mb-6">
                <span className="px-2 py-1 bg-white rounded-full border">📋 Parses survey responses</span>
                <span className="px-2 py-1 bg-white rounded-full border">⚗️ Evaluates A/B confidence</span>
                <span className="px-2 py-1 bg-white rounded-full border">🧠 Recommends UX changes</span>
                <span className="px-2 py-1 bg-white rounded-full border">✅ Auto-concludes winning tests</span>
              </div>
              <Button onClick={runAnalysis} size="lg" className="bg-indigo-600 gap-2">
                <Zap className="w-5 h-5" /> Start AI Analysis
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card className="border-0 shadow-md">
            <CardContent className="py-14 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
              <p className="font-medium text-gray-700">AI is processing feedback patterns...</p>
              <p className="text-xs text-gray-400 mt-1">Analyzing survey responses, A/B confidence levels & UX signals</p>
            </CardContent>
          </Card>
        )}

        {analysis && !loading && (
          <>
            {/* Key Insight Banner */}
            <Card className="border-0 shadow-md border-l-4 border-l-indigo-500 bg-indigo-50/60">
              <CardContent className="p-4 flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-indigo-500 mb-0.5">Key AI Insight</p>
                  <p className="text-sm text-gray-700">{analysis.key_insight}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* A/B Test Conclusions */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-indigo-600" /> A/B Test Verdicts ({analysis.ab_test_conclusions?.length || 0})
                </p>
                {analysis.ab_test_conclusions?.map((c, i) => {
                  const winCfg = WINNER_CONFIG[c.recommended_winner] || WINNER_CONFIG.continue;
                  return (
                    <Card key={i} className="border-0 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-gray-800">{c.test_name}</p>
                          <Badge className={`${winCfg.color} text-xs flex-shrink-0`}>{winCfg.label}</Badge>
                        </div>
                        <div className="mb-1">
                          <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                            <span>Confidence</span>
                            <span className="font-bold text-gray-700">{c.confidence}%</span>
                          </div>
                          <Progress value={c.confidence} className="h-1.5" />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{c.reason}</p>
                        {c.impact && <p className="text-xs text-green-600 font-medium mt-1">Impact: {c.impact}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Site Changes */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" /> Recommended Site Changes ({analysis.site_changes_recommended?.length || 0})
                </p>
                {analysis.site_changes_recommended?.map((c, i) => {
                  const priCfg = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.low;
                  return (
                    <Card key={i} className={`border ${priCfg.bg} shadow-sm`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-800">{c.change}</p>
                          <Badge className={`${priCfg.bg} ${priCfg.color} border text-xs flex-shrink-0`}>{priCfg.label}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">Area: <span className="font-medium">{c.area}</span></p>
                        <p className="text-xs text-gray-500">Evidence: {c.evidence}</p>
                        <p className="text-xs text-green-600 font-medium mt-1">Expected: {c.expected_impact}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* New Tests to Run */}
            {analysis.new_tests_to_run?.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-purple-600" /> AI-Recommended New Tests</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-3">
                    {analysis.new_tests_to_run.map((t, i) => (
                      <div key={i} className="p-3 border border-purple-100 bg-purple-50/40 rounded-xl">
                        <p className="text-sm font-semibold text-gray-900 mb-1">{t.name}</p>
                        <p className="text-xs text-gray-500 mb-2 italic">{t.hypothesis}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">A: {t.variant_a}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">B: {t.variant_b}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feature Priorities */}
            {analysis.feature_priorities?.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Feature Priority Queue (Survey-Driven)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {analysis.feature_priorities.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 text-center">
                        <span className="text-xs font-black text-gray-300">#{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <p className="text-sm font-medium text-gray-800">{f.feature}</p>
                          <span className="text-xs font-bold text-amber-600">{f.priority_score}/100</span>
                        </div>
                        <Progress value={f.priority_score} className="h-1.5" />
                        <p className="text-xs text-gray-400 mt-0.5">{f.reason}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Auto-apply changes */}
            {analysis.auto_apply_changes?.length > 0 && (
              <Card className="border-0 shadow-md border-l-4 border-l-green-500">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-600" /> Auto-Applicable Changes</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {analysis.auto_apply_changes.map((c, i) => (
                    <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg ${c.safe_to_auto_apply ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${c.safe_to_auto_apply ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-800">{c.description}</p>
                        <p className="text-xs text-gray-400 capitalize">{c.change_type?.replace(/_/g, ' ')}</p>
                      </div>
                      {c.safe_to_auto_apply && <Badge className="bg-green-100 text-green-700 text-xs">Safe to Apply</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}