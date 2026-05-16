import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, CheckCircle2, TrendingUp, Lightbulb, Bot, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';

const priorityColors = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

export default function AIFeedbackSurveyBuilder({ gameId, gameTitle, gameCategory }) {
  const [phase, setPhase] = useState('form'); // form | generating | survey_ready | analyzing | results
  const [feedbackGoal, setFeedbackGoal] = useState('');
  const [surveyData, setSurveyData] = useState(null);
  const [surveyId, setSurveyId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateSurvey = async () => {
    if (!feedbackGoal.trim()) return toast.error('Describe your feedback goal first.');
    setLoading(true);
    setPhase('generating');
    try {
      const res = await base44.functions.invoke('aiDeveloperFeedbackSurvey', {
        action: 'generate',
        game_id: gameId,
        game_title: gameTitle,
        game_category: gameCategory,
        feedback_goal: feedbackGoal,
      });
      setSurveyData(res.data?.survey);
      setSurveyId(res.data?.survey_id);
      setPhase('survey_ready');
      toast.success('Feedback survey is now live!');
    } catch (e) {
      toast.error(e.message);
      setPhase('form');
    }
    setLoading(false);
  };

  const analyzeResults = async () => {
    setLoading(true);
    setPhase('analyzing');
    try {
      const res = await base44.functions.invoke('aiDeveloperFeedbackSurvey', {
        action: 'analyze_feedback',
        survey_id: surveyId,
        game_id: gameId,
        game_title: gameTitle,
      });
      if (res.data?.responses_count === 0) {
        toast.info('No responses yet — check back later.');
        setPhase('survey_ready');
      } else {
        setAnalysis(res.data?.analysis);
        setPhase('results');
      }
    } catch (e) {
      toast.error(e.message);
      setPhase('survey_ready');
    }
    setLoading(false);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          AI User Feedback Survey
          <Badge className="bg-emerald-100 text-emerald-700 ml-auto">Data-Driven</Badge>
        </CardTitle>
        <p className="text-xs text-gray-500">AI generates a targeted survey from real user data. All responses feed the AI game designer.</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {phase === 'form' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { emoji: '📊', label: 'Uses real review data' },
                { emoji: '🤖', label: 'AI-tailored questions' },
                { emoji: '🎮', label: 'Feeds game AI creator' },
              ].map(i => (
                <div key={i.label} className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-xs">
                  <p className="text-lg">{i.emoji}</p>
                  <p className="text-emerald-700 font-medium mt-0.5">{i.label}</p>
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">What do you want to learn from users?</label>
              <Textarea
                value={feedbackGoal}
                onChange={e => setFeedbackGoal(e.target.value)}
                placeholder="e.g. Why are players quitting after level 3? What features do they want most? Is the monetization too aggressive?"
                className="text-sm h-20"
              />
            </div>
            <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600" onClick={generateSurvey} disabled={loading}>
              <Bot className="w-4 h-4 mr-2" /> Generate AI Feedback Survey
            </Button>
          </div>
        )}

        {(phase === 'generating' || phase === 'analyzing') && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-gray-700">
              {phase === 'generating' ? 'AI crafting questions from your user data...' : 'AI analyzing responses...'}
            </p>
          </div>
        )}

        {phase === 'survey_ready' && surveyData && (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-sm font-bold text-green-700">Survey Live: "{surveyData.survey_title}"</p>
              </div>
              <p className="text-xs text-green-600 mb-2">{surveyData.survey_description}</p>
              <div className="flex flex-wrap gap-1">
                {(surveyData.focus_areas || []).map(a => (
                  <Badge key={a} className="text-[10px] bg-white text-green-700 border border-green-200">{a}</Badge>
                ))}
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-600">Questions ({surveyData.questions?.length}):</p>
            {(surveyData.questions || []).slice(0, 4).map((q, i) => (
              <div key={i} className="p-2.5 bg-gray-50 rounded-lg border text-xs">
                <p className="font-medium text-gray-700">{i + 1}. {q.question}</p>
                <div className="flex gap-2 mt-1">
                  <Badge className="text-[10px] bg-blue-100 text-blue-700">{q.type?.replace('_', ' ')}</Badge>
                  {q.triggered_by && <span className="text-gray-400 text-[10px]">From: {q.triggered_by}</span>}
                </div>
              </div>
            ))}
            {surveyData.questions?.length > 4 && (
              <p className="text-xs text-gray-400 text-center">+ {surveyData.questions.length - 4} more questions</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={analyzeResults} disabled={loading}>
                <BarChart2 className="w-4 h-4 mr-1" /> Check Results
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => setPhase('form')}>
                New Survey
              </Button>
            </div>
          </div>
        )}

        {phase === 'results' && analysis && (
          <div className="space-y-3">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <p className="text-sm font-bold text-indigo-700 mb-1">📊 Analysis Complete</p>
              <p className="text-xs text-indigo-600">{analysis.summary}</p>
              <div className="flex gap-3 mt-2 text-xs text-indigo-700">
                <span>NPS: {analysis.nps_estimate}</span>
                <span>😊 {analysis.sentiment_breakdown?.positive || 0}% positive</span>
                <span>😐 {analysis.sentiment_breakdown?.neutral || 0}% neutral</span>
                <span>😠 {analysis.sentiment_breakdown?.negative || 0}% negative</span>
              </div>
            </div>

            {analysis.action_plan?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">🎯 Action Plan</p>
                {analysis.action_plan.slice(0, 5).map((a, i) => (
                  <div key={i} className={`mb-2 p-2.5 rounded-lg text-xs border ${priorityColors[a.priority] || 'bg-gray-50 text-gray-700'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={`text-[10px] ${priorityColors[a.priority]}`}>{a.priority?.toUpperCase()}</Badge>
                      <span className="font-bold">{a.action}</span>
                    </div>
                    <p className="text-[10px] opacity-80">{a.rationale} · Effort: {a.effort}</p>
                  </div>
                ))}
              </div>
            )}

            {analysis.top_requested_features?.length > 0 && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-bold text-blue-700 mb-1">⭐ Most Requested Features</p>
                {analysis.top_requested_features.slice(0, 4).map((f, i) => (
                  <p key={i} className="text-xs text-blue-600">• {f}</p>
                ))}
              </div>
            )}

            {analysis.improvement_roadmap && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { key: 'immediate', label: '⚡ Now', color: 'bg-red-50 border-red-200 text-red-700' },
                  { key: 'short_term', label: '📅 Soon', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
                  { key: 'long_term', label: '🔭 Future', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                ].map(t => (
                  <div key={t.key} className={`p-2 rounded-lg border ${t.color}`}>
                    <p className="font-bold mb-1">{t.label}</p>
                    {(analysis.improvement_roadmap[t.key] || []).slice(0, 2).map((item, i) => (
                      <p key={i} className="text-[10px]">• {item}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPhase('form')}>
                Create New Survey
              </Button>
              <Button size="sm" className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600" onClick={analyzeResults} disabled={loading}>
                Refresh Data
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}