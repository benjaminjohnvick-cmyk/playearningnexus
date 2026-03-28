import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell } from 'recharts';
import { TrendingDown, AlertTriangle, Users, CheckCircle, Loader2, RefreshCw, Flame } from 'lucide-react';

const HEAT_COLORS = ['#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e','#fef9c3','#fef08a','#fde047','#facc15','#f97316','#ef4444','#dc2626'];

function getHeatColor(rate) {
  // rate = dropoff % 0-100. Green = low dropoff, red = high dropoff
  const idx = Math.min(11, Math.floor((rate / 100) * 12));
  return HEAT_COLORS[idx];
}

function HeatmapCell({ label, dropoffRate, count, isWorst }) {
  const bg = getHeatColor(dropoffRate);
  return (
    <div className={`relative rounded-xl p-3 border-2 transition-all cursor-default ${isWorst ? 'border-red-400 shadow-lg scale-105' : 'border-transparent'}`}
      style={{ backgroundColor: bg }}
      title={`${label}: ${dropoffRate.toFixed(1)}% dropped off here (${count} users)`}>
      <p className="text-xs font-bold text-gray-800 truncate">{label}</p>
      <p className="text-lg font-black text-gray-900">{dropoffRate.toFixed(0)}%</p>
      <p className="text-xs text-gray-600">{count} dropped</p>
      {isWorst && (
        <div className="absolute -top-2 -right-2">
          <Flame className="w-5 h-5 text-red-500" />
        </div>
      )}
    </div>
  );
}

function SurveyAnalysisCard({ survey, responses }) {
  if (!survey || !responses.length) return null;

  const questions = survey.questions || [];
  const totalStarted = responses.length;
  const totalCompleted = responses.filter(r => r.completed).length;
  const overallCompletion = totalStarted > 0 ? (totalCompleted / totalStarted * 100) : 0;

  // Build per-question drop-off analysis
  const questionStats = questions.map((q, idx) => {
    const reached = responses.filter(r => {
      const answers = r.answers || [];
      return answers.length > idx; // answered at least up to this question
    }).length;
    const answeredThis = responses.filter(r => {
      const answers = r.answers || [];
      return answers[idx] !== undefined;
    }).length;
    const droppedHere = reached - answeredThis;
    const dropoffRate = reached > 0 ? (droppedHere / reached * 100) : 0;
    return {
      name: `Q${idx + 1}`,
      fullLabel: q.question?.slice(0, 40) + (q.question?.length > 40 ? '…' : '') || `Question ${idx + 1}`,
      reached,
      answered: answeredThis,
      droppedHere,
      dropoffRate,
    };
  });

  // Funnel data
  const funnelData = [
    { name: 'Started', value: totalStarted, fill: '#6366f1' },
    ...questionStats.map((s, i) => ({ name: `Q${i + 1}`, value: s.reached, fill: `hsl(${240 - i * 20}, 70%, 60%)` })),
    { name: 'Completed', value: totalCompleted, fill: '#10b981' },
  ];

  const worstIdx = questionStats.reduce((worst, s, i) => s.dropoffRate > (questionStats[worst]?.dropoffRate || 0) ? i : worst, 0);
  const avgTime = responses.filter(r => r.time_taken_seconds).reduce((s, r) => s + r.time_taken_seconds, 0) / Math.max(1, responses.filter(r => r.time_taken_seconds).length);

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Started', val: totalStarted, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Completed', val: totalCompleted, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Completion Rate', val: overallCompletion.toFixed(1) + '%', color: overallCompletion >= 70 ? 'text-green-600' : overallCompletion >= 40 ? 'text-yellow-600' : 'text-red-600', bg: 'bg-gray-50' },
          { label: 'Avg Time', val: avgTime > 0 ? `${Math.round(avgTime)}s` : 'N/A', color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <Card key={s.label} className={`${s.bg} border-0`}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Completion Funnel</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, totalStarted]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${v} users (${totalStarted > 0 ? (v / totalStarted * 100).toFixed(1) : 0}%)`, 'Reached']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Heatmap grid */}
      {questionStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" /> Drop-off Heatmap by Question
            </CardTitle>
            <p className="text-xs text-gray-400">Red = high drop-off, green = low drop-off</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {questionStats.map((s, i) => (
                <HeatmapCell
                  key={i}
                  label={s.name}
                  dropoffRate={s.dropoffRate}
                  count={s.droppedHere}
                  isWorst={i === worstIdx && s.dropoffRate > 0}
                />
              ))}
            </div>
            {questionStats[worstIdx]?.dropoffRate > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Biggest Drop-off: Q{worstIdx + 1}</p>
                  <p className="text-xs text-red-600">"{questionStats[worstIdx]?.fullLabel}" — {questionStats[worstIdx]?.dropoffRate.toFixed(1)}% of users quit here ({questionStats[worstIdx]?.droppedHere} users). Consider simplifying or reordering this question.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bar chart: drop-off per question */}
      {questionStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Drop-off Rate per Question (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={questionStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Drop-off Rate']} />
                <Bar dataKey="dropoffRate" name="Drop-off %" radius={[4,4,0,0]}>
                  {questionStats.map((s, i) => <Cell key={i} fill={i === worstIdx ? '#ef4444' : '#6366f1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SurveyDropoffAnalytics() {
  const [selectedSurveyId, setSelectedSurveyId] = useState('');

  const { data: surveys = [], isLoading: loadingSurveys } = useQuery({
    queryKey: ['admin_surveys_dropoff'],
    queryFn: () => base44.entities.PPCSurvey.list('-responses_count', 50),
  });

  const { data: responses = [], isLoading: loadingResponses, refetch } = useQuery({
    queryKey: ['admin_responses_dropoff', selectedSurveyId],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ survey_id: selectedSurveyId }, '-created_date', 500),
    enabled: !!selectedSurveyId,
  });

  const selectedSurvey = surveys.find(s => s.id === selectedSurveyId);

  // Platform-wide stats
  const { data: allResponses = [] } = useQuery({
    queryKey: ['admin_all_responses_overview'],
    queryFn: () => base44.entities.PPCSurveyResponse.list('-created_date', 200),
  });

  const platformCompletion = allResponses.length > 0
    ? (allResponses.filter(r => r.completed).length / allResponses.length * 100).toFixed(1)
    : 0;
  const flaggedCount = allResponses.filter(r => r.is_flagged).length;
  const blockedCount = allResponses.filter(r => r.is_blocked).length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900">Survey Drop-off Analytics & Heatmaps</h3>
        <p className="text-sm text-gray-500">Identify exactly where users abandon surveys to improve completion rates</p>
      </div>

      {/* Platform overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{platformCompletion}%</p>
            <p className="text-xs text-gray-500">Platform Completion Rate</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{flaggedCount}</p>
            <p className="text-xs text-gray-500">Flagged Responses</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-red-600">{blockedCount}</p>
            <p className="text-xs text-gray-500">Blocked Responses</p>
          </CardContent>
        </Card>
      </div>

      {/* Survey selector */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-semibold text-gray-700 flex-shrink-0">Analyze survey:</p>
            <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder={loadingSurveys ? 'Loading surveys…' : 'Select a survey to analyze'} />
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
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedSurveyId && (
        loadingResponses ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : (
          <SurveyAnalysisCard survey={selectedSurvey} responses={responses} />
        )
      )}

      {!selectedSurveyId && (
        <div className="text-center py-16 text-gray-400">
          <TrendingDown className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Select a survey above to view its drop-off heatmap and funnel analysis</p>
        </div>
      )}
    </div>
  );
}