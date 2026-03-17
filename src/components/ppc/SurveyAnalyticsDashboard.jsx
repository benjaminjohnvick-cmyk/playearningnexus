import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Loader2, Sparkles, BarChart2, TrendingUp, MessageSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function SurveyAnalyticsDashboard({ user }) {
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [aiReport, setAiReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const { data: surveys = [] } = useQuery({
    queryKey: ['my-surveys', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }),
    enabled: !!user?.id
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['survey-responses', selectedSurveyId],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ survey_id: selectedSurveyId }),
    enabled: !!selectedSurveyId
  });

  const selectedSurvey = surveys.find(s => s.id === selectedSurveyId);

  // Build per-question answer distribution
  const questionCharts = selectedSurvey?.questions?.map((q, qi) => {
    const counts = { a: 0, b: 0, c: 0, d: 0 };
    responses.forEach(r => {
      const ans = r.answers?.find(a => a.question_index === qi);
      if (ans?.selected_option) counts[ans.selected_option]++;
    });
    return {
      question: q.question,
      data: [
        { name: `A: ${q.option_a?.slice(0, 20)}…`, value: counts.a },
        { name: `B: ${q.option_b?.slice(0, 20)}…`, value: counts.b },
        { name: `C: ${q.option_c?.slice(0, 20)}…`, value: counts.d },
        { name: `D: ${q.option_d?.slice(0, 20)}…`, value: counts.d },
      ]
    };
  }) || [];

  const completionRate = responses.length > 0
    ? Math.round((responses.filter(r => r.completed).length / responses.length) * 100)
    : 0;

  const generateAIReport = async () => {
    if (!selectedSurveyId) return;
    setLoadingReport(true);
    try {
      const res = await base44.functions.invoke('surveyAnalyticsAI', {
        survey_id: selectedSurveyId,
        survey_title: selectedSurvey?.title,
        questions: selectedSurvey?.questions,
        responses_count: responses.length,
        question_charts: questionCharts
      });
      if (res.data?.success) {
        setAiReport(res.data.report);
        toast.success('AI report generated!');
      }
    } catch {
      toast.error('Failed to generate AI report');
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-purple-200 bg-purple-50">
        <CardContent className="p-4 flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-purple-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-purple-900">AI Survey Analytics Dashboard</p>
            <p className="text-sm text-purple-700">Select one of your surveys to view response data, visualizations, sentiment analysis, and AI-generated trend reports.</p>
          </div>
        </CardContent>
      </Card>

      {/* Survey Picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
          <SelectTrigger className="w-72 border-2">
            <SelectValue placeholder="Select a survey to analyze…" />
          </SelectTrigger>
          <SelectContent>
            {surveys.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.title} ({s.responses_count || 0} responses)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSurveyId && (
          <Button onClick={generateAIReport} disabled={loadingReport}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
            {loadingReport
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</>
              : <><Sparkles className="w-4 h-4 mr-2" />Generate AI Report</>}
          </Button>
        )}
      </div>

      {selectedSurvey && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Responses', value: responses.length, color: 'text-purple-600' },
              { label: 'Completion Rate', value: `${completionRate}%`, color: 'text-green-600' },
              { label: 'Target Responses', value: selectedSurvey.sample_size || 100, color: 'text-blue-600' },
              { label: 'Progress', value: `${Math.min(100, Math.round((responses.length / (selectedSurvey.sample_size || 100)) * 100))}%`, color: 'text-orange-600' },
            ].map((kpi, i) => (
              <Card key={i} className="border-0 shadow-md">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Question Charts */}
          {questionCharts.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" /> Response Distribution by Question
              </h3>
              {responses.length === 0 ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="p-8 text-center text-gray-400">
                    No responses yet — charts will appear once users start completing your survey.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {questionCharts.slice(0, 6).map((qc, i) => (
                    <Card key={i} className="border-0 shadow-md">
                      <CardHeader className="pb-2">
                        <p className="text-xs font-semibold text-gray-500">Q{i + 1}</p>
                        <p className="text-sm font-medium text-gray-800">{qc.question}</p>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={qc.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
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
            </div>
          )}

          {/* AI Report */}
          {aiReport && (
            <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" /> AI Analysis Report
                  <Button size="sm" variant="ghost" onClick={generateAIReport} disabled={loadingReport}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiReport.summary && (
                  <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">Executive Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{aiReport.summary}</p>
                  </div>
                )}
                {aiReport.sentiment && (
                  <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2">Sentiment Analysis</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {Object.entries(aiReport.sentiment).map(([key, val]) => (
                        <Badge key={key} className={
                          key === 'positive' ? 'bg-green-100 text-green-800' :
                          key === 'negative' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'
                        }>{key}: {val}</Badge>
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
        </>
      )}

      {!selectedSurveyId && surveys.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-10 text-center text-gray-400">
            You haven't created any surveys yet. Use the <strong>Publish Survey</strong> tab to create one.
          </CardContent>
        </Card>
      )}
    </div>
  );
}