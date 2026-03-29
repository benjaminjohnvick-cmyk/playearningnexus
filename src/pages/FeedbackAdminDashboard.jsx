import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  ClipboardList, Brain, CheckCircle, XCircle, Clock, 
  Loader2, Play, RefreshCw, AlertTriangle, TrendingUp,
  Users, Star, Lightbulb, ChevronDown, ChevronUp, PenLine
} from 'lucide-react';
import ManualFeedbackSurveyBuilder from '@/components/feedback/ManualFeedbackSurveyBuilder';
import { toast } from 'sonner';

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  low: 'bg-gray-100 text-gray-600 border-gray-300'
};

const STATUS_CONFIG = {
  pending_review: { label: 'Pending Review', icon: Clock, color: 'text-yellow-600' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600' },
  implemented: { label: 'Implemented', icon: CheckCircle, color: 'text-blue-600' }
};

function ChangeCard({ change, analysisId, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(change.reviewer_notes || '');
  const [saving, setSaving] = useState(false);
  const StatusIcon = STATUS_CONFIG[change.status]?.icon || Clock;

  const handleDecision = async (newStatus) => {
    setSaving(true);
    try {
      const analyses = await base44.entities.AIFeedbackAnalysis.filter({ id: analysisId });
      if (!analyses.length) return;
      const analysis = analyses[0];
      const updatedChanges = analysis.recommended_changes.map(c =>
        c.id === change.id
          ? { ...c, status: newStatus, reviewer_notes: notes, reviewed_by: 'admin', reviewed_at: new Date().toISOString() }
          : c
      );
      await base44.entities.AIFeedbackAnalysis.update(analysisId, { recommended_changes: updatedChanges });
      toast.success(`Change ${newStatus === 'approved' ? 'approved' : 'rejected'}`);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`border rounded-xl p-4 ${change.status === 'approved' ? 'bg-green-50 border-green-200' : change.status === 'rejected' ? 'bg-red-50 border-red-200 opacity-60' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Badge className={`border text-xs ${PRIORITY_COLORS[change.priority]}`}>
              {change.priority?.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">{change.category}</Badge>
            <span className={`text-xs flex items-center gap-1 ${STATUS_CONFIG[change.status]?.color}`}>
              <StatusIcon className="w-3 h-3" />
              {STATUS_CONFIG[change.status]?.label}
            </span>
          </div>
          <h4 className="font-semibold text-gray-900">{change.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{change.description}</p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 mt-1">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t pt-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Rationale (from user data)</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{change.rationale}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Affected Area</p>
            <p className="text-sm text-gray-700">{change.affected_area}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Implementation Notes</p>
            <p className="text-sm text-gray-700 bg-blue-50 rounded p-2">{change.implementation_notes}</p>
          </div>
          {change.status === 'pending_review' && (
            <div>
              <Textarea
                placeholder="Add reviewer notes (optional)..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="text-sm min-h-[70px] mb-2"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleDecision('approved')} disabled={saving}
                  className="bg-green-600 hover:bg-green-700 flex-1">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDecision('rejected')} disabled={saving}
                  className="text-red-600 border-red-300 hover:bg-red-50 flex-1">
                  <XCircle className="w-3 h-3 mr-1" /> Reject
                </Button>
              </div>
            </div>
          )}
          {change.reviewed_at && (
            <p className="text-xs text-gray-400">Reviewed at {new Date(change.reviewed_at).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function FeedbackAdminDashboard({ embedded = false }) {
  const [user, setUser] = useState(null);
  const [generatingSurvey, setGeneratingSurvey] = useState(false);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: surveys = [] } = useQuery({
    queryKey: ['feedback_surveys'],
    queryFn: () => base44.entities.DailyFeedbackSurvey.list('-date', 30),
    enabled: !!user
  });

  const { data: analyses = [], refetch: refetchAnalyses } = useQuery({
    queryKey: ['feedback_analyses'],
    queryFn: () => base44.entities.AIFeedbackAnalysis.list('-survey_date', 30),
    enabled: !!user
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['feedback_responses'],
    queryFn: () => base44.entities.FeedbackSurveyResponse.list('-created_date', 200),
    enabled: !!user
  });

  const today = new Date().toISOString().split('T')[0];
  const todaySurvey = surveys.find(s => s.date === today);
  const todayResponses = responses.filter(r => r.survey_date === today);
  const latestAnalysis = analyses[0];
  const selectedAnalysis = selectedAnalysisId
    ? analyses.find(a => a.id === selectedAnalysisId)
    : latestAnalysis;

  const generateSurvey = async () => {
    setGeneratingSurvey(true);
    try {
      const res = await base44.functions.invoke('generateDailyFeedbackSurvey', {});
      if (res.data?.success || res.data?.message) {
        toast.success("Today's survey generated successfully!");
        qc.invalidateQueries({ queryKey: ['feedback_surveys'] });
      }
    } catch (e) {
      toast.error('Failed to generate survey');
    } finally {
      setGeneratingSurvey(false);
    }
  };

  const runAnalysis = async () => {
    if (!todaySurvey) return toast.error('No survey for today');
    setRunningAnalysis(true);
    try {
      const res = await base44.functions.invoke('analyzeFeedbackSurvey', { survey_id: todaySurvey.id });
      if (res.data?.success) {
        toast.success(`Analysis complete! ${res.data.changes_count} changes recommended.`);
        refetchAnalyses();
      }
    } catch (e) {
      toast.error('Analysis failed');
    } finally {
      setRunningAnalysis(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Admin access required</p>
        </Card>
      </div>
    );
  }

  const pendingChanges = (selectedAnalysis?.recommended_changes || []).filter(c => c.status === 'pending_review');
  const approvedChanges = (selectedAnalysis?.recommended_changes || []).filter(c => c.status === 'approved');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {!embedded && <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-600" />
            Feedback Intelligence Dashboard
          </h1>
          <p className="text-gray-500 mt-1">AI-generated daily surveys → analysis → human-reviewed platform changes</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={generateSurvey} disabled={generatingSurvey} variant="outline">
            {generatingSurvey ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Generate Today's Survey
          </Button>
          <Button onClick={runAnalysis} disabled={runningAnalysis || !todaySurvey}
            className="bg-purple-600 hover:bg-purple-700">
            {runningAnalysis ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
            Run AI Analysis
          </Button>
        </div>
      </div>}

      {embedded && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <Button onClick={generateSurvey} disabled={generatingSurvey} variant="outline">
            {generatingSurvey ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Generate Today's Survey
          </Button>
          <Button onClick={runAnalysis} disabled={runningAnalysis || !todaySurvey} className="bg-purple-600 hover:bg-purple-700">
            {runningAnalysis ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
            Run AI Analysis
          </Button>
        </div>
      )}

            {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{surveys.length}</p>
                <p className="text-xs text-gray-500">Total Surveys</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{todayResponses.length}</p>
                <p className="text-xs text-gray-500">Today's Responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Lightbulb className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{pendingChanges.length}</p>
                <p className="text-xs text-gray-500">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{approvedChanges.length}</p>
                <p className="text-xs text-gray-500">Approved Changes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="review">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="review">🔍 Change Review</TabsTrigger>
          <TabsTrigger value="insights">💡 AI Insights</TabsTrigger>
          <TabsTrigger value="surveys">📋 Surveys</TabsTrigger>
          <TabsTrigger value="responses">📊 Responses</TabsTrigger>
          <TabsTrigger value="manual"><PenLine className="w-3 h-3 mr-1" />Manual Builder</TabsTrigger>
        </TabsList>

        {/* Change Review */}
        <TabsContent value="review">
          {selectedAnalysis ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  Analysis for {selectedAnalysis.survey_date} — {selectedAnalysis.total_responses_analyzed} responses
                </h3>
                <select
                  className="text-sm border rounded-lg px-3 py-1.5 bg-white"
                  value={selectedAnalysisId || latestAnalysis?.id || ''}
                  onChange={e => setSelectedAnalysisId(e.target.value)}
                >
                  {analyses.map(a => (
                    <option key={a.id} value={a.id}>{a.survey_date} ({a.total_responses_analyzed} resp)</option>
                  ))}
                </select>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-orange-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Pending Review ({pendingChanges.length})
                  </h4>
                  <div className="space-y-3">
                    {pendingChanges.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">All changes reviewed ✓</p>
                    ) : pendingChanges.map(c => (
                      <ChangeCard key={c.id} change={c} analysisId={selectedAnalysis.id} onUpdate={refetchAnalyses} />
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Approved ({approvedChanges.length})
                  </h4>
                  <div className="space-y-3">
                    {approvedChanges.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No approved changes yet</p>
                    ) : approvedChanges.map(c => (
                      <ChangeCard key={c.id} change={c} analysisId={selectedAnalysis.id} onUpdate={refetchAnalyses} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No analysis yet — generate today's survey and run AI analysis</p>
            </div>
          )}
        </TabsContent>

        {/* AI Insights */}
        <TabsContent value="insights">
          {selectedAnalysis ? (
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Sentiment Summary</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-gray-700">{selectedAnalysis.sentiment_summary}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Key Insights</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(selectedAnalysis.key_insights || []).map((insight, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-purple-500 mt-0.5">•</span> {insight}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Category Satisfaction Scores</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(selectedAnalysis.category_scores || {}).map(([cat, score]) => (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{cat}</span>
                          <span className="text-sm text-gray-500">{Number(score).toFixed(1)}/10</span>
                        </div>
                        <Progress value={Number(score) * 10} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">No insights yet</div>
          )}
        </TabsContent>

        {/* Surveys */}
        <TabsContent value="surveys">
          <div className="space-y-3">
            {surveys.map(s => (
              <Card key={s.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-semibold text-gray-900">{s.date}</p>
                        <p className="text-xs text-gray-500">{s.questions?.length || 0} questions · {s.focus_areas?.join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">{s.total_responses} responses</span>
                      <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Manual Builder */}
        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PenLine className="w-5 h-5 text-blue-600" /> Manual Survey Builder
              </CardTitle>
              <p className="text-sm text-gray-500">Create and publish a custom feedback survey with a drag-and-drop question editor.</p>
            </CardHeader>
            <CardContent>
              <ManualFeedbackSurveyBuilder onSaved={() => {}} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Responses */}
        <TabsContent value="responses">
          <div className="space-y-3">
            {responses.slice(0, 50).map(r => (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">User: {r.user_id?.slice(0, 12)}...</p>
                      <p className="text-xs text-gray-400">{r.survey_date} · {r.answers?.length || 0} answers · {r.completion_time_seconds}s</p>
                    </div>
                    <Badge variant={r.dismissed_without_completing ? 'secondary' : 'default'}>
                      {r.dismissed_without_completing ? 'Dismissed' : 'Completed'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}