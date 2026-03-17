import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, ScatterChart, Scatter, ZAxis, PieChart, Pie, Legend
} from 'recharts';
import { Loader2, Sparkles, BarChart2, TrendingUp, MessageSquare, RefreshCw, Layers, Brain, Clock } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function AdvancedSurveyAnalytics() {
  const [user, setUser] = useState(null);
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [crossTabQ1, setCrossTabQ1] = useState('0');
  const [crossTabQ2, setCrossTabQ2] = useState('1');
  const [sentimentData, setSentimentData] = useState(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('survey_id');
    if (sid) setSelectedSurveyId(sid);
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: surveys = [] } = useQuery({
    queryKey: ['adv-surveys', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['adv-responses', selectedSurveyId],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ survey_id: selectedSurveyId }, '-created_date', 500),
    enabled: !!selectedSurveyId,
  });

  const survey = surveys.find(s => s.id === selectedSurveyId);
  const questions = survey?.questions || [];

  // Cross-tabulation
  const crossTab = useMemo(() => {
    const q1 = parseInt(crossTabQ1);
    const q2 = parseInt(crossTabQ2);
    if (!questions[q1] || !questions[q2] || q1 === q2) return null;

    const matrix = {};
    const opts = ['a', 'b', 'c', 'd'];
    opts.forEach(o1 => {
      matrix[o1] = {};
      opts.forEach(o2 => { matrix[o1][o2] = 0; });
    });

    responses.forEach(r => {
      const a1 = r.answers?.find(a => a.question_index === q1)?.selected_option;
      const a2 = r.answers?.find(a => a.question_index === q2)?.selected_option;
      if (a1 && a2) matrix[a1][a2]++;
    });

    // Convert to recharts format
    return opts.map(o1 => ({
      name: questions[q1][`option_${o1}`]?.slice(0, 20) || o1.toUpperCase(),
      ...Object.fromEntries(opts.map(o2 => [
        questions[q2][`option_${o2}`]?.slice(0, 15) || o2.toUpperCase(),
        matrix[o1][o2]
      ]))
    }));
  }, [responses, crossTabQ1, crossTabQ2, questions]);

  const crossTabKeys = useMemo(() => {
    const q2 = parseInt(crossTabQ2);
    if (!questions[q2]) return [];
    return ['a', 'b', 'c', 'd'].map(o => questions[q2][`option_${o}`]?.slice(0, 15) || o.toUpperCase());
  }, [crossTabQ2, questions]);

  // Trend by week
  const weeklyTrend = useMemo(() => {
    const weeks = {};
    responses.forEach(r => {
      if (!r.created_date) return;
      const d = new Date(r.created_date);
      const weekStart = new Date(d.setDate(d.getDate() - d.getDay())).toISOString().slice(0, 10);
      if (!weeks[weekStart]) weeks[weekStart] = { date: weekStart, total: 0, completed: 0, avg_quality: [], fraud: 0 };
      weeks[weekStart].total++;
      if (r.completed) weeks[weekStart].completed++;
      if (r.quality_score != null) weeks[weekStart].avg_quality.push(r.quality_score);
      if (r.is_flagged || r.is_blocked) weeks[weekStart].fraud++;
    });
    return Object.values(weeks).sort((a, b) => a.date.localeCompare(b.date)).map(w => ({
      ...w,
      avg_quality: w.avg_quality.length ? Math.round(w.avg_quality.reduce((s, v) => s + v, 0) / w.avg_quality.length) : 0,
      completion_rate: w.total ? Math.round((w.completed / w.total) * 100) : 0,
    }));
  }, [responses]);

  // Sentiment analysis via AI
  const runSentiment = async () => {
    const openTexts = responses.flatMap(r => (r.answers || []).filter(a => a.open_text).map(a => a.open_text)).slice(0, 100);
    if (openTexts.length < 3) { toast.error('Need at least 3 open-text responses for sentiment analysis'); return; }
    setLoadingSentiment(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform sentiment analysis on these ${openTexts.length} survey open-text responses. Categorize each as positive, negative, or neutral. Also extract the top 5 themes and provide an overall summary.

Responses:
${openTexts.map((t, i) => `${i + 1}. "${t}"`).join('\n')}`,
        response_json_schema: {
          type: 'object',
          properties: {
            positive_count: { type: 'number' },
            negative_count: { type: 'number' },
            neutral_count: { type: 'number' },
            overall_sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral', 'mixed'] },
            top_themes: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
            notable_quotes: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      setSentimentData(result);
      toast.success('Sentiment analysis complete!');
    } catch { toast.error('Sentiment analysis failed'); }
    finally { setLoadingSentiment(false); }
  };

  // Completion time histogram
  const timeHistogram = useMemo(() => {
    const buckets = [
      { range: '<1m', max: 60, count: 0 },
      { range: '1-2m', max: 120, count: 0 },
      { range: '2-5m', max: 300, count: 0 },
      { range: '5-10m', max: 600, count: 0 },
      { range: '10m+', max: Infinity, count: 0 },
    ];
    responses.filter(r => r.time_taken_seconds > 0).forEach(r => {
      const b = buckets.find(bk => r.time_taken_seconds <= bk.max);
      if (b) b.count++;
    });
    return buckets;
  }, [responses]);

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-purple-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="w-7 h-7 text-purple-600" /> Advanced Analytics
            </h1>
            <p className="text-gray-500 text-sm">Cross-tabulations, sentiment analysis, and trend reporting</p>
          </div>
          <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
            <SelectTrigger className="w-72 border-2">
              <SelectValue placeholder="Select a survey…" />
            </SelectTrigger>
            <SelectContent>
              {surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!selectedSurveyId ? (
          <Card className="border-0 shadow-md">
            <CardContent className="p-12 text-center text-gray-400">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Select a survey to view advanced analytics
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 animate-spin text-purple-400" /></div>
        ) : (
          <Tabs defaultValue="crosstab">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="crosstab"><Layers className="w-3.5 h-3.5 mr-1.5" />Cross-Tab</TabsTrigger>
              <TabsTrigger value="sentiment"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Sentiment</TabsTrigger>
              <TabsTrigger value="trends"><TrendingUp className="w-3.5 h-3.5 mr-1.5" />Trends</TabsTrigger>
              <TabsTrigger value="timing"><Clock className="w-3.5 h-3.5 mr-1.5" />Timing</TabsTrigger>
            </TabsList>

            {/* Cross-Tab */}
            <TabsContent value="crosstab" className="space-y-4 mt-4">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-purple-600" /> Cross-Tabulation</CardTitle>
                  <p className="text-xs text-gray-400">See how answers to one question relate to another</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Row Question</label>
                      <Select value={crossTabQ1} onValueChange={setCrossTabQ1}>
                        <SelectTrigger className="border-2 text-sm h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {questions.map((q, i) => <SelectItem key={i} value={String(i)}>Q{i + 1}: {q.question.slice(0, 40)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Column Question</label>
                      <Select value={crossTabQ2} onValueChange={setCrossTabQ2}>
                        <SelectTrigger className="border-2 text-sm h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {questions.map((q, i) => <SelectItem key={i} value={String(i)}>Q{i + 1}: {q.question.slice(0, 40)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {crossTab && crossTabKeys.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={crossTab} margin={{ left: -10 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {crossTabKeys.map((key, i) => (
                          <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === crossTabKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-400 py-8 text-sm">Select two different questions to see cross-tabulation</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sentiment */}
            <TabsContent value="sentiment" className="space-y-4 mt-4">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-indigo-600" /> AI Sentiment Analysis</CardTitle>
                    <Button size="sm" onClick={runSentiment} disabled={loadingSentiment} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                      {loadingSentiment ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Analyzing…</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Run Analysis</>}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!sentimentData ? (
                    <div className="text-center py-10 text-gray-400">
                      <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Click "Run Analysis" to analyze open-text responses with AI</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Sentiment distribution */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Positive', count: sentimentData.positive_count, color: 'text-green-600 bg-green-50 border-green-200' },
                          { label: 'Neutral', count: sentimentData.neutral_count, color: 'text-gray-600 bg-gray-50 border-gray-200' },
                          { label: 'Negative', count: sentimentData.negative_count, color: 'text-red-500 bg-red-50 border-red-200' },
                        ].map(s => (
                          <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
                            <p className="text-2xl font-black">{s.count}</p>
                            <p className="text-xs font-semibold">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className={`text-sm font-semibold px-3 py-2 rounded-xl text-center ${
                        sentimentData.overall_sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                        sentimentData.overall_sentiment === 'negative' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        Overall: {sentimentData.overall_sentiment?.toUpperCase()}
                      </div>

                      {sentimentData.summary && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">AI Summary</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{sentimentData.summary}</p>
                        </div>
                      )}

                      {sentimentData.top_themes?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Top Themes</p>
                          <div className="flex flex-wrap gap-2">
                            {sentimentData.top_themes.map((t, i) => (
                              <Badge key={i} className="bg-indigo-100 text-indigo-700">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {sentimentData.notable_quotes?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Notable Quotes</p>
                          <div className="space-y-2">
                            {sentimentData.notable_quotes.map((q, i) => (
                              <blockquote key={i} className="text-sm text-gray-600 italic border-l-4 border-indigo-300 pl-3">"{q}"</blockquote>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Trends */}
            <TabsContent value="trends" className="space-y-4 mt-4">
              {weeklyTrend.length < 2 ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="py-10 text-center text-gray-400 text-sm">Need responses over multiple weeks to show trends</CardContent>
                </Card>
              ) : (
                <>
                  <Card className="border-0 shadow-md">
                    <CardHeader><CardTitle className="text-sm">Weekly Response Volume</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={weeklyTrend}>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="total" name="Responses" stroke="#7c3aed" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="border-0 shadow-md">
                      <CardHeader><CardTitle className="text-sm">Completion Rate Trend</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={weeklyTrend}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip formatter={v => `${v}%`} />
                            <Line type="monotone" dataKey="completion_rate" name="Completion %" stroke="#10b981" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md">
                      <CardHeader><CardTitle className="text-sm">Avg Quality Score Trend</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={weeklyTrend}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="avg_quality" name="Avg Quality" stroke="#f59e0b" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Timing */}
            <TabsContent value="timing" className="mt-4">
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Completion Time Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={timeHistogram}>
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Responses" radius={[4, 4, 0, 0]}>
                        {timeHistogram.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}