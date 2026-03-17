import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, LineChart, Line
} from 'recharts';
import {
  Loader2, Sparkles, BarChart2, TrendingUp, MessageSquare,
  RefreshCw, Globe, Shield, Clock, Users, Star, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

function QualityGauge({ score }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';
  return (
    <div className="text-center space-y-2">
      <div className="relative w-28 h-28 mx-auto">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${(score / 100) * 251.2} 251.2`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{ color }}>{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <Badge className={score >= 80 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
        {label} Quality
      </Badge>
    </div>
  );
}

// Simple word-frequency word cloud rendered as sized spans
function WordCloud({ responses }) {
  const words = {};
  responses.forEach(r => {
    (r.answers || []).forEach(a => {
      if (a.open_text) {
        a.open_text.toLowerCase().split(/\W+/).filter(w => w.length > 3).forEach(w => {
          words[w] = (words[w] || 0) + 1;
        });
      }
    });
  });
  const sorted = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 40);
  if (sorted.length === 0) return <p className="text-sm text-gray-400 text-center py-4">No open-text responses yet</p>;
  const max = sorted[0][1];
  return (
    <div className="flex flex-wrap gap-2 justify-center py-4">
      {sorted.map(([word, count]) => {
        const size = 12 + Math.round((count / max) * 24);
        const opacity = 0.5 + (count / max) * 0.5;
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        return (
          <span key={word} style={{ fontSize: size, opacity, color }} className="font-semibold cursor-default">
            {word}
          </span>
        );
      })}
    </div>
  );
}

export default function SurveyAnalytics() {
  const [user, setUser] = useState(null);
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [aiReport, setAiReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('survey_id');
    if (surveyId) setSelectedSurveyId(surveyId);
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: surveys = [] } = useQuery({
    queryKey: ['analytics-surveys', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { data: responses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['analytics-responses', selectedSurveyId],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ survey_id: selectedSurveyId }, '-created_date', 500),
    enabled: !!selectedSurveyId,
  });

  const selectedSurvey = surveys.find(s => s.id === selectedSurveyId);

  const completedResponses = responses.filter(r => r.completed);
  const completionRate = responses.length > 0 ? Math.round((completedResponses.length / responses.length) * 100) : 0;
  const avgQuality = responses.length > 0
    ? Math.round(responses.filter(r => r.quality_score != null).reduce((s, r) => s + r.quality_score, 0) / Math.max(1, responses.filter(r => r.quality_score != null).length))
    : selectedSurvey?.avg_quality_score || 0;
  const avgTime = responses.length > 0
    ? Math.round(responses.filter(r => r.time_taken_seconds).reduce((s, r) => s + r.time_taken_seconds, 0) / Math.max(1, responses.filter(r => r.time_taken_seconds).length))
    : 0;

  // Per-question answer distribution
  const questionCharts = (selectedSurvey?.questions || []).map((q, qi) => {
    const counts = { a: 0, b: 0, c: 0, d: 0 };
    responses.forEach(r => {
      const ans = r.answers?.find(a => a.question_index === qi);
      if (ans?.selected_option) counts[ans.selected_option]++;
    });
    return {
      question: q.question,
      data: [
        { name: `A`, full: q.option_a, value: counts.a },
        { name: `B`, full: q.option_b, value: counts.b },
        { name: `C`, full: q.option_c, value: counts.c },
        { name: `D`, full: q.option_d, value: counts.d },
      ],
    };
  });

  // Quality score distribution histogram
  const qualityBuckets = [
    { range: '0-20', min: 0, max: 20, count: 0 },
    { range: '21-40', min: 21, max: 40, count: 0 },
    { range: '41-60', min: 41, max: 60, count: 0 },
    { range: '61-80', min: 61, max: 80, count: 0 },
    { range: '81-100', min: 81, max: 100, count: 0 },
  ];
  responses.forEach(r => {
    const qs = r.quality_score ?? 0;
    const bucket = qualityBuckets.find(b => qs >= b.min && qs <= b.max);
    if (bucket) bucket.count++;
  });

  // Language breakdown
  const langCounts = {};
  responses.forEach(r => { langCounts[r.language || 'en'] = (langCounts[r.language || 'en'] || 0) + 1; });
  const langData = Object.entries(langCounts).map(([lang, count]) => ({ name: lang.toUpperCase(), value: count }));

  // Response trend over time (daily)
  const trendMap = {};
  responses.forEach(r => {
    const day = r.created_date ? r.created_date.slice(0, 10) : 'unknown';
    trendMap[day] = (trendMap[day] || 0) + 1;
  });
  const trendData = Object.entries(trendMap).sort().map(([date, count]) => ({ date: date.slice(5), count }));

  const generateAIReport = async () => {
    if (!selectedSurveyId) return;
    setLoadingReport(true);
    try {
      const res = await base44.functions.invoke('surveyAnalyticsAI', {
        survey_id: selectedSurveyId,
        survey_title: selectedSurvey?.title,
        questions: selectedSurvey?.questions,
        responses_count: responses.length,
        question_charts: questionCharts,
        avg_quality_score: avgQuality,
        completion_rate: completionRate,
      });
      if (res.data?.success) { setAiReport(res.data.report); toast.success('AI report generated!'); }
      else toast.error('AI report failed');
    } catch { toast.error('Failed to generate report'); }
    finally { setLoadingReport(false); }
  };

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-7 h-7 text-purple-600" /> Survey Analytics
            </h1>
            <p className="text-gray-500 text-sm">Per-survey response analysis with data quality scoring</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
              <SelectTrigger className="w-72 border-2">
                <SelectValue placeholder="Select a survey…" />
              </SelectTrigger>
              <SelectContent>
                {surveys.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.title} ({s.responses_count || 0} responses)</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSurveyId && (
              <Button onClick={generateAIReport} disabled={loadingReport}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                {loadingReport ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</> : <><Sparkles className="w-4 h-4 mr-2" />AI Report</>}
              </Button>
            )}
          </div>
        </div>

        {!selectedSurveyId && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-12 text-center text-gray-400">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Select a survey above to view its analytics dashboard.
            </CardContent>
          </Card>
        )}

        {selectedSurvey && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Total Responses', value: responses.length, icon: Users, color: 'text-purple-600' },
                { label: 'Completed', value: completedResponses.length, icon: Star, color: 'text-green-600' },
                { label: 'Completion Rate', value: `${completionRate}%`, icon: TrendingUp, color: 'text-blue-600' },
                { label: 'Avg Quality Score', value: avgQuality, icon: Shield, color: avgQuality >= 70 ? 'text-green-600' : avgQuality >= 50 ? 'text-yellow-600' : 'text-red-500' },
                { label: 'Avg Time', value: avgTime > 0 ? `${Math.floor(avgTime / 60)}m ${avgTime % 60}s` : '—', icon: Clock, color: 'text-indigo-600' },
              ].map((kpi, i) => (
                <Card key={i} className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="responses">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="responses">Responses</TabsTrigger>
                <TabsTrigger value="quality">Data Quality</TabsTrigger>
                <TabsTrigger value="languages">Languages</TabsTrigger>
                <TabsTrigger value="ai">AI Report</TabsTrigger>
              </TabsList>

              {/* Tab: Responses */}
              <TabsContent value="responses" className="space-y-5 mt-4">
                {/* Response trend */}
                {trendData.length > 1 && (
                  <Card className="border-0 shadow-md">
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-600" /> Responses Over Time</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={trendData}>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Per-question charts */}
                {loadingResponses ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
                ) : responses.length === 0 ? (
                  <Card className="border-0 shadow-md">
                    <CardContent className="p-10 text-center text-gray-400">No responses yet. Charts appear once respondents complete the survey.</CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {questionCharts.map((qc, i) => (
                      <Card key={i} className="border-0 shadow-md">
                        <CardHeader className="pb-2">
                          <p className="text-xs font-semibold text-purple-600 uppercase">Q{i + 1}</p>
                          <p className="text-sm font-medium text-gray-800 leading-snug">{qc.question}</p>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={130}>
                            <BarChart data={qc.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip formatter={(val, name, props) => [val, props.payload.full || name]} />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {qc.data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Word cloud */}
                <Card className="border-0 shadow-md">
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-indigo-600" /> Open Response Word Cloud</CardTitle></CardHeader>
                  <CardContent><WordCloud responses={responses} /></CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Data Quality */}
              <TabsContent value="quality" className="space-y-5 mt-4">
                <div className="grid md:grid-cols-2 gap-5">
                  <Card className="border-0 shadow-md">
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-green-600" /> Average Data Quality Score</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center py-6">
                      <QualityGauge score={avgQuality} />
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-md">
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-purple-600" /> Quality Score Distribution</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={qualityBuckets}>
                          <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {qualityBuckets.map((b, i) => (
                              <Cell key={i} fill={b.min >= 61 ? '#10b981' : b.min >= 41 ? '#f59e0b' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Per-response quality breakdown */}
                <Card className="border-0 shadow-md">
                  <CardHeader><CardTitle className="text-sm">Individual Response Quality Scores</CardTitle></CardHeader>
                  <CardContent>
                    {responses.length === 0 ? (
                      <p className="text-center text-gray-400 py-4 text-sm">No responses yet</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {responses.slice(0, 50).map((r, i) => {
                          const qs = r.quality_score ?? 0;
                          const color = qs >= 80 ? 'text-green-600' : qs >= 60 ? 'text-yellow-600' : 'text-red-500';
                          return (
                            <div key={r.id || i} className="flex items-center gap-3 py-1">
                              <span className="text-xs text-gray-400 w-6">#{i + 1}</span>
                              <Progress value={qs} className="flex-1 h-2" />
                              <span className={`text-xs font-bold w-8 text-right ${color}`}>{qs}</span>
                              {r.quality_penalties?.length > 0 && (
                                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" title={r.quality_penalties.join(', ')} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Languages */}
              <TabsContent value="languages" className="space-y-5 mt-4">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" /> Respondent Language Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {langData.length === 0 ? (
                      <p className="text-center text-gray-400 py-8 text-sm">No language data yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={langData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {langData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}

                    {/* Available translations on this survey */}
                    {(selectedSurvey?.available_languages?.length || 0) > 1 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Active Language Versions</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSurvey.available_languages.map(lang => (
                            <Badge key={lang} className="bg-blue-100 text-blue-700">{lang.toUpperCase()}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: AI Report */}
              <TabsContent value="ai" className="mt-4">
                {!aiReport ? (
                  <Card className="border-0 shadow-md">
                    <CardContent className="p-10 text-center space-y-4">
                      <Sparkles className="w-10 h-10 text-purple-400 mx-auto" />
                      <p className="text-gray-600">Click "AI Report" above to generate an in-depth analysis of this survey's responses, trends, and recommendations.</p>
                      <Button onClick={generateAIReport} disabled={loadingReport}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                        {loadingReport ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</> : <><Sparkles className="w-4 h-4 mr-2" />Generate AI Report</>}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" /> AI Analysis Report
                        <Button size="sm" variant="ghost" onClick={generateAIReport} disabled={loadingReport} className="ml-auto">
                          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {aiReport.summary && (
                        <div>
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">Executive Summary</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{aiReport.summary}</p>
                        </div>
                      )}
                      {aiReport.quality_assessment && (
                        <div>
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">Data Quality Assessment</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{aiReport.quality_assessment}</p>
                        </div>
                      )}
                      {aiReport.sentiment && (
                        <div>
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2">Sentiment</p>
                          <div className="flex gap-2 flex-wrap">
                            {Object.entries(aiReport.sentiment).map(([k, v]) => (
                              <Badge key={k} className={k === 'positive' ? 'bg-green-100 text-green-800' : k === 'negative' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}>
                                {k}: {v}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {aiReport.trends?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2">Key Trends</p>
                          <ul className="space-y-1.5">
                            {aiReport.trends.map((t, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <TrendingUp className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" /> {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiReport.recommendations?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2">Recommendations</p>
                          <ul className="space-y-1.5">
                            {aiReport.recommendations.map((r, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <MessageSquare className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" /> {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}