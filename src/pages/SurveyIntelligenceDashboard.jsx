import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Play, RefreshCw, BarChart2, MessageSquare, Lightbulb,
  ChevronDown, ChevronUp, Loader2, Bot, Zap, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const PRIORITY_CONFIG = {
  critical: { color: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' },
  high:     { color: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  medium:   { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
  low:      { color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
};

const STATUS_CONFIG = {
  pending_review: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700' },
  approved:       { label: 'Approved', color: 'bg-green-100 text-green-700' },
  rejected:       { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  implemented:    { label: 'Implemented', color: 'bg-blue-100 text-blue-700' },
};

function RecommendationCard({ change, analysisId, onStatusUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const priority = PRIORITY_CONFIG[change.priority] || PRIORITY_CONFIG.medium;
  const status = STATUS_CONFIG[change.status] || STATUS_CONFIG.pending_review;

  return (
    <div className={`border rounded-xl p-4 ${priority.color} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${priority.dot}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-semibold text-gray-900 text-sm">{change.title}</h4>
              <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
              {change.affected_area && (
                <Badge variant="outline" className="text-xs">{change.affected_area}</Badge>
              )}
            </div>
            <p className="text-xs text-gray-600">{change.description}</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pl-5 space-y-2 border-t border-current/10 pt-3">
          {change.rationale && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-0.5">📊 Data Rationale</p>
              <p className="text-xs text-gray-600">{change.rationale}</p>
            </div>
          )}
          {change.implementation_notes && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-0.5">🔧 Implementation Notes</p>
              <p className="text-xs text-gray-600">{change.implementation_notes}</p>
            </div>
          )}
          {change.status === 'pending_review' && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                onClick={() => onStatusUpdate(change.id, 'approved')}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300"
                onClick={() => onStatusUpdate(change.id, 'rejected')}>
                Reject
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-300"
                onClick={() => onStatusUpdate(change.id, 'implemented')}>
                <Zap className="w-3 h-3 mr-1" /> Mark Implemented
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ analysis, onStatusUpdate }) {
  const changes = analysis.recommended_changes || [];
  const pending = changes.filter(c => c.status === 'pending_review').length;
  const approved = changes.filter(c => c.status === 'approved').length;

  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <p className="font-semibold text-gray-900">
              Analysis — {analysis.survey_date ? format(new Date(analysis.survey_date), 'MMM d, yyyy') : 'Unknown Date'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {analysis.total_responses_analyzed || 0} responses analyzed ·{' '}
              {changes.length} recommendations · {pending} pending review
            </p>
          </div>
          <Badge className={analysis.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
            {analysis.status === 'completed' ? '✓ Completed' : '⏳ Running'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sentiment */}
        {analysis.sentiment_summary && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
              <Brain className="w-3 h-3" /> AI Sentiment Summary
            </p>
            <p className="text-sm text-blue-700">{analysis.sentiment_summary}</p>
          </div>
        )}

        {/* Category Scores */}
        {analysis.category_scores && Object.keys(analysis.category_scores).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <BarChart2 className="w-3 h-3" /> Feature Area Scores
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(analysis.category_scores).map(([cat, score]) => (
                <div key={cat} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-600 capitalize">{cat.replace(/_/g, ' ')}</span>
                      <span className={`font-bold ${score < 6 ? 'text-red-600' : score < 8 ? 'text-yellow-600' : 'text-green-600'}`}>{score}/10</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${score < 6 ? 'bg-red-500' : score < 8 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${score * 10}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Insights */}
        {(analysis.key_insights || []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Key Insights
            </p>
            <ul className="space-y-1">
              {analysis.key_insights.map((insight, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {changes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Recommendations ({changes.length})
              </p>
              <div className="flex gap-1.5 text-xs">
                {pending > 0 && <span className="text-yellow-600 font-medium">{pending} pending</span>}
                {approved > 0 && <span className="text-green-600 font-medium">{approved} approved</span>}
              </div>
            </div>
            <div className="space-y-2">
              {changes
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (order[a.priority] || 2) - (order[b.priority] || 2);
                })
                .map((change, i) => (
                  <RecommendationCard
                    key={change.id || i}
                    change={change}
                    analysisId={analysis.id}
                    onStatusUpdate={(changeId, newStatus) => onStatusUpdate(analysis.id, changeId, newStatus)}
                  />
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SurveyIntelligenceDashboard() {
  const [user, setUser] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') { window.location.href = '/'; return; }
      setUser(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['survey-intelligence-analyses'],
    queryFn: () => base44.entities.AIFeedbackAnalysis.list('-created_date', 20),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: feedbackResponses = [] } = useQuery({
    queryKey: ['feedback-response-count'],
    queryFn: () => base44.entities.FeedbackSurveyResponse.list('-created_date', 500),
    enabled: !!user,
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['disputes-count'],
    queryFn: () => base44.entities.SurveyDispute.list('-created_date', 100),
    enabled: !!user,
  });

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    try {
      const res = await base44.functions.invoke('runSurveyIntelligence', { trigger: 'manual' });
      setLastRunResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['survey-intelligence-analyses'] });
      toast.success(`Analysis complete! ${res.data?.stats?.recommendations || 0} recommendations generated.`);
    } catch (err) {
      toast.error('Analysis failed: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStatusUpdate = async (analysisId, changeId, newStatus) => {
    const analysis = analyses.find(a => a.id === analysisId);
    if (!analysis) return;
    const updatedChanges = (analysis.recommended_changes || []).map(c =>
      c.id === changeId ? { ...c, status: newStatus } : c
    );
    await base44.entities.AIFeedbackAnalysis.update(analysisId, { recommended_changes: updatedChanges });
    queryClient.invalidateQueries({ queryKey: ['survey-intelligence-analyses'] });
    toast.success(`Recommendation marked as ${newStatus.replace('_', ' ')}`);
  };

  const totalPending = analyses.reduce((sum, a) =>
    sum + (a.recommended_changes || []).filter(c => c.status === 'pending_review').length, 0);

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="w-8 h-8 text-indigo-600" /> Survey Intelligence AI
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Analyzes all user survey responses, auto-improves low-performing surveys, and generates admin recommendations.
            </p>
          </div>
          <Button
            onClick={handleRunAnalysis}
            disabled={isRunning}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg"
          >
            {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4 mr-2" /> Run Analysis</>}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Feedback Responses', value: feedbackResponses.length, icon: MessageSquare, color: 'text-blue-600' },
            { label: 'Analyses Run', value: analyses.length, icon: Brain, color: 'text-purple-600' },
            { label: 'Pending Review', value: totalPending, icon: Clock, color: 'text-yellow-600' },
            { label: 'Open Disputes', value: disputes.filter(d => d.status === 'pending').length, icon: AlertTriangle, color: 'text-red-600' },
          ].map(stat => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Last Run Result Banner */}
        {lastRunResult && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-800 text-sm">Analysis Complete</p>
                  <p className="text-xs text-green-700 mt-0.5">{lastRunResult.sentiment_summary}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-green-700">
                    <span>📊 {lastRunResult.stats?.responses_analyzed} responses analyzed</span>
                    <span>💡 {lastRunResult.stats?.insights_generated} insights</span>
                    <span>📋 {lastRunResult.stats?.recommendations} recommendations</span>
                    <span>⚡ {lastRunResult.stats?.surveys_auto_updated} surveys auto-updated</span>
                  </div>
                  {lastRunResult.direct_modifications?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-green-800 mb-1">Auto-Applied Changes:</p>
                      {lastRunResult.direct_modifications.map((mod, i) => (
                        <p key={i} className="text-xs text-green-700">• [{mod.area}] {mod.change}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agent Info Card */}
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Bot className="w-6 h-6 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-indigo-900 text-sm">Survey Intelligence Agent — Active</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                This agent reads all FeedbackSurveyResponse, PPCSurveyResponse, and SurveyDispute records. 
                It auto-updates low-performing survey questions and daily feedback focus areas. 
                All strategic recommendations require your approval before implementation.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Auto-improves surveys', 'Tracks all responses', 'Flags low-scoring areas', 'Admin review queue'].map(f => (
                  <Badge key={f} className="bg-indigo-100 text-indigo-700 text-xs">{f}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analyses */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> Analysis History
              {totalPending > 0 && (
                <Badge className="bg-yellow-100 text-yellow-700 text-xs">{totalPending} pending</Badge>
              )}
            </h2>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['survey-intelligence-analyses'] })}>
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : analyses.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-16 text-center">
                <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No analyses yet</p>
                <p className="text-sm text-gray-400 mt-1">Click "Run Analysis" to start your first survey intelligence scan.</p>
                <Button onClick={handleRunAnalysis} disabled={isRunning} className="mt-4 bg-indigo-600">
                  <Play className="w-4 h-4 mr-2" /> Run First Analysis
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">Pending Review ({totalPending})</TabsTrigger>
                <TabsTrigger value="all">All Analyses ({analyses.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-4 space-y-4">
                {analyses.filter(a => (a.recommended_changes || []).some(c => c.status === 'pending_review')).length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                    <p>All recommendations have been reviewed!</p>
                  </div>
                ) : (
                  analyses
                    .filter(a => (a.recommended_changes || []).some(c => c.status === 'pending_review'))
                    .map(a => <AnalysisCard key={a.id} analysis={a} onStatusUpdate={handleStatusUpdate} />)
                )}
              </TabsContent>

              <TabsContent value="all" className="mt-4 space-y-4">
                {analyses.map(a => <AnalysisCard key={a.id} analysis={a} onStatusUpdate={handleStatusUpdate} />)}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}